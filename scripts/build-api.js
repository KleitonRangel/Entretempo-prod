/**
 * Build script for Vercel API functions.
 * Bundles TypeScript providers and the unified handler into a single .js file
 * that Node.js (Vercel Functions) can execute directly.
 */

import { build } from "esbuild";
import { glob } from "glob";

const output = "dist-api/index.js";

await build({
  entryPoints: ["api/index.js"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: output,
  external: [], // no external deps - bundle everything
  write: true,
  sourcemap: false,
  logLevel: "info",
});

console.log(`✅ Built API handler → ${output}`);
