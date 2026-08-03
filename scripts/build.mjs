import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";

const root = process.cwd();
const distDir = resolve(root, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await build({
  configFile: false,
  publicDir: false,
  build: {
    emptyOutDir: false,
    minify: false,
    outDir: distDir,
    target: "es2022",
    rollupOptions: {
      input: {
        background: resolve(root, "src/background.ts"),
        sidepanel: resolve(root, "src/sidepanel.ts")
      },
      output: {
        entryFileNames: "src/[name].js",
        chunkFileNames: "src/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});

await build({
  configFile: false,
  publicDir: false,
  build: {
    emptyOutDir: false,
    minify: false,
    outDir: distDir,
    target: "es2022",
    lib: {
      entry: resolve(root, "src/content-script.ts"),
      name: "OrionisContentScript",
      formats: ["iife"],
      fileName: () => "src/content-script.js"
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});

await Promise.all([
  cp(resolve(root, "manifest.json"), resolve(distDir, "manifest.json")),
  cp(resolve(root, "_locales"), resolve(distDir, "_locales"), { recursive: true }),
  cp(resolve(root, "assets"), resolve(distDir, "assets"), { recursive: true }),
  cp(resolve(root, "src/sidepanel.html"), resolve(distDir, "src/sidepanel.html")),
  cp(resolve(root, "src/styles.css"), resolve(distDir, "src/styles.css"))
]);
