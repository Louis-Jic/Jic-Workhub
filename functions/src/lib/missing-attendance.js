"use strict";

const { effectiveWorkEnd, isRestDay, taipeiDateTime, todayKeyTaipei } = require("../core");

function recentDates(now, days = 31) {
  const today = todayKeyTaipei(now);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(`${today}T12:00:00+08:00`);
    day.setUTCDate(day.getUTCDate() - index);
    return todayKeyTaipei(day);
  });
}

function selectMissingAttendanceCandidates({ dates, now, employee, settings, shift, attendance, leaves, leaveCoversShift }) {
  return dates.filter((date) => !isRestDay(date, settings)).flatMap((date) => {
    const dayRows = attendance.filter((row) => row.date === date);
    const hasCheckIn = dayRows.some((row) => row.type === "checkIn");
    const hasCheckOut = dayRows.some((row) => row.type === "checkOut");
    const workEnd = effectiveWorkEnd(date, shift, settings);
    if (hasCheckIn && !hasCheckOut) {
      const dueAt = new Date(taipeiDateTime(date, workEnd).getTime() + Number(settings.punchWindowMinutes || 13) * 60000);
      return now >= dueAt ? [{ date, missingType: "checkOut", shiftName: shift.name, workStart: shift.workStart, workEnd }] : [];
    }
    const dueAt = new Date(taipeiDateTime(date, shift.workStart).getTime() + Number(settings.lateGraceMinutes || 0) * 60000);
    return !hasCheckIn && now >= dueAt && !leaveCoversShift(leaves, employee.id, date, shift)
      ? [{ date, missingType: "checkIn", shiftName: shift.name, workStart: shift.workStart, workEnd }]
      : [];
  });
}

function validCheckoutCorrectionTime(rows, date, time) {
  const latestCheckIn = [...rows].reverse().find((row) => row.type === "checkIn");
  return Boolean(latestCheckIn && taipeiDateTime(date, time) > latestCheckIn.timestamp);
}

module.exports = { recentDates, selectMissingAttendanceCandidates, validCheckoutCorrectionTime };
