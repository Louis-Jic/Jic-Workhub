const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export function datePart(value) {
  const date = String(value || "").slice(0, 10);
  return DATE_PATTERN.test(date) ? date : "";
}

export function fullDayRangeValues({ startDate, endDate, workStart, workEnd }) {
  if (!DATE_PATTERN.test(startDate || "") || !DATE_PATTERN.test(endDate || "")) return null;
  if (!TIME_PATTERN.test(workStart || "") || !TIME_PATTERN.test(workEnd || "")) return null;
  if (endDate < startDate) return null;
  return {
    startValue: `${startDate}T${workStart}`,
    endValue: `${endDate}T${workEnd}`
  };
}
