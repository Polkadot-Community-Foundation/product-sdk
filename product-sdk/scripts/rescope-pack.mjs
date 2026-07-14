#!/usr/bin/env node
/**
 * rescope-pack.mjs — stage PCF-scoped tarballs of the devnet-carrying
 * product-sdk packages without renaming them in-tree.
 *
 * Why: this repo is the PCF fork of paritytech/product-sdk. The packages stay
 * named `@parity/product-sdk-*` in-tree so the tree stays merge-clean with
 * `git merge upstream/main`. But PCF publishes its own build — carrying the
 * `feat/devnet-env` devnet support that is NOT on the @parity npm releases —
 * under its own scope, so the dotns UI + playground-constellation can consume
 * devnet. Mirrors polkadot-app-deploy + cdm-env + browse-sdk rescope-at-pack.
 *
 * Five packages are rescoped — the three that carry the devnet changes / are
 * imported by the consumers, plus the two zero-dependency leaf packages `host`
 * transitively needs (they are NOT published on the @parity npm scope, so they
 * must also be PCF-scoped for the graph to fully close):
 *   @parity/product-sdk-descriptors   -> @polkadot-community-foundation/product-sdk-descriptors
 *   @parity/product-sdk-chain-client  -> @polkadot-community-foundation/product-sdk-chain-client
 *   @parity/product-sdk-host          -> @polkadot-community-foundation/product-sdk-host
 *   @parity/product-sdk-errors        -> @polkadot-community-foundation/product-sdk-errors
 *   @parity/result                    -> @polkadot-community-foundation/result   (base name kept, no product-sdk- prefix)
 * Every other @parity/* dep left in a rescoped tarball (e.g. product-sdk-logger,
 * truapi) stays @parity and MUST already be published on npm — the script logs
 * each one so CI surfaces any that is not.
 *
 * Assumes the packages are already built (`pnpm build` ran in CI before this).
 * Step 1 uses `pnpm pack` (NOT `npm pack`) so pnpm resolves the `workspace:*`
 * and `catalog:` protocols to concrete versions/ranges. Then we rewrite `name`
 * and rewrite any cross-dependency AMONG the rescoped packages to the new scope,
 * and repack with `npm pack` (deps are concrete by then).
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

// in-tree package dir -> in-tree @parity name. These are the rescope set; a
// cross-dependency on any of them (by @parity name) is rewritten to NEW_SCOPE.
// `errors` + `result` are included so `host`'s (and chain-client's transitive)
// deps on them resolve to PCF-scoped, published names — they have no @parity
// npm release. `rescopedName` maps @parity/result -> @polkadot-community-foundation/result
// (no product-sdk- prefix) and @parity/product-sdk-errors -> .../product-sdk-errors.
const RESCOPE = {
    descriptors: "@parity/product-sdk-descriptors",
    "chain-client": "@parity/product-sdk-chain-client",
    host: "@parity/product-sdk-host",
    errors: "@parity/product-sdk-errors",
    result: "@parity/result",
};
const RESCOPE_NAMES = new Set(Object.values(RESCOPE));
const rescopedName = (name) => name.replace(/^@parity\//, `${NEW_SCOPE}/`);

// Rewriting the package.json alone is not enough: the COMPILED code shipped in
// dist/ still contains `import ... from "@parity/result"` (and the four other
// rescoped specifiers), which are no longer declared deps of the rescoped
// package -> a consumer bundler (Rollup/vite) fails to resolve them. So after
// packing we also rewrite those specifiers inside the shipped text files.
//
// Only the five rescoped names are rewritten, and only as WHOLE specifiers: the
// negative lookahead `(?![A-Za-z0-9-])` forbids a trailing identifier/dash char
// so `@parity/product-sdk-logger`, `@parity/product-sdk-*` (a JSDoc glob) and
// any other longer @parity name are left untouched, while a subpath like
// `@parity/product-sdk-host/testing` is still rewritten (the `/` is a boundary).
const REWRITE_EXTS = [".js", ".mjs", ".cjs", ".d.ts", ".d.mts", ".d.cts", ".map"];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SPEC_REWRITES = [...RESCOPE_NAMES].map((name) => ({
    re: new RegExp(`${escapeRe(name)}(?![A-Za-z0-9-])`, "g"),
    to: rescopedName(name),
}));

// Recursively list files under `dir` whose name ends with a rewrite extension.
const listRewriteTargets = (dir) => {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listRewriteTargets(p));
        else if (entry.isFile() && REWRITE_EXTS.some((ext) => entry.name.endsWith(ext))) out.push(p);
    }
    return out;
};

// Rewrite the five rescoped specifiers in every shipped text file under `root`.
// Returns the number of files changed.
const rewriteDistSpecifiers = (root) => {
    let changed = 0;
    for (const file of listRewriteTargets(root)) {
        const before = readFileSync(file, "utf8");
        let after = before;
        for (const { re, to } of SPEC_REWRITES) after = after.replace(re, to);
        if (after !== before) {
            writeFileSync(file, after);
            changed++;
        }
    }
    return changed;
};

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

// @parity/* deps that are legitimately left at @parity because they ARE
// published on npm (verified: product-sdk-logger@0.1.1, truapi@0.3.2). Any kept
// @parity dep NOT in this set is flagged loudly — it would make the tarball
// uninstallable.
const KNOWN_PUBLISHED_PARITY = new Set(["@parity/product-sdk-logger", "@parity/truapi"]);

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
                // Left at @parity — must already be published on npm.
                console.log(`[rescope-pack]   ${pkg.name} keeps @parity dep ${depName}@${deps[depName]}`);
                if (!KNOWN_PUBLISHED_PARITY.has(depName)) {
                    console.log(
                        `[rescope-pack]   ⚠️  WARN: ${depName}@${deps[depName]} is not in the known-published ` +
                            `@parity set -> verify it is on npm, or ${pkg.name} will be UNINSTALLABLE.`,
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

    // Step 1b: rewrite the five rescoped specifiers inside the extracted,
    // shipped code (dist/ + any source) so the compiled imports/requires match
    // the rescoped names. Without this the tarball's package.json is PCF-scoped
    // but its dist code still `import`s `@parity/result` etc. -> unresolvable.
    const rewritten = rewriteDistSpecifiers(join(stage, "package"));
    console.log(`[rescope-pack]   ${pkg.name} rewrote rescoped specifiers in ${rewritten} shipped file(s)`);

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
        "\n[rescope-pack] ⚠️  One or more rescoped tarballs keep an @parity dep outside the known-published " +
            "set (see WARN above). Verify it is on npm, or the tarball will be uninstallable.",
    );
} else {
    console.log(
        "\n[rescope-pack] ✓ Graph closed: every dep in every rescoped tarball is either PCF-scoped (in-set) " +
            "or a published @parity/third-party package.",
    );
}
