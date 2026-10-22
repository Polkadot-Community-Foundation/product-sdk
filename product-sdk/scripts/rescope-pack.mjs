#!/usr/bin/env node
/**
 * rescope-pack.mjs — stage the PCF build of product-sdk-descriptors without
 * renaming it in-tree.
 *
 * Packages keep their `@parity/*` names in-tree so the fork stays merge-clean
 * with upstream. The only content PCF ships on top of an @parity release is the
 * devnet chain metadata, which this fork pins to the live products devnet. Every
 * other package matches its @parity release, so only the descriptors are
 * republished:
 *   @parity/product-sdk-descriptors -> @polkadot-community-foundation/product-sdk-descriptors
 *
 * Consumers swap it in with a package-manager override, so every @parity package
 * that imports the descriptors (chain-client, cloud-storage, the umbrella) shares
 * one copy:
 *   "@parity/product-sdk-descriptors": "npm:@polkadot-community-foundation/product-sdk-descriptors@0.14.0-pcf.1"
 *
 * The version is the in-tree version plus `-pcf.<PCF_BUILD>`, so a PCF build
 * never shares a version with the @parity release it differs from. Bump
 * PCF_BUILD for each publish of the same in-tree version.
 *
 * Assumes the packages are already built (`pnpm build` ran in CI before this).
 * Step 1 uses `pnpm pack` (NOT `npm pack`) so pnpm resolves the `workspace:*`
 * and `catalog:` protocols to concrete versions/ranges. Then we rewrite `name`,
 * `version` and any cross-dependency AMONG the rescoped packages, and repack
 * with `npm pack` (deps are concrete by then).
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
const RESCOPE = {
    descriptors: "@parity/product-sdk-descriptors",
};
const RESCOPE_NAMES = new Set(Object.values(RESCOPE));

const PCF_BUILD = process.env.PCF_BUILD ?? "";
if (!/^[1-9][0-9]*$/.test(PCF_BUILD)) {
    throw new Error(`PCF_BUILD must be a positive integer, got "${PCF_BUILD}"`);
}
// @parity name -> published version, for the package itself and for any
// cross-dependency on it.
const PCF_VERSIONS = Object.fromEntries(
    Object.entries(RESCOPE).map(([dir, name]) => {
        const { version } = JSON.parse(readFileSync(join(PKGS_DIR, dir, "package.json"), "utf8"));
        if (version.includes("-")) {
            throw new Error(`${name}@${version} is already a prerelease; refusing to append -pcf.${PCF_BUILD}`);
        }
        return [name, `${version}-pcf.${PCF_BUILD}`];
    }),
);
const rescopedName = (name) => name.replace(/^@parity\//, `${NEW_SCOPE}/`);

// Rewriting the package.json alone is not enough: the COMPILED code shipped in
// dist/ can still `import` a rescoped package by its @parity name, which is no
// longer a declared dep of the rescoped package -> a consumer bundler
// (Rollup/vite) fails to resolve it. So after
// packing we also rewrite those specifiers inside the shipped text files.
//
// Only the rescoped names are rewritten, and only as WHOLE specifiers: the
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

// Rewrite the rescoped specifiers in every shipped text file under `root`.
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

const results = [];
/** Every @parity dep left un-rescoped, verified against npm before we finish. */
const keptParityDeps = [];

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

    // Rewrite the package's own name and version.
    const inTreeVersion = pkg.version;
    pkg.name = rescopedName(upstreamName);
    pkg.version = PCF_VERSIONS[upstreamName];

    // Rewrite cross-deps AMONG the rescoped packages to the new scope and
    // their PCF versions. Every OTHER @parity/* dep stays @parity.
    for (const depField of ["dependencies", "peerDependencies", "optionalDependencies"]) {
        const deps = pkg[depField];
        if (!deps) continue;
        for (const depName of Object.keys(deps)) {
            if (RESCOPE_NAMES.has(depName)) {
                delete deps[depName];
                deps[rescopedName(depName)] = PCF_VERSIONS[depName];
            } else if (depName.startsWith("@parity/")) {
                // Left at @parity, so it must already be published on npm:
                // recorded for the hard existence check below.
                console.log(`[rescope-pack]   ${pkg.name} keeps @parity dep ${depName}@${deps[depName]}`);
                keptParityDeps.push({ consumer: pkg.name, depName, range: deps[depName] });
            }
        }
    }

    // No `prepare` in these packages, but strip it defensively so the repack in
    // a node_modules-less dir can't try to rebuild (npm pack runs prepare even
    // with --ignore-scripts).
    if (pkg.scripts) delete pkg.scripts.prepare;
    writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");

    // Step 1b: rewrite the rescoped specifiers inside the extracted,
    // shipped code (dist/ + any source) so the compiled imports/requires match
    // the rescoped names. Without this the tarball's package.json is PCF-scoped
    // but its dist code still `import`s the @parity names -> unresolvable.
    const rewritten = rewriteDistSpecifiers(join(stage, "package"));
    console.log(`[rescope-pack]   ${pkg.name} rewrote rescoped specifiers in ${rewritten} shipped file(s)`);

    // Step 2: repack with the rewritten package.json (deps are concrete now).
    run(`npm pack --ignore-scripts --pack-destination ${OUT_DIR}`, join(stage, "package"));
    rmSync(stage, { recursive: true, force: true });

    results.push({ upstreamName, name: pkg.name, version: pkg.version });
    console.log(`[rescope-pack] ${upstreamName}@${inTreeVersion} -> ${pkg.name}@${pkg.version}`);
}

console.log("\n[rescope-pack] staged tarballs:");
for (const f of readdirSync(OUT_DIR).filter((f) => f.endsWith(".tgz"))) {
    console.log(`  ${join(OUT_DIR, f)}`);
}
// Hard gate. `pnpm pack` freezes `workspace:*` to the EXACT in-tree version, so
// any package this fork bumps ahead of an upstream npm release leaves a dep
// pointing at a version that does not exist. That is not hypothetical: terminal
// 0.9.0 shipped naming @parity/product-sdk-signer@0.14.5, which upstream never
// published, and `npm i` died with ETARGET. The old check could not catch it —
// signer was in KNOWN_PUBLISHED_PARITY, and membership SKIPPED verification
// entirely. Worse, the "risk" path only printed; it never failed the build.
//
// So: ask npm about every kept dep at its exact version, and exit non-zero on a
// miss. Better to fail the pack than to publish an uninstallable tarball.
const missing = [];
for (const { consumer, depName, range } of keptParityDeps) {
    const version = String(range).replace(/^[\^~]/, "");
    let found = false;
    try {
        found = run(`npm view ${depName}@${version} version`, WORKSPACE_DIR).trim().length > 0;
    } catch {
        found = false;
    }
    console.log(`[rescope-pack]   verify ${depName}@${version} on npm -> ${found ? "ok" : "MISSING"}`);
    if (!found) missing.push(`${depName}@${version} (kept by ${consumer})`);
}

if (missing.length > 0) {
    console.error(
        "\n[rescope-pack] ✗ REFUSING to stage: these kept @parity deps are not on npm, so the " +
            "tarballs would be UNINSTALLABLE:\n" +
            missing.map((m) => `    ${m}`).join("\n") +
            "\n  Fix by rescoping the package (add it to RESCOPE) or pinning the dep back to a published version.",
    );
    process.exit(1);
}

console.log(
    "\n[rescope-pack] ✓ Graph closed: every dep in every rescoped tarball is either PCF-scoped (in-set) " +
        "or verified present on npm at the exact version named.",
);
