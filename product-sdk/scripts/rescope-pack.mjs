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
 * Eight packages are rescoped — the three that carry the devnet changes / are
 * imported by the consumers, the two zero-dependency leaf packages `host`
 * transitively needs (they are NOT published on the @parity npm scope, so they
 * must also be PCF-scoped for the graph to fully close), `terminal`, which
 * carries the QR-pairing fix (host-papp 0.10.0 / 32-byte X25519 handshake key)
 * that the @parity npm releases do not yet have, and `keys` + `utils`, which
 * carry the RFC-0022 product-account derivation fix (see below):
 *   @parity/product-sdk-descriptors   -> @polkadot-community-foundation/product-sdk-descriptors
 *   @parity/product-sdk-chain-client  -> @polkadot-community-foundation/product-sdk-chain-client
 *   @parity/product-sdk-host          -> @polkadot-community-foundation/product-sdk-host
 *   @parity/product-sdk-errors        -> @polkadot-community-foundation/product-sdk-errors
 *   @parity/result                    -> @polkadot-community-foundation/result   (base name kept, no product-sdk- prefix)
 *   @parity/product-sdk-terminal      -> @polkadot-community-foundation/product-sdk-terminal
 *   @parity/product-sdk-keys          -> @polkadot-community-foundation/product-sdk-keys
 *   @parity/product-sdk-utils         -> @polkadot-community-foundation/product-sdk-utils
 * Every other @parity/* dep left in a rescoped tarball (e.g. product-sdk-logger,
 * truapi) stays @parity and MUST already be published on npm — the script logs
 * each one so CI surfaces any that is not.
 *
 * WHY `keys` + `utils` are in the set (RFC-0022):
 * `terminal` externalises `@parity/product-sdk-keys` (tsup keeps declared deps
 * out of the bundle), so a rescoped `terminal` tarball that keeps that dep at
 * @parity resolves `deriveProductAccountPublicKey` from the npm release. npm
 * has keys@0.3.24, and `pnpm pack` resolves `workspace:*` to that same 0.3.24 —
 * so the published-version check below goes GREEN while the installed code is
 * the PRE-RFC-0022 implementation with the old 3-arg signature. Calling it with
 * the new 2-arg `(subtreeKey, {tag:"Index"})` shape does not throw; it returns a
 * DIFFERENT, wrong public key. That is precisely the silent-wrong-address defect
 * RFC-0022 fixes, reintroduced by packaging. `keys` in turn needs the new
 * `derivationIndexBytes` from `utils`, which npm's utils@0.1.1 does not export,
 * so `utils` comes along too. Both must leave this fork under the PCF scope for
 * the fix to actually reach a consumer.
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
    terminal: "@parity/product-sdk-terminal",
    keys: "@parity/product-sdk-keys",
    utils: "@parity/product-sdk-utils",
    signer: "@parity/product-sdk-signer",
};
const RESCOPE_NAMES = new Set(Object.values(RESCOPE));
const rescopedName = (name) => name.replace(/^@parity\//, `${NEW_SCOPE}/`);

// Rewriting the package.json alone is not enough: the COMPILED code shipped in
// dist/ still contains `import ... from "@parity/result"` (and the four other
// rescoped specifiers), which are no longer declared deps of the rescoped
// package -> a consumer bundler (Rollup/vite) fails to resolve them. So after
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

// @parity/* deps deliberately left at @parity because upstream publishes them.
// This set is DOCUMENTATION of an expected keep, not a bypass: every kept dep is
// verified against npm at its exact version by the hard gate at the end of this
// script, whether or not it appears here. It used to be a bypass, which is how
// terminal 0.9.0 shipped naming signer@0.14.5 — a version upstream never
// published — and died on install with ETARGET.
const KNOWN_PUBLISHED_PARITY = new Set([
    "@parity/product-sdk-logger",
    "@parity/truapi",
    "@parity/product-sdk-address",
    "@parity/product-sdk-crypto",
    "@parity/product-sdk-local-storage",
]);

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

    // Rewrite the package's own name.
    pkg.name = rescopedName(upstreamName);

    // Rewrite cross-deps AMONG the rescoped packages to the new scope.
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
                // Left at @parity — must already be published on npm. Recorded
                // for the hard existence check below; membership in
                // KNOWN_PUBLISHED_PARITY documents an EXPECTED keep, it does not
                // excuse one from being verified.
                console.log(`[rescope-pack]   ${pkg.name} keeps @parity dep ${depName}@${deps[depName]}`);
                keptParityDeps.push({ consumer: pkg.name, depName, range: deps[depName] });
                if (!KNOWN_PUBLISHED_PARITY.has(depName)) {
                    console.log(
                        `[rescope-pack]   note: ${depName} is not in the known-published @parity set.`,
                    );
                }
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
