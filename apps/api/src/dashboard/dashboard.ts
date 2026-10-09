import { Controller, Get, Req } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { AuthRequest } from "../auth/auth";
import { calendarDate, today } from "../common/finance";
@Controller("dashboard")
export class DashboardController {
  constructor(private db: PrismaService) {}
  @Get() async get(@Req() req: AuthRequest) {
    return this.db.$transaction(
      async (tx) => {
        const total = await tx.student.count(),
          active = await tx.student.count({ where: { status: "ACTIVE" } }),
          inactive = total - active,
          recent = await tx.student.findMany({
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take: 5,
          });
        const courses = await tx.course.count(),
          groups = await tx.group.count();
        const basic = { total, active, inactive, recent, courses, groups };
        if (req.user.role === "INSTRUCTOR") return basic;
        const day = today(),
          month = day.slice(0, 7),
          year = day.slice(0, 4);
        const sum = async (from: string) =>
          (
            await tx.payment.aggregate({
              where: {
                reversedAt: null,
                paidAt: { gte: calendarDate(from), lte: calendarDate(day) },
              },
              _sum: { amount: true },
            })
          )._sum.amount?.toFixed(2) ?? "0.00";
        const daily = await sum(day),
          monthly = await sum(month + "-01"),
          yearly = await sum(year + "-01-01");
        const debt = await tx.invoice.aggregate({
          where: { status: { in: ["UNPAID", "PARTIAL"] } },
          _sum: { amount: true, paidAmount: true },
        });
        const outstanding = (debt._sum.amount ?? new Prisma.Decimal(0))
          .minus(debt._sum.paidAmount ?? 0)
          .toFixed(2);
        const paid = await tx.invoice.count({ where: { status: "PAID" } }),
          unpaid = await tx.invoice.count({
            where: { status: { in: ["UNPAID", "PARTIAL"] } },
          });
        const payments = await tx.payment.findMany({
          where: {
            reversedAt: null,
            paidAt: {
              gte: calendarDate(year + "-01-01"),
              lte: calendarDate(day),
            },
          },
          select: { paidAt: true, amount: true },
        });
        const chart = Array.from({ length: 12 }, (_, i) => ({
          month: `${year}-${String(i + 1).padStart(2, "0")}`,
          amount: "0.00",
        }));
        for (const p of payments) {
          const bucket = chart[p.paidAt.getUTCMonth()];
          bucket.amount = new Prisma.Decimal(bucket.amount)
            .plus(p.amount)
            .toFixed(2);
        }
        return {
          ...basic,
          financial: {
            daily,
            monthly,
            yearly,
            outstanding,
            paid,
            unpaid,
            chart,
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
