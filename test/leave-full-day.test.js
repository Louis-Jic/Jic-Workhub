import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { datePart, fullDayRangeValues } from "../js/leave-range.js";

test("整天請假會依班別組合開始與結束時間", () => {
  assert.deepEqual(fullDayRangeValues({
    startDate: "2026-10-13",
    endDate: "2026-10-13",
    workStart: "09:00",
    workEnd: "17:00"
  }), {
    startValue: "2026-10-13T09:00",
    endValue: "2026-10-13T17:00"
  });
});

test("整天請假拒絕結束日期早於開始日期", () => {
  assert.equal(fullDayRangeValues({
    startDate: "2026-10-14",
    endDate: "2026-10-13",
    workStart: "09:00",
    workEnd: "18:00"
  }), null);
  assert.equal(datePart("2026-10-13T09:00"), "2026-10-13");
});

test("請假表單提供整天模式與獨立日期欄位", () => {
  const source = fs.readFileSync(new URL("../js/leave.js", import.meta.url), "utf8");
  const html = fs.readFileSync(new URL("../leave.html", import.meta.url), "utf8");
  assert.match(source, /id="leaveFullDay"[^>]*checked/);
  assert.doesNotMatch(source, /leaveFullDayHelp/);
  assert.match(source, /id="leaveStartDate"/);
  assert.match(source, /id="leaveEndDate"/);
  assert.match(source, /effectiveShiftEnd\(endDate\)/);
  assert.match(html, /leave\.js\?v=20261014-2/);
});
