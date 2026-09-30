import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";

const root = resolve(process.argv[2] || ".");
const excludedDirectories = new Set([".git", ".firebase", "node_modules"]);
if (!/[\\/]dist$/i.test(root)) excludedDirectories.add("dist");
if (!/[\\/]dist-staging$/i.test(root)) excludedDirectories.add("dist-staging");
const files = [];

function walk(directory) {
  for (const name of readdirSync(directory)) {
    if (excludedDirectories.has(name)) continue;
    const absolute = resolve(directory, name);
    if (statSync(absolute).isDirectory()) walk(absolute);
    else files.push(absolute);
  }
}

function localTarget(fromFile, reference) {
  const clean = reference.split(/[?#]/, 1)[0];
  if (!clean || /^(?:[a-z]+:|#|\/\/)/i.test(clean) || clean.includes("${")) return null;
  return clean.startsWith("/") ? resolve(root, clean.slice(1)) : resolve(dirname(fromFile), clean);
}

walk(root);
const missing = [];

for (const file of files) {
  const extension = extname(file).toLowerCase();
  if (![".html", ".css", ".js", ".mjs"].includes(extension)) continue;
  const source = readFileSync(file, "utf8");
  const patterns = [];
  if (extension === ".html") patterns.push(/(?:src|href)=["']([^"']+)["']/g);
  if (extension === ".css") patterns.push(/url\(\s*["']?([^"')]+)["']?\s*\)/g);
  if ([".js", ".mjs"].includes(extension)) {
    patterns.push(/(?:from\s*|import\s*)["'](\.{1,2}\/[^"']+)["']/g);
    patterns.push(/new URL\(["'](\.{1,2}\/[^"']+)["'],\s*import\.meta\.url\)/g);
  }
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const target = localTarget(file, match[1]);
      if (target && !existsSync(target)) missing.push(`${file} -> ${match[1]}`);
    }
  }
}

if (missing.length) {
  console.error(`Missing local assets under ${root}:\n${missing.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Verified ${files.length} files under ${root}; all local references resolve.`);
}

if (root.endsWith(`${process.platform === "win32" ? "\\" : "/"}dist`)) {
  for (const required of ["CNAME", "index.html", "login.html"]) {
    if (!existsSync(resolve(root, required))) {
      console.error(`Built site is missing ${required}.`);
      process.exitCode = 1;
    }
  }
  const hasLogo = files.some((file) => /Jimmore_logo(?:-[\w-]+)?\.ico$/i.test(file));
  if (!hasLogo) {
    console.error("Built site is missing Jimmore_logo.ico.");
    process.exitCode = 1;
  }
}
