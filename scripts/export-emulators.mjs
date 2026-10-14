import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const projectId = "demo-jic-workhub-staging";
const projectRoot = process.cwd();
const firebaseCli = join(projectRoot, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
const exportPath = join(projectRoot, ".firebase", "local-emulator-data");

function completeFallbackExports() {
  return readdirSync(projectRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("firebase-export-"))
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(projectRoot, name, "firebase-export-metadata.json")));
}

const exportsBefore = new Set(completeFallbackExports());
const result = spawnSync(process.execPath, [
  firebaseCli,
  "emulators:export",
  exportPath,
  "--project", projectId,
  "--force"
], { stdio: "inherit" });

if (result.status === 0) process.exit(0);

const windowsFallback = completeFallbackExports()
  .filter((name) => !exportsBefore.has(name))
  .sort()
  .at(-1);

if (process.platform === "win32" && windowsFallback) {
  console.log(`Windows 目錄交換失敗，已保留完整本機快照：${windowsFallback}`);
  process.exit(0);
}

process.exit(result.status ?? 1);
