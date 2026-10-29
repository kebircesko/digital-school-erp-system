export function calendarDay(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tirane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const date = (value) => {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
};

export function paymentDeadline(invoice, day = calendarDay()) {
  if (!["UNPAID", "PARTIAL"].includes(invoice.status)) return null;
  if (!invoice.dueDate) return null;
  const days = Math.round(
    (Date.parse(String(invoice.dueDate).slice(0, 10) + "T00:00:00Z") -
      Date.parse(day + "T00:00:00Z")) /
      86400000,
  );
  if (!Number.isFinite(days)) return null;
  return {
    days,
    tone: days < 0 ? "overdue" : days <= 7 ? "soon" : "later",
    label:
      days < 0
        ? `Vonesë ${Math.abs(days)} ditë`
        : days === 0
          ? "Afati sot"
          : days === 1
            ? "Mbetet 1 ditë"
            : `Mbeten ${days} ditë`,
  };
}

export function monthLabel(period) {
  const value = new Intl.DateTimeFormat("sq-AL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(period + "-01T12:00:00Z"));
  return value.charAt(0).toLocaleUpperCase("sq-AL") + value.slice(1);
}
