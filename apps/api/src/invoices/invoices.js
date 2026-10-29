"use strict";
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicesController =
  exports.InvoiceService =
  exports.Reason =
  exports.InvoiceGenerate =
    void 0;
exports.invoiceWhere = invoiceWhere;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const express_1 = require("express");
const prisma_service_1 = require("../common/prisma.service");
const finance_1 = require("../common/finance");
const auth_1 = require("../auth/auth");
const query_1 = require("../common/query");
const { registrationDeadline } = require("../common/billing");
const { invoicePdf } = require("../reports/invoice");
class InvoiceGenerate {
  period;
}
exports.InvoiceGenerate = InvoiceGenerate;
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  InvoiceGenerate.prototype,
  "period",
  void 0,
);
class Reason {
  reason;
}
exports.Reason = Reason;
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    tslib_1.__metadata("design:type", String),
  ],
  Reason.prototype,
  "reason",
  void 0,
);
function invoiceWhere(q) {
  if (q.period) (0, finance_1.periodDates)(q.period);
  if (q.status && !Object.values(client_1.InvoiceStatus).includes(q.status))
    throw new common_1.BadRequestException(
      "Statusi i faturës është i pavlefshëm.",
    );
  return {
    ...(q.studentId ? { studentId: q.studentId } : {}),
    ...(q.courseId ? { courseId: q.courseId } : {}),
    ...(q.groupId ? { groupId: q.groupId } : {}),
    ...(q.period ? { period: q.period } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.search
      ? {
          OR: [
            { studentName: { contains: q.search, mode: "insensitive" } },
            { number: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
let InvoiceService = class InvoiceService {
  db;
  running = false;
  constructor(db) {
    this.db = db;
  }
  // Billing candidates are computed for review; background jobs never issue invoices.
  initial() {
    return this.scheduled();
  }
  async scheduled() {
    return { requiresApproval: true };
  }
};
exports.InvoiceService = InvoiceService;
tslib_1.__decorate(
  [
    (0, schedule_1.Timeout)(15000),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  InvoiceService.prototype,
  "initial",
  null,
);
tslib_1.__decorate(
  [
    (0, schedule_1.Cron)("0 10 * * * *", { timeZone: "Europe/Tirane" }),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  InvoiceService.prototype,
  "scheduled",
  null,
);
exports.InvoiceService = InvoiceService = tslib_1.__decorate(
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
  InvoiceService,
);
let InvoicesController = class InvoicesController {
  db;
  service;
  constructor(db, service) {
    this.db = db;
    this.service = service;
  }
  async list(q) {
    const where = invoiceWhere(q);
    const [total, items] = await this.db.$transaction([
      this.db.invoice.count({ where }),
      this.db.invoice.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: [{ period: "desc" }, { number: "desc" }],
        include: {
          allocations: {
            select: { payment: { select: { paidAt: true, reversedAt: true } } },
          },
        },
      }),
    ]);
    return (0, query_1.pagination)(
      total,
      q,
      items.map((i) => ({
        ...i,
        lastPaidAt:
          i.allocations
            .filter((a) => !a.payment.reversedAt)
            .map((a) => a.payment.paidAt)
            .sort((a, b) => b - a)[0] ?? null,
        allocations: undefined,
        balance: i.amount.minus(i.paidAmount).toFixed(2),
      })),
    );
  }
  generate(dto, req) {
    throw new common_1.BadRequestException(
      "Hapni listën Për aprovim dhe aprovoni secilën faturë me shumën përfundimtare.",
    );
  }
  async void(id, dto, req) {
    if (!dto.reason.trim())
      throw new common_1.BadRequestException("Shkruani arsyen.");
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) throw new common_1.NotFoundException("Fatura nuk u gjet.");
      if (invoice.status === "VOID" || invoice.paidAmount.gt(0))
        throw new common_1.BadRequestException(
          "Fatura e paguar ose e anuluar nuk mund të anulohet.",
        );
      const result = await tx.invoice.update({
        where: { id },
        data: { status: "VOID", voidReason: dto.reason },
      });
      await (0, finance_1.audit)(tx, req.user.id, "INVOICE_VOID", id);
      return result;
    });
  }
  async detail(id, req) {
    const invoice = await this.db.invoice.findUnique({
      where: { id },
      include: {
        student: { select: { address: true } },
        enrollment: { select: { startDate: true } },
        allocations: {
          include: {
            payment: { include: { user: { select: { name: true } } } },
          },
        },
      },
    });
    if (!invoice) throw new common_1.NotFoundException("Fatura nuk u gjet.");
    return {
      ...invoice,
      registrationDueDate: registrationDeadline(
        invoice.period,
        invoice.enrollment.startDate,
      ),
      canUpdateDeadline:
        req?.user?.role === "ADMIN" && invoice.status !== "VOID",
      balance: invoice.amount.minus(invoice.paidAmount).toFixed(2),
    };
  }
  async correctDeadline(id, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id },
        include: { enrollment: { select: { startDate: true } } },
      });
      if (!invoice) throw new common_1.NotFoundException("Fatura nuk u gjet.");
      if (invoice.status === "VOID")
        throw new common_1.BadRequestException("Fatura është e anuluar.");
      const dueDate = (0, finance_1.calendarDate)(
        registrationDeadline(invoice.period, invoice.enrollment.startDate),
      );
      if (dueDate.getTime() === invoice.dueDate.getTime()) return { dueDate };
      await tx.invoice.update({ where: { id }, data: { dueDate } });
      await (0, finance_1.audit)(
        tx,
        req.user.id,
        "INVOICE_DEADLINE_UPDATE",
        id,
      );
      return { dueDate };
    });
  }
  async document(id, res) {
    const invoice = await this.detail(id);
    const data = await invoicePdf(invoice);
    res
      .type("application/pdf")
      .attachment(invoice.number + ".pdf")
      .send(data);
  }
};
exports.InvoicesController = InvoicesController;
tslib_1.__decorate(
  [
    (0, common_1.Get)(":id"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:paramtypes", [String, Object]),
  ],
  InvoicesController.prototype,
  "detail",
  null,
);

tslib_1.__decorate(
  [
    (0, common_1.Get)(),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_c =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _c
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  InvoicesController.prototype,
  "list",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Post)("generate"),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      InvoiceGenerate,
      typeof (_d =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _d
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  InvoicesController.prototype,
  "generate",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Post)(":id/void"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__param(2, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      String,
      Reason,
      typeof (_e =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _e
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  InvoicesController.prototype,
  "void",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)(":id/pdf"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Res)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      String,
      typeof (_f =
        typeof express_1.Response !== "undefined" && express_1.Response) ===
      "function"
        ? _f
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  InvoicesController.prototype,
  "document",
  null,
);
exports.InvoicesController = InvoicesController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("invoices"),
    (0, auth_1.Roles)("ADMIN", "FINANCE"),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_b =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _b
        : Object,
      InvoiceService,
    ]),
  ],
  InvoicesController,
);

// Existing invoices are only corrected through an explicit, audited administrator action.
tslib_1.__decorate(
  [
    (0, common_1.Post)(":id/registration-deadline"),
    (0, auth_1.Roles)("ADMIN"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:paramtypes", [String, Object]),
  ],
  InvoicesController.prototype,
  "correctDeadline",
  null,
);
