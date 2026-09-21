import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

// Fonts are SELF-HOSTED, not loaded from Google. A page whose whole claim is
// that nothing reaches a server should not make every verifier's browser call
// a third party — that request alone would reveal that they opened a
// credential. Self-hosting also means the page works with no external network.
// The live UNDP site uses ProximaNova (body) and SohneBreit (display). Both
// are licensed and cannot ship here, so Mulish stands in — closest free match
// for Proxima Nova's geometric-humanist proportions. If UNDP holds the
// licences, drop the real woff2 files in and change these three lines.
const FONTS = [
  ["@fontsource/mulish/files/mulish-latin-400-normal.woff2", "UNDP Sans", 400],
  ["@fontsource/mulish/files/mulish-latin-600-normal.woff2", "UNDP Sans", 600],
  ["@fontsource/mulish/files/mulish-latin-800-normal.woff2", "UNDP Sans", 800],
  ["@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff2", "UNDP Mono", 400],
];

function emitFonts() {
  fs.mkdirSync("dist/fonts", { recursive: true });
  const faces = FONTS.map(([src, family, weight]) => {
    const file = path.basename(src);
    fs.copyFileSync(path.join("node_modules", src), path.join("dist/fonts", file));
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
           `font-display:swap;src:url('./fonts/${file}') format('woff2')}`;
  }).join("\n");
  fs.writeFileSync("dist/fonts.css", faces + "\n");
}
await esbuild.build({
  entryPoints: ["src/app.js"],
  bundle: true, format: "esm", minify: true, target: "es2022",
  outfile: "dist/app.js",
});
emitFonts();
fs.copyFileSync("src/index.html", "dist/index.html");
if (fs.existsSync("src/example-credential.json")) {
  fs.copyFileSync("src/example-credential.json", "dist/example-credential.json");
}
console.log("built dist/");
