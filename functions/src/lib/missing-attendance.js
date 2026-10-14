"use strict";

const { isRestDay, taipeiDateTime, todayKeyTaipei } = require("../core");

function recentDates(now, days = 31) {
  const today = todayKeyTaipei(now);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(`${today}T12:00:00+08:00`);
    day.setUTCDate(day.getUTCDate() - index);
    return todayKeyTaipei(day);
  });
}

function selectMissingAttendanceCandidates({ dates, now, employee, settings, shift, attendance, leaves, leaveCoversShift }) {
  return dates.filter((date) => !isRestDay(date, settings)).filter((date) => {
    const dueAt = new Date(taipeiDateTime(date, shift.workStart).getTime() + Number(settings.lateGraceMinutes || 0) * 60000);
    return now >= dueAt
      && !attendance.some((row) => row.date === date && row.type === "checkIn")
      && !leaveCoversShift(leaves, employee.id, date, shift);
  }).map((date) => ({ date, shiftName: shift.name, workStart: shift.workStart }));
}

module.exports = { recentDates, selectMissingAttendanceCandidates };
