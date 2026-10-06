import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adminSource = fs.readFileSync(new URL("../js/admin.js", import.meta.url), "utf8");
const calendarSource = fs.readFileSync(new URL("../js/calendar.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
const functionsSource = fs.readFileSync(new URL("../functions/src/index.js", import.meta.url), "utf8");

test("系統設定提供管理員公司活動新增、編輯與刪除功能", () => {
  assert.match(adminSource, /id="companyEventForm"/);
  assert.match(adminSource, /callSecureFunction\("saveCompanyEvent"/);
  assert.match(adminSource, /callSecureFunction\("deleteCompanyEvent"/);
  assert.match(adminSource, /公司活動與公告/);
});

test("公司活動類型在系統設定渲染前完成初始化", () => {
  const labelsIndex = adminSource.indexOf("const COMPANY_EVENT_LABELS");
  const settingsDispatchIndex = adminSource.indexOf('if (mode === "settings") await renderSettings()');
  assert.ok(labelsIndex >= 0);
  assert.ok(settingsDispatchIndex >= 0);
  assert.ok(labelsIndex < settingsDispatchIndex);
});

test("團隊行事曆回傳並顯示公司活動", () => {
  assert.match(functionsSource, /db\.collection\("companyEvents"\)\.get\(\)/);
  assert.match(functionsSource, /companyEvents,/);
  assert.match(calendarSource, /allCompanyEvents/);
  assert.match(calendarSource, /data-company-event-index/);
  assert.match(calendarSource, /openCompanyEventDetail/);
});

test("公司活動與請假使用不同顏色", () => {
  assert.match(calendarSource, /text-bg-primary">已核准請假/);
  assert.match(calendarSource, /text-bg-warning">公司活動/);
  assert.match(styles, /\.calendar-event\.calendar-company-event[\s\S]*?background:\s*#ffedd5/);
});
