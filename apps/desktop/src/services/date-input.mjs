export function parseDateInput(value) {
  const text = (value ?? "").trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const iso = match
    ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`
    : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number(iso.slice(0, 4)) < 1900)
    return null;
  const date = new Date(iso + "T12:00:00Z");
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
export function displayInputDate(value) {
  const iso = parseDateInput(value);
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
}
export function calendarCells(month) {
  const first = new Date(month + "-01T12:00:00Z");
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first);
    day.setUTCDate(1 - offset + index);
    return day.toISOString().slice(0, 10);
  });
}
export function changeMonth(month, offset) {
  const date = new Date(month + "-01T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
