"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { recentDates, selectMissingAttendanceCandidates } = require("../src/lib/missing-attendance");

const employee = { id: "u1" };
const shift = { name: "日班", workStart: "09:00" };
const settings = { lateGraceMinutes: 10 };
const leaveCoversShift = (leaves, userId, date) => leaves.some((row) => row.userId === userId && row.date === date);

test("最近日期依台北日期計算並跨月", () => {
  assert.deepEqual(recentDates(new Date("2026-10-01T01:00:00+08:00"), 3), [
    "2026-10-01", "2026-09-30", "2026-09-29"
  ]);
});

test("未打卡候選只包含到期、工作日且沒有簽到或全日請假的日期", () => {
  const candidates = selectMissingAttendanceCandidates({
    dates: ["2026-10-14", "2026-10-13", "2026-10-12", "2026-10-11", "2026-10-10", "2026-10-09"],
    now: new Date("2026-10-14T09:09:00+08:00"),
    employee, settings, shift,
    attendance: [{ date: "2026-10-13", type: "checkIn" }],
    leaves: [{ userId: "u1", date: "2026-10-12" }],
    leaveCoversShift
  });
  assert.deepEqual(candidates, [{ date: "2026-10-09", shiftName: "日班", workStart: "09:00" }]);
});

test("到期後顯示缺卡候選；排除指定休假日", () => {
  const candidates = selectMissingAttendanceCandidates({
    dates: ["2026-10-14", "2026-10-13"],
    now: new Date("2026-10-14T09:11:00+08:00"),
    employee, settings: { ...settings, holidayDates: ["2026-10-13"] }, shift,
    attendance: [], leaves: [], leaveCoversShift
  });
  assert.deepEqual(candidates, [{ date: "2026-10-14", shiftName: "日班", workStart: "09:00" }]);
});

test("缺卡案件不再由排程預先建立", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/index.js"), "utf8");
  assert.doesNotMatch(source, /exports\.createMissingAttendanceCases\s*=/);
  assert.match(source, /exports\.getMissingAttendanceCandidates\s*=/);
  assert.match(source, /exports\.submitExceptionReason\s*=/);
});
