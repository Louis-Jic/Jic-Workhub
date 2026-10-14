import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/start-emulators.mjs", import.meta.url), "utf8");
const exportSource = fs.readFileSync(new URL("../scripts/export-emulators.mjs", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Firebase Emulator 啟動時會載入已保存的本機資料", () => {
  assert.match(source, /firebase-export-metadata\.json/);
  assert.match(source, /emulatorArgs\.push\("--import", savedEmulatorData\)/);
  assert.match(source, /entry\.name\.startsWith\("firebase-export-"\)/);
});

test("Firebase Emulator 關閉及手動匯出時會保存本機資料", () => {
  assert.match(source, /emulatorArgs\.push\("--export-on-exit", emulatorDataDir\)/);
  assert.equal(packageJson.scripts["emulators:export"], "node scripts/export-emulators.mjs");
  assert.match(exportSource, /Windows 目錄交換失敗，已保留完整本機快照/);
});
