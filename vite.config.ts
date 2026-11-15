import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
    plugins: [
        svelte(),
        {
            name: "copy-siyuan-plugin-assets",
            closeBundle() {
                copyFileSync("plugin.json", "dist/plugin.json");
                copyFileSync("LICENSE", "dist/LICENSE");
                mkdirSync("dist/i18n", { recursive: true });
                cpSync("i18n", "dist/i18n", { recursive: true });
            }
        }
    ],
    build: {
        outDir: "dist",
        emptyOutDir: true,
        minify: "esbuild",
        sourcemap: false,
        cssCodeSplit: false,
        lib: {
            entry: "src/index.ts",
            formats: ["cjs"],
            fileName: () => "index.js",
            cssFileName: "index"
        },
        rollupOptions: {
            external: ["siyuan"],
            output: {
                exports: "default"
            }
        }
    }
});
