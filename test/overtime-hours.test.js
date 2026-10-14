import test from "node:test";
import assert from "node:assert/strict";

import { calculateDailyOvertimeHours, fullDayOvertimeRangeValues } from "../js/overtime-hours.js";

test("跨週末兩天加班逐日計算為 16 小時", () => {
  assert.equal(calculateDailyOvertimeHours(
    new Date(2026, 9, 17, 9),
    new Date(2026, 9, 18, 18)
  ), 16);
});

test("單日扣除午休後最多 8 小時，短時間仍依實際時數", () => {
  assert.equal(calculateDailyOvertimeHours(
    new Date(2026, 9, 17, 8),
    new Date(2026, 9, 17, 20)
  ), 8);
  assert.equal(calculateDailyOvertimeHours(
    new Date(2026, 9, 17, 11),
    new Date(2026, 9, 17, 14)
  ), 2);
});

test("整天模式依班別建立跨日時間範圍並拒絕反向日期", () => {
  assert.deepEqual(fullDayOvertimeRangeValues({
    startDate: "2026-10-17",
    endDate: "2026-10-18",
    workStart: "09:00",
    workEnd: "18:00"
  }), {
    startValue: "2026-10-17T09:00",
    endValue: "2026-10-18T18:00"
  });
  assert.equal(fullDayOvertimeRangeValues({
    startDate: "2026-10-18",
    endDate: "2026-10-17",
    workStart: "09:00",
    workEnd: "18:00"
  }), null);
});
