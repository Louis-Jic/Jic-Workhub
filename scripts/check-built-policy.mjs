import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] || "");
const environment = process.argv[3];
if (!new Set(["staging", "production"]).has(environment)) {
  throw new Error("Usage: node scripts/check-built-policy.mjs <directory> <staging|production>");
}

const legacyProjectId = ["jimmore", "workhub"].join("-");
const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const file = resolve(directory, name);
    if (statSync(file).isDirectory()) walk(file);
    else files.push(file);
  }
}
walk(root);

const leaked = files.filter((file) => {
  if (/\.(?:ico|png|jpg|jpeg|gif|woff2?)$/i.test(file)) return false;
  return readFileSync(file, "utf8").includes(legacyProjectId);
});
if (leaked.length) {
  throw new Error(`Built artifact contains the legacy Project ID: ${leaked.join(", ")}`);
}

const cnameExists = existsSync(resolve(root, "CNAME"));
if (environment === "staging" && cnameExists) {
  throw new Error("Staging artifact must not contain CNAME.");
}
if (environment === "production" && !cnameExists) {
  throw new Error("Production artifact must contain CNAME.");
}
if (!existsSync(resolve(root, "index.html"))) {
  throw new Error(`${environment} artifact is missing index.html.`);
}
if (!files.some((file) => /Jimmore_logo(?:-[\w-]+)?\.ico$/i.test(file))) {
  throw new Error(`${environment} artifact is missing Jimmore_logo.ico.`);
}

console.log(`Verified ${environment} artifact policy for ${files.length} files.`);
