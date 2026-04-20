import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        "react/index": "src/react/index.ts",
    },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    external: ["react"],
    define: {
        "import.meta.vitest": "undefined",
    },
});
