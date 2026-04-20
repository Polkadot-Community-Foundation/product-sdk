import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    external: ["@novasamatech/sdk-statement", "@novasamatech/product-sdk"],
    define: {
        "import.meta.vitest": "undefined",
    },
});
