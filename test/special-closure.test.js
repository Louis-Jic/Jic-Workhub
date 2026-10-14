import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { findSpecialClosure, specialClosureTime } from "../js/work-schedule.js";

test("特殊提早下班同時接受 closeTime 與年度行事曆 time 欄位", () => {
  assert.equal(specialClosureTime({ closeTime: "17:00" }), "17:00");
  assert.equal(specialClosureTime({ time: "17:00" }), "17:00");
  assert.equal(findSpecialClosure("2026-10-13", [
    { date: "2026-10-13", time: "17:00", reason: "颱風天提早下班" }
  ])?.closeTime, "17:00");
});

test("無效或不同日期的提早下班設定不會套用", () => {
  assert.equal(specialClosureTime({ time: "5pm" }), "");
  assert.equal(findSpecialClosure("2026-10-14", [
    { date: "2026-10-13", time: "17:00" }
  ]), null);
});

test("管理報表與員工打卡頁共用相同的特殊下班解析", () => {
  const adminSource = fs.readFileSync(new URL("../js/admin.js", import.meta.url), "utf8");
  const attendanceSource = fs.readFileSync(new URL("../js/attendance.js", import.meta.url), "utf8");
  assert.match(adminSource, /findSpecialClosure\(date, settings\.specialClosureDates\)/);
  assert.match(attendanceSource, /findSpecialClosure\(date, settings\.specialClosureDates\)/);
});
