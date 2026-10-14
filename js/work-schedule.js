const TIME_PATTERN = /^\d{2}:\d{2}$/;

export function specialClosureTime(item) {
  const value = item?.closeTime || item?.time || "";
  return TIME_PATTERN.test(value) ? value : "";
}

export function findSpecialClosure(date, rows = []) {
  const closure = (Array.isArray(rows) ? rows : [])
    .find((item) => item?.date === date && specialClosureTime(item));
  if (!closure) return null;
  return { ...closure, closeTime: specialClosureTime(closure) };
}
