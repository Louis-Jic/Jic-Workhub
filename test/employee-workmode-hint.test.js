import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("員工管理保留工作型態選項但不顯示外勤提示", () => {
  const source = fs.readFileSync(new URL("../js/admin.js", import.meta.url), "utf8");
  const html = fs.readFileSync(new URL("../admin/employees.html", import.meta.url), "utf8");
  assert.match(source, /data-field="workMode"/);
  assert.match(source, /外勤（不限打卡據點與時段）/);
  assert.doesNotMatch(source, /外勤仍須 GPS 定位/);
  assert.match(html, /admin\.js\?v=20261014-1/);
});
