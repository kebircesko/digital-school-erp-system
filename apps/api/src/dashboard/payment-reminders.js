const { calendarDate } = require("../common/finance");
const { BadRequestException } = require("@nestjs/common");

// Date-only UTC arithmetic keeps calendar windows stable across DST changes.
async function paymentReminders(db, day, sort = "dueDate:asc") {
  if (typeof sort !== "string")
    throw new BadRequestException("Renditja është e pavlefshme.");
  const [key, direction] = sort.split(":");
  if (
    !["studentName", "dueDate", "days", "balance", "number"].includes(key) ||
    !["asc", "desc"].includes(direction)
  )
    throw new BadRequestException("Renditja është e pavlefshme.");
  const today = calendarDate(day);
  const end = new Date(today.getTime() + 7 * 86400000);
  const open = { status: { in: ["UNPAID", "PARTIAL"] } };
  async function group(dueDate) {
    const where = { ...open, dueDate };
    const total = await db.invoice.count({ where });
    let items = await db.invoice.findMany({
      where,
      orderBy: [
        { [key === "balance" || key === "days" ? "dueDate" : key]: direction },
        { id: "asc" },
      ],
      ...(key !== "balance" ? { take: 20 } : {}),
      select: {
        id: true,
        studentId: true,
        number: true,
        studentName: true,
        courseName: true,
        period: true,
        dueDate: true,
        amount: true,
        paidAmount: true,
        status: true,
        student: { select: { parentName: true, parentPhone: true } },
      },
    });
    if (key === "balance") {
      items.sort(
        (a, b) =>
          a.amount
            .minus(a.paidAmount)
            .comparedTo(b.amount.minus(b.paidAmount)) *
          (direction === "asc" ? 1 : -1),
      );
      items = items.slice(0, 20);
    }
    return {
      total,
      items: items.map((invoice) => ({
        ...invoice,
        balance: invoice.amount.minus(invoice.paidAmount).toFixed(2),
      })),
    };
  }
  return {
    upcoming: await group({ gte: today, lte: end }),
    overdue: await group({ lt: today }),
  };
}

module.exports = { paymentReminders };
