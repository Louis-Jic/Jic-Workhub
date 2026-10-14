"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { recentDates, selectMissingAttendanceCandidates, validCheckoutCorrectionTime } = require("../src/lib/missing-attendance");

const employee = { id: "u1" };
const shift = { name: "日班", workStart: "09:00", workEnd: "18:00" };
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
    attendance: [{ date: "2026-10-13", type: "checkIn" }, { date: "2026-10-13", type: "checkOut" }],
    leaves: [{ userId: "u1", date: "2026-10-12" }],
    leaveCoversShift
  });
  assert.deepEqual(candidates, [{ date: "2026-10-09", missingType: "checkIn", shiftName: "日班", workStart: "09:00", workEnd: "18:00" }]);
});

test("到期後顯示缺卡候選；排除指定休假日", () => {
  const candidates = selectMissingAttendanceCandidates({
    dates: ["2026-10-14", "2026-10-13"],
    now: new Date("2026-10-14T09:11:00+08:00"),
    employee, settings: { ...settings, holidayDates: ["2026-10-13"] }, shift,
    attendance: [], leaves: [], leaveCoversShift
  });
  assert.deepEqual(candidates, [{ date: "2026-10-14", missingType: "checkIn", shiftName: "日班", workStart: "09:00", workEnd: "18:00" }]);
});

test("已有簽到但漏簽退，於下班打卡時段結束後提供獨立申請", () => {
  const input = {
    dates: ["2026-10-02"], employee, settings: { ...settings, punchWindowMinutes: 13 }, shift,
    attendance: [{ date: "2026-10-02", type: "checkIn" }], leaves: [], leaveCoversShift
  };
  assert.deepEqual(selectMissingAttendanceCandidates({ ...input, now: new Date("2026-10-02T18:12:00+08:00") }), []);
  assert.deepEqual(selectMissingAttendanceCandidates({ ...input, now: new Date("2026-10-02T18:14:00+08:00") }), [
    { date: "2026-10-02", missingType: "checkOut", shiftName: "日班", workStart: "09:00", workEnd: "18:00" }
  ]);
});

test("已有簽退或公司提早下班時正確判斷漏簽退", () => {
  const base = {
    dates: ["2026-10-13"], now: new Date("2026-10-13T17:14:00+08:00"), employee,
    settings: { ...settings, specialClosureDates: [{ date: "2026-10-13", time: "17:00" }] },
    shift, leaves: [], leaveCoversShift
  };
  assert.deepEqual(selectMissingAttendanceCandidates({ ...base, attendance: [
    { date: "2026-10-13", type: "checkIn" }
  ] }), [{ date: "2026-10-13", missingType: "checkOut", shiftName: "日班", workStart: "09:00", workEnd: "17:00" }]);
  assert.deepEqual(selectMissingAttendanceCandidates({ ...base, attendance: [
    { date: "2026-10-13", type: "checkIn" }, { date: "2026-10-13", type: "checkOut" }
  ] }), []);
});

test("補登簽退時間必須晚於已存在的最後一次簽到", () => {
  const rows = [
    { type: "checkIn", timestamp: new Date("2026-10-02T09:00:00+08:00") },
    { type: "checkIn", timestamp: new Date("2026-10-02T13:00:00+08:00") }
  ];
  assert.equal(validCheckoutCorrectionTime([], "2026-10-02", "18:00"), false);
  assert.equal(validCheckoutCorrectionTime(rows, "2026-10-02", "12:00"), false);
  assert.equal(validCheckoutCorrectionTime(rows, "2026-10-02", "13:00"), false);
  assert.equal(validCheckoutCorrectionTime(rows, "2026-10-02", "18:00"), true);
});

test("缺卡案件不再由排程預先建立", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/index.js"), "utf8");
  assert.doesNotMatch(source, /exports\.createMissingAttendanceCases\s*=/);
  assert.match(source, /exports\.getMissingAttendanceCandidates\s*=/);
  assert.match(source, /exports\.submitExceptionReason\s*=/);
});
