"use strict";
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma.service");
const auth_1 = require("../auth/auth");
const finance_1 = require("../common/finance");
const { paymentReminders } = require("./payment-reminders");
let DashboardController = class DashboardController {
  db;
  constructor(db) {
    this.db = db;
  }
  reminders() {
    return this.db.$transaction(
      (tx) => paymentReminders(tx, (0, finance_1.today)()),
      {
        isolationLevel:
          client_1.Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
  async get(req) {
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
        const day = (0, finance_1.today)(),
          month = day.slice(0, 7),
          year = day.slice(0, 4);
        const sum = async (from) =>
          (
            await tx.payment.aggregate({
              where: {
                reversedAt: null,
                paidAt: {
                  gte: (0, finance_1.calendarDate)(from),
                  lte: (0, finance_1.calendarDate)(day),
                },
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
        const outstanding = (debt._sum.amount ?? new client_1.Prisma.Decimal(0))
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
              gte: (0, finance_1.calendarDate)(year + "-01-01"),
              lte: (0, finance_1.calendarDate)(day),
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
          bucket.amount = new client_1.Prisma.Decimal(bucket.amount)
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
            reminders: await paymentReminders(tx, day),
          },
        };
      },
      {
        isolationLevel:
          client_1.Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
};
exports.DashboardController = DashboardController;
tslib_1.__decorate(
  [
    (0, common_1.Get)("payment-reminders"),
    (0, auth_1.Roles)("ADMIN", "FINANCE"),
  ],
  DashboardController.prototype,
  "reminders",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)(),
    tslib_1.__param(0, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_b =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _b
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  DashboardController.prototype,
  "get",
  null,
);
exports.DashboardController = DashboardController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("dashboard"),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_a =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _a
        : Object,
    ]),
  ],
  DashboardController,
);
