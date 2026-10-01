/**
 * TwoFold brand asset pipeline.
 *
 * Takes a candidate mark from ./marks and produces everything you need to
 * actually ship it. Nothing here invents a logo. It refines and exports one.
 *
 *   node build.mjs twofold      build a single mark
 *   node build.mjs --all        build every mark in ./marks
 *
 * Output lands in ./dist/<mark>/
 *   mark.svg            optimized, via svgo
 *   mark-mono-dark.svg  single ink colour, for light backgrounds
 *   mark-mono-light.svg single white,     for dark backgrounds
 *   mark-mono-tonal.svg greyscale with the folds kept, as in the brand kit
 *   png/                256, 512, 1024 raster exports
 *   favicon/            full favicon + app icon set + manifest + html snippet
 */

import { optimize } from "svgo";
import sharp from "sharp";
import { favicons } from "favicons";
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARKS = path.join(HERE, "marks");
const DIST = path.join(HERE, "dist");

const INK = "#18211C";
const PNG_SIZES = [256, 512, 1024];

// Brand colours, so the monochrome pass knows what to collapse.
const BRAND = ["#E3A377", "#7CBC9E", "#3B8168", "#2E6552", "#6E7B4A"];

const svgoConfig = {
  multipass: true,
  plugins: [
    { name: "preset-default", params: { overrides: { removeViewBox: false } } },
    "removeDimensions",
  ],
};

// Tonal greyscale mapping, sampled from the kit's Monochrome panel and snapped to palette.
const TONAL = { "#E3A377": "#879388", "#7CBC9E": "#5C6862", "#2E6552": "#18211C" };

/** Swap each colour per a map, case-insensitively. */
function remap(svg, map) {
  let out = svg;
  for (const [from, to] of Object.entries(map)) out = out.replaceAll(from, to).replaceAll(from.toLowerCase(), to);
  return out;
}

/** Collapse both brand tones to a single colour for one-colour usage. */
function monochrome(svg, colour) {
  let out = svg;
  for (const c of BRAND) {
    out = out.replaceAll(c, colour).replaceAll(c.toLowerCase(), colour);
  }
  return out;
}

async function buildMark(name) {
  const srcPath = path.join(MARKS, `${name}.svg`);
  const raw = await readFile(srcPath, "utf8");
  const outDir = path.join(DIST, name);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, "png"), { recursive: true });

  // 1. Optimize
  const { data: optimized } = optimize(raw, { ...svgoConfig, path: srcPath });
  await writeFile(path.join(outDir, "mark.svg"), optimized);

  // 2. Monochrome variants. Every real identity needs these.
  await writeFile(
    path.join(outDir, "mark-mono-dark.svg"),
    optimize(monochrome(raw, INK), svgoConfig).data,
  );
  await writeFile(
    path.join(outDir, "mark-mono-light.svg"),
    optimize(monochrome(raw, "#FFFFFF"), svgoConfig).data,
  );
  // Tonal monochrome, as in the brand kit: the folds stay readable in greys.
  // Mapped onto the palette's own neutrals rather than invented greys.
  await writeFile(
    path.join(outDir, "mark-mono-tonal.svg"),
    optimize(remap(raw, TONAL), svgoConfig).data,
  );

  // 3. Raster exports. density keeps small viewBoxes from rendering soft.
  const buf = Buffer.from(optimized);
  for (const size of PNG_SIZES) {
    await sharp(buf, { density: 384 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outDir, "png", `mark-${size}.png`));
  }

  // 4. Favicon + app icon set.
  const response = await favicons(buf, {
    path: "/",
    appName: "TwoFold",
    appShortName: "TwoFold",
    appDescription: "The money talk, down to five minutes.",
    background: "#FAFAF7",
    theme_color: "#3B8168",
    icons: {
      // Home-screen icons get padding on the cream tile, as in the brand kit's app icon.
      // Platforms round the corners, which would otherwise clip the edge of the bowl.
      // Browser-tab favicons stay full bleed: at 16 to 32px every pixel of the mark counts.
      android: { offset: 14, background: true },
      appleIcon: { offset: 14, background: true },
      favicons: true,
      appleStartup: false,
      windows: false,
      yandex: false,
    },
  });

  const favDir = path.join(outDir, "favicon");
  await mkdir(favDir, { recursive: true });
  for (const image of response.images) {
    await writeFile(path.join(favDir, image.name), image.contents);
  }
  for (const file of response.files) {
    await writeFile(path.join(favDir, file.name), file.contents);
  }
  await writeFile(path.join(favDir, "head.html"), response.html.join("\n"));

  const saved = raw.length - optimized.length;
  return {
    name,
    bytes: `${raw.length} -> ${optimized.length} (${saved >= 0 ? "-" : "+"}${Math.abs(saved)})`,
    icons: response.images.length + response.files.length,
  };
}

const args = process.argv.slice(2);
const all = args.includes("--all");
const names = all
  ? (await readdir(MARKS)).filter((f) => f.endsWith(".svg")).map((f) => path.basename(f, ".svg"))
  : args.filter((a) => !a.startsWith("--"));

if (names.length === 0) {
  console.error("Usage: node build.mjs <mark-name> | --all");
  console.error(
    "Available:",
    (await readdir(MARKS)).filter((f) => f.endsWith(".svg")).map((f) => path.basename(f, ".svg")).join(", "),
  );
  process.exit(1);
}

for (const name of names) {
  const r = await buildMark(name);
  console.log(`${r.name.padEnd(11)} svg ${r.bytes.padEnd(22)} ${r.icons} icon files`);
}
console.log(`\nDone. Output in ${path.relative(process.cwd(), DIST)}/`);
