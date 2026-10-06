import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adminSource = fs.readFileSync(new URL("../js/admin.js", import.meta.url), "utf8");
const calendarSource = fs.readFileSync(new URL("../js/calendar.js", import.meta.url), "utf8");
const calendarHtml = fs.readFileSync(new URL("../calendar.html", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../css/style.css", import.meta.url), "utf8");
const functionsSource = fs.readFileSync(new URL("../functions/src/index.js", import.meta.url), "utf8");

test("系統設定提供管理員公司活動新增、編輯與刪除功能", () => {
  assert.match(adminSource, /id="companyEventForm"/);
  assert.match(adminSource, /callSecureFunction\("saveCompanyEvent"/);
  assert.match(adminSource, /callSecureFunction\("deleteCompanyEvent"/);
  assert.match(adminSource, /公司活動與公告/);
});

test("公司活動清單可依年度與條件篩選並分頁", () => {
  assert.match(adminSource, /id="companyEventFilterYear"/);
  assert.match(adminSource, /id="companyEventFilterMonth"/);
  assert.match(adminSource, /id="companyEventFilterCategory"/);
  assert.match(adminSource, /id="companyEventFilterStatus"/);
  assert.match(adminSource, /id="companyEventFilterSearch"/);
  assert.match(adminSource, /const pageSize = 10/);
  assert.match(functionsSource, /event\.startDate <= yearEnd && event\.endDate >= yearStart/);
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
  assert.match(calendarSource, /calendar-legend-leave">已核准請假/);
  assert.match(calendarSource, /calendar-legend-company">公司活動/);
  assert.match(calendarSource, /calendar-company-event-inventory/);
  assert.match(calendarSource, /calendar-company-event-training/);
  assert.match(calendarSource, /calendar-company-event-meeting/);
  assert.match(calendarSource, /calendar-company-event-holiday/);
  assert.match(styles, /\.calendar-legend-company[\s\S]*?background:\s*#fef3c7/);
  assert.match(styles, /\.calendar-legend-inventory[\s\S]*?background:\s*#f3e8ff/);
  assert.match(styles, /\.calendar-legend-training[\s\S]*?background:\s*#dcfce7/);
  assert.match(styles, /\.calendar-legend-meeting[\s\S]*?background:\s*#cffafe/);
  assert.match(styles, /\.calendar-legend-holiday[\s\S]*?background:\s*#ffe4e6/);
});

test("行事曆使用同一個新版資源版本避免瀏覽器沿用舊配色", () => {
  const styleVersion = calendarHtml.match(/style\.css\?v=([^"']+)/)?.[1];
  const scriptVersion = calendarHtml.match(/calendar\.js\?v=([^"']+)/)?.[1];
  assert.ok(styleVersion);
  assert.equal(scriptVersion, styleVersion);
  assert.equal(styleVersion, "20261006-3");
});
