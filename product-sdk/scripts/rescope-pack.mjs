#!/usr/bin/env node
/**
 * rescope-pack.mjs — stage PCF-scoped tarballs of the three devnet-carrying
 * product-sdk packages without renaming them in-tree.
 *
 * Why: this repo is the PCF fork of paritytech/product-sdk. The packages stay
 * named `@parity/product-sdk-*` in-tree so the tree stays merge-clean with
 * `git merge upstream/main`. But PCF publishes its own build — carrying the
 * `feat/devnet-env` devnet support that is NOT on the @parity npm releases —
 * under its own scope, so the dotns UI + playground-constellation can consume
 * devnet. Mirrors polkadot-app-deploy + cdm-env + browse-sdk rescope-at-pack.
 *
 * Only these three packages are rescoped (they carry the devnet changes and the
 * consumers import them):
 *   @parity/product-sdk-descriptors   -> @polkadot-community-foundation/product-sdk-descriptors
 *   @parity/product-sdk-chain-client  -> @polkadot-community-foundation/product-sdk-chain-client
 *   @parity/product-sdk-host          -> @polkadot-community-foundation/product-sdk-host
 * The other 6 product-sdk packages stay @parity (mixed scope resolves fine as
 * long as the referenced @parity versions are published on npm — see WARN below).
 *
 * Assumes the packages are already built (`pnpm build` ran in CI before this).
 * Step 1 uses `pnpm pack` (NOT `npm pack`) so pnpm resolves the `workspace:*`
 * and `catalog:` protocols to concrete versions/ranges. Then we rewrite `name`
 * and rewrite any cross-dependency AMONG the three rescoped packages to the new
 * scope, and repack with `npm pack` (deps are concrete by then).
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKGS_DIR = join(WORKSPACE_DIR, "packages");
const OUT_DIR = join(WORKSPACE_DIR, "pack-output");
const NEW_SCOPE = "@polkadot-community-foundation";

// in-tree package dir -> in-tree @parity name. These three are the rescope set;
// a cross-dependency on any of them (by @parity name) is rewritten to NEW_SCOPE.
const RESCOPE = {
    descriptors: "@parity/product-sdk-descriptors",
    "chain-client": "@parity/product-sdk-chain-client",
    host: "@parity/product-sdk-host",
};
const RESCOPE_NAMES = new Set(Object.values(RESCOPE));
const rescopedName = (name) => name.replace(/^@parity\//, `${NEW_SCOPE}/`);

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const results = [];
let sawUnpublishedRisk = false;

for (const [dir, upstreamName] of Object.entries(RESCOPE)) {
    const pkgDir = join(PKGS_DIR, dir);
    const stage = mkdtempSync(join(tmpdir(), `pcf-product-sdk-${dir}-`));

    // Step 1: pnpm pack resolves workspace:*/catalog: to concrete versions.
    run(`pnpm pack --pack-destination ${stage}`, pkgDir);
    const srcTgz = readdirSync(stage).find((f) => f.endsWith(".tgz"));
    if (!srcTgz) throw new Error(`pnpm pack produced no .tgz for ${dir} (build first: pnpm build)`);
    run(`tar -xzf ${join(stage, srcTgz)} -C ${stage}`, stage); // -> ${stage}/package/

    const pkgJsonPath = join(stage, "package", "package.json");
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

    // Rewrite the package's own name.
    pkg.name = rescopedName(upstreamName);

    // Rewrite cross-deps AMONG the three rescoped packages to the new scope.
    // Every OTHER @parity/* dep stays @parity (must already be on npm).
    for (const depField of ["dependencies", "peerDependencies", "optionalDependencies"]) {
        const deps = pkg[depField];
        if (!deps) continue;
        for (const depName of Object.keys(deps)) {
            if (RESCOPE_NAMES.has(depName)) {
                const version = deps[depName];
                delete deps[depName];
                deps[rescopedName(depName)] = version;
            } else if (depName.startsWith("@parity/")) {
                // Left at @parity — flag so CI logs surface any dep that is NOT
                // published on npm (would make the rescoped tarball uninstallable).
                console.log(`[rescope-pack]   ${pkg.name} keeps @parity dep ${depName}@${deps[depName]}`);
                if (depName === "@parity/product-sdk-errors" || depName === "@parity/result") {
                    console.log(
                        `[rescope-pack]   ⚠️  WARN: ${depName}@${deps[depName]} is NOT published on npm ` +
                            `-> ${pkg.name} will be UNINSTALLABLE until it is published (or also rescoped).`,
                    );
                    sawUnpublishedRisk = true;
                }
            }
        }
    }

    // No `prepare` in these packages, but strip it defensively so the repack in
    // a node_modules-less dir can't try to rebuild (npm pack runs prepare even
    // with --ignore-scripts).
    if (pkg.scripts) delete pkg.scripts.prepare;
    writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");

    // Step 2: repack with the rewritten package.json (deps are concrete now).
    run(`npm pack --ignore-scripts --pack-destination ${OUT_DIR}`, join(stage, "package"));
    rmSync(stage, { recursive: true, force: true });

    results.push({ upstreamName, name: pkg.name, version: pkg.version });
    console.log(`[rescope-pack] ${upstreamName}@${pkg.version} -> ${pkg.name}@${pkg.version}`);
}

console.log("\n[rescope-pack] staged tarballs:");
for (const f of readdirSync(OUT_DIR).filter((f) => f.endsWith(".tgz"))) {
    console.log(`  ${join(OUT_DIR, f)}`);
}
if (sawUnpublishedRisk) {
    console.log(
        "\n[rescope-pack] ⚠️  One or more rescoped tarballs reference an UNPUBLISHED @parity dep " +
            "(see WARN above). They will publish but stay uninstallable until those deps land on npm.",
    );
}
