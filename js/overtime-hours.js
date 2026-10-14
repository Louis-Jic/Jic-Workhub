const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function fullDayOvertimeRangeValues({ startDate, endDate, workStart, workEnd }) {
  if (!DATE_PATTERN.test(startDate || "") || !DATE_PATTERN.test(endDate || "")) return null;
  if (!TIME_PATTERN.test(workStart || "") || !TIME_PATTERN.test(workEnd || "")) return null;
  if (endDate < startDate || workEnd <= workStart) return null;
  return {
    startValue: `${startDate}T${workStart}`,
    endValue: `${endDate}T${workEnd}`
  };
}

export function calculateDailyOvertimeHours(start, end, lunchStart = "12:00", lunchEnd = "13:00", dailyLimit = 8) {
  if (!(start instanceof Date) || !(end instanceof Date) || !Number.isFinite(start.getTime())
    || !Number.isFinite(end.getTime()) || end <= start) return 0;

  const [lunchStartHour, lunchStartMinute] = lunchStart.split(":").map(Number);
  const [lunchEndHour, lunchEndMinute] = lunchEnd.split(":").map(Number);
  const day = new Date(start);
  day.setHours(0, 0, 0, 0);
  let total = 0;

  while (day < end) {
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    const segmentStart = Math.max(start.getTime(), day.getTime());
    const segmentEnd = Math.min(end.getTime(), nextDay.getTime());
    if (segmentEnd > segmentStart) {
      const lunchFrom = new Date(day);
      const lunchTo = new Date(day);
      lunchFrom.setHours(lunchStartHour, lunchStartMinute, 0, 0);
      lunchTo.setHours(lunchEndHour, lunchEndMinute, 0, 0);
      const lunchHours = Math.max(0,
        Math.min(segmentEnd, lunchTo.getTime()) - Math.max(segmentStart, lunchFrom.getTime())
      ) / 36e5;
      total += Math.min(dailyLimit, Math.max(0, (segmentEnd - segmentStart) / 36e5 - lunchHours));
    }
    day.setDate(day.getDate() + 1);
  }

  return Number(total.toFixed(2));
}
