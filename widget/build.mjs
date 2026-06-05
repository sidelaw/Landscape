// Bundles the Preact widget into a single embeddable script served from
// /public/embed/widget.js. Run via `npm run build:widget` (and as part of
// `npm run build`). Preact keeps this small; the bundle ships inside an embed.
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const outfile = resolve(root, "../public/embed/widget.js");
mkdirSync(dirname(outfile), { recursive: true });

const isWatch = process.argv.includes("--watch");

await build({
  entryPoints: [resolve(root, "src/index.tsx")],
  outfile,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2019"],
  minify: !isWatch,
  sourcemap: isWatch,
  jsx: "automatic",
  jsxImportSource: "preact",
  legalComments: "none",
  logLevel: "info",
});

console.log(`✓ widget bundled → ${outfile}`);
