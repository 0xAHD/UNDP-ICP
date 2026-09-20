import * as esbuild from "esbuild";
import fs from "node:fs";
await esbuild.build({
  entryPoints: ["src/app.js"],
  bundle: true, format: "esm", minify: true, target: "es2022",
  outfile: "dist/app.js",
});
fs.copyFileSync("src/index.html", "dist/index.html");
if (fs.existsSync("src/example-credential.json")) {
  fs.copyFileSync("src/example-credential.json", "dist/example-credential.json");
}
console.log("built dist/");
