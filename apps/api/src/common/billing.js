const { periodDates } = require("./finance");
const { ConflictException } = require("@nestjs/common");

// Use the enrollment's date-only UTC day, clamping short months without rollover.
function registrationDeadline(period, startDate) {
  const { first, last } = periodDates(period);
  const day = new Date(startDate).getUTCDate();
  if (!Number.isInteger(day))
    throw new Error("Data e regjistrimit është e pavlefshme.");
  first.setUTCDate(Math.min(day, last.getUTCDate()));
  return first.toISOString().slice(0, 10);
}

function checkOldestMonths(openInvoices, allocations) {
  const selected = new Map(
    allocations.map((row) => [row.invoiceId, row.amount]),
  );
  for (const target of openInvoices.filter((row) => selected.has(row.id))) {
    const older = openInvoices.find(
      (row) =>
        row.period < target.period &&
        (!selected.has(row.id) ||
          selected.get(row.id).lt(row.amount.minus(row.paidAmount))),
    );
    if (older)
      throw new ConflictException(
        `Mbyllni fillimisht muajin ${older.period} (${older.number}). Mbetja: ${older.amount.minus(older.paidAmount).toFixed(2)} EUR.`,
      );
  }
}
module.exports = { registrationDeadline, checkOldestMonths };
