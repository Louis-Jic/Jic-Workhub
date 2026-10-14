import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("加班申請單維持 A4 並使用精簡的表格列高", () => {
  const source = fs.readFileSync(new URL("../js/overtime.js", import.meta.url), "utf8");
  const html = fs.readFileSync(new URL("../overtime.html", import.meta.url), "utf8");

  assert.match(source, /@page \{ size: A4 portrait; margin: 9mm 12mm; \}/);
  assert.match(source, /html, body \{ width: 210mm; min-height: 297mm; \}/);
  assert.match(source, /\.sheet \{ width: 186mm;/);
  assert.match(source, /\.form-copy \{ min-height: 131mm;/);
  assert.match(source, /\.description \{ height: 23mm;/);
  assert.match(source, /\.signature \{ text-align: center; \}/);
  assert.doesNotMatch(source, /\.signature \{[^}]*height:/);
  assert.match(html, /overtime\.js\?v=20261014-4/);
});
