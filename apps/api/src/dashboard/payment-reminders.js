const { calendarDate } = require("../common/finance");

// Date-only UTC arithmetic keeps calendar windows stable across DST changes.
async function paymentReminders(db, day) {
  const today = calendarDate(day);
  const end = new Date(today.getTime() + 7 * 86400000);
  const open = { status: { in: ["UNPAID", "PARTIAL"] } };
  async function group(dueDate) {
    const where = { ...open, dueDate };
    const total = await db.invoice.count({ where });
    const items = await db.invoice.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      take: 20,
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
      },
    });
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
