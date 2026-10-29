"use strict";
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = exports.ReportService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const express_1 = require("express");
const prisma_service_1 = require("../common/prisma.service");
const auth_1 = require("../auth/auth");
const finance_1 = require("../common/finance");
const query_1 = require("../common/query");
const invoices_1 = require("../invoices/invoices");
const documents_1 = require("./documents");
let ReportService = class ReportService {
  db;
  constructor(db) {
    this.db = db;
  }
  async debts(q) {
    const invoices = await this.db.invoice.findMany({
      where: {
        ...(0, invoices_1.invoiceWhere)({ ...q, status: undefined }),
        status: { in: ["UNPAID", "PARTIAL"] },
      },
      orderBy: [{ studentName: "asc" }, { period: "asc" }],
    });
    const rows = new Map();
    for (const i of invoices) {
      const row = rows.get(i.studentId) ?? {
        studentId: i.studentId,
        studentName: i.studentName,
        amount: new client_1.Prisma.Decimal(0),
        invoices: [],
      };
      row.amount = row.amount.plus(i.amount.minus(i.paidAmount));
      row.invoices.push(i);
      rows.set(i.studentId, row);
    }
    return {
      total: invoices
        .reduce(
          (sum, i) => sum.plus(i.amount.minus(i.paidAmount)),
          new client_1.Prisma.Decimal(0),
        )
        .toFixed(2),
      items: [...rows.values()].map((r) => ({
        ...r,
        amount: r.amount.toFixed(2),
      })),
    };
  }
  async financial(q) {
    const from = (0, finance_1.calendarDate)(
        q.from ?? (0, finance_1.today)().slice(0, 7) + "-01",
      ),
      to = (0, finance_1.calendarDate)(q.to ?? (0, finance_1.today)());
    if (from > to)
      throw new (
        await Promise.resolve().then(() =>
          tslib_1.__importStar(require("@nestjs/common")),
        )
      ).BadRequestException("Data e fillimit duhet të jetë para përfundimit.");
    const allocations = await this.db.paymentAllocation.findMany({
      where: {
        payment: {
          reversedAt: null,
          paidAt: { gte: from, lte: to },
          ...(q.method ? { method: q.method } : {}),
        },
        invoice: {
          ...(q.courseId ? { courseId: q.courseId } : {}),
          ...(q.groupId ? { groupId: q.groupId } : {}),
        },
      },
      include: {
        payment: { include: { user: { select: { name: true } } } },
        invoice: true,
      },
      orderBy: { payment: { paidAt: "asc" } },
    });
    const daily = new Map(),
      courses = new Map(),
      groups = new Map(),
      methods = new Map();
    const courseNames = new Map(),
      groupNames = new Map();
    let total = new client_1.Prisma.Decimal(0);
    const rows = allocations.map((a) => {
      courseNames.set(a.invoice.courseId, a.invoice.courseName);
      groupNames.set(a.invoice.groupId, a.invoice.groupName);
      const day = a.payment.paidAt.toISOString().slice(0, 10);
      for (const [map, key] of [
        [daily, day],
        [courses, a.invoice.courseId],
        [groups, a.invoice.groupId],
        [methods, a.payment.method],
      ])
        map.set(
          key,
          (map.get(key) ?? new client_1.Prisma.Decimal(0)).plus(a.amount),
        );
      total = total.plus(a.amount);
      return {
        payment: a.payment.number,
        invoice: a.invoice.number,
        student: a.invoice.studentName,
        studentId: a.invoice.studentId,
        course: a.invoice.courseName,
        group: a.invoice.groupName,
        date: day,
        method: a.payment.method,
        amount: a.amount.toFixed(2),
        user: a.payment.user.name,
      };
    });
    const list = (map) =>
      [...map.entries()].map(([name, amount]) => ({
        name,
        amount: amount.toFixed(2),
      }));
    return {
      from: q.from ?? (0, finance_1.today)().slice(0, 7) + "-01",
      to: q.to ?? (0, finance_1.today)(),
      total: total.toFixed(2),
      daily: list(daily),
      courses: list(courses).map((r) => ({
        ...r,
        id: r.name,
        name: courseNames.get(r.name),
      })),
      groups: list(groups).map((r) => ({
        ...r,
        id: r.name,
        name: groupNames.get(r.name),
      })),
      methods: list(methods),
      rows,
    };
  }
};
exports.ReportService = ReportService;
exports.ReportService = ReportService = tslib_1.__decorate(
  [
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_a =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _a
        : Object,
    ]),
  ],
  ReportService,
);
let ReportsController = class ReportsController {
  reports;
  constructor(reports) {
    this.reports = reports;
  }
  debts(q) {
    return this.reports.debts(q);
  }
  financial(q) {
    return this.reports.financial(q);
  }
  async workbook(q, res) {
    const report = await this.reports.financial(q);
    const data = await (0, documents_1.excel)(
      "Pagesat",
      [
        "Pagesa",
        "Fatura",
        "Nxënësi",
        "Kursi",
        "Grupi",
        "Data",
        "Metoda",
        "Shuma EUR",
        "Përdoruesi",
      ],
      report.rows.map((r) => [
        r.payment,
        r.invoice,
        r.student,
        r.course,
        r.group,
        r.date,
        r.method === "CASH" ? "Para të gatshme" : "Bankë",
        r.amount,
        r.user,
      ]),
    );
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment("raport-financiar.xlsx")
      .send(data);
  }
  async document(q, res) {
    const report = await this.reports.financial(q);
    res
      .type("application/pdf")
      .attachment("raport-financiar.pdf")
      .send(
        await (0, documents_1.pdf)(
          "Raport financiar",
          `${report.from} - ${report.to}`,
          [
            ["Totali i arkëtuar", report.total + " EUR"],
            ...report.rows.map((r) => [
              `${r.date} · ${r.payment}\n${r.student}\n${r.course} / ${r.group}`,
              r.amount + " EUR",
            ]),
          ],
        ),
      );
  }
  async debtExcel(q, res) {
    const report = await this.reports.debts(q);
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment("borxhet.xlsx")
      .send(
        await (0, documents_1.excel)(
          "Borxhet",
          ["Nxënësi", "Borxhi EUR", "Fatura"],
          report.items.map((r) => [r.studentName, r.amount, r.invoices.length]),
        ),
      );
  }
  async debtPdf(q, res) {
    const report = await this.reports.debts(q);
    res
      .type("application/pdf")
      .attachment("borxhet.pdf")
      .send(
        await (0, documents_1.pdf)(
          "Detyrimet e nxënësve",
          q.period ?? "Të gjitha periudhat",
          [
            ["Borxhi total", report.total + " EUR"],
            ...report.items.map((r) => [r.studentName, r.amount + " EUR"]),
          ],
        ),
      );
  }
};
exports.ReportsController = ReportsController;
tslib_1.__decorate(
  [
    (0, common_1.Get)("debts"),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_b =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _b
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  ReportsController.prototype,
  "debts",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)("financial"),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_c =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _c
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  ReportsController.prototype,
  "financial",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)("financial.xlsx"),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__param(1, (0, common_1.Res)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_d =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _d
        : Object,
      typeof (_e =
        typeof express_1.Response !== "undefined" && express_1.Response) ===
      "function"
        ? _e
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  ReportsController.prototype,
  "workbook",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)("financial.pdf"),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__param(1, (0, common_1.Res)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_f =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _f
        : Object,
      typeof (_g =
        typeof express_1.Response !== "undefined" && express_1.Response) ===
      "function"
        ? _g
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  ReportsController.prototype,
  "document",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)("debts.xlsx"),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__param(1, (0, common_1.Res)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_h =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _h
        : Object,
      typeof (_j =
        typeof express_1.Response !== "undefined" && express_1.Response) ===
      "function"
        ? _j
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  ReportsController.prototype,
  "debtExcel",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)("debts.pdf"),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__param(1, (0, common_1.Res)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_k =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _k
        : Object,
      typeof (_l =
        typeof express_1.Response !== "undefined" && express_1.Response) ===
      "function"
        ? _l
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  ReportsController.prototype,
  "debtPdf",
  null,
);
exports.ReportsController = ReportsController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("reports"),
    (0, auth_1.Roles)("ADMIN", "FINANCE"),
    tslib_1.__metadata("design:paramtypes", [ReportService]),
  ],
  ReportsController,
);
