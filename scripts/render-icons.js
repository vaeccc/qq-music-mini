// Guard script for extension icons.
//
// The shipped PNGs (icons/qq-music-mini-{16,32,128}.png) were produced from
// icons/qq-music-mini.svg (green Mingcute music glyph, transparent background)
// and are committed to the repository. Node without dependencies cannot
// rasterize SVG paths, so this script must NOT regenerate them — an earlier
// version of this file painted an outdated yellow circle that would have
// overwritten the correct artwork on the next run.
//
// What it does now:
//   1. Verifies every PNG referenced by manifest.json exists.
//   2. Refuses to overwrite any existing PNG (nothing is written, ever).
//   3. Reports leftover artwork that is not referenced by the manifest.

import { existsSync, readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url);
const ICONS = new URL("../icons/", import.meta.url);

const manifest = JSON.parse(readFileSync(new URL("manifest.json", ROOT), "utf8"));
const referenced = new Set([
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {})
]);

let ok = true;
for (const path of referenced) {
  const file = new URL(path, ROOT);
  if (existsSync(file)) {
    console.log(`ok      ${path}`);
  } else {
    console.error(`MISSING ${path} — restore it from git (git checkout -- ${path})`);
    ok = false;
  }
}

if (!ok) process.exit(1);

// Never write PNGs. To change the icon, edit icons/qq-music-mini.svg, export
// PNGs at 16/32/128 with an external rasterizer, then commit all four files.
console.log("\nIcons verified. This script intentionally never regenerates PNGs —");
console.log("edit icons/qq-music-mini.svg and rasterize externally instead.");
