"use strict";
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsController = exports.PaymentDto = void 0;
const tslib_1 = require("tslib");
const { checkOldestMonths } = require("../common/billing");
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
const express_1 = require("express");
const prisma_service_1 = require("../common/prisma.service");
const finance_1 = require("../common/finance");
const auth_1 = require("../auth/auth");
const query_1 = require("../common/query");
const documents_1 = require("../reports/documents");
const invoices_1 = require("../invoices/invoices");
class AllocationDto {
  invoiceId;
  amount;
}
tslib_1.__decorate(
  [(0, class_validator_1.IsUUID)(), tslib_1.__metadata("design:type", String)],
  AllocationDto.prototype,
  "invoiceId",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  AllocationDto.prototype,
  "amount",
  void 0,
);
class PaymentDto {
  studentId;
  idempotencyKey;
  amount;
  method;
  paidAt;
  notes;
  allocations;
}
exports.PaymentDto = PaymentDto;
tslib_1.__decorate(
  [(0, class_validator_1.IsUUID)(), tslib_1.__metadata("design:type", String)],
  PaymentDto.prototype,
  "studentId",
  void 0,
);
tslib_1.__decorate(
  [(0, class_validator_1.IsUUID)(), tslib_1.__metadata("design:type", String)],
  PaymentDto.prototype,
  "idempotencyKey",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  PaymentDto.prototype,
  "amount",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsEnum)(client_1.PaymentMethod),
    tslib_1.__metadata(
      "design:type",
      typeof (_a =
        typeof client_1.PaymentMethod !== "undefined" &&
        client_1.PaymentMethod) === "function"
        ? _a
        : Object,
    ),
  ],
  PaymentDto.prototype,
  "method",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  PaymentDto.prototype,
  "paidAt",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    tslib_1.__metadata("design:type", String),
  ],
  PaymentDto.prototype,
  "notes",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(100),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AllocationDto),
    tslib_1.__metadata("design:type", Array),
  ],
  PaymentDto.prototype,
  "allocations",
  void 0,
);
const include = {
  student: { select: { firstName: true, lastName: true } },
  user: { select: { name: true } },
  allocations: { include: { invoice: true } },
};
let PaymentsController = class PaymentsController {
  db;
  constructor(db) {
    this.db = db;
  }
  async list(q) {
    const where = {
      ...(q.studentId ? { studentId: q.studentId } : {}),
      ...(q.method ? { method: q.method } : {}),
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search, mode: "insensitive" } },
              {
                student: {
                  firstName: { contains: q.search, mode: "insensitive" },
                },
              },
              {
                student: {
                  lastName: { contains: q.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    const [total, items] = await this.db.$transaction([
      this.db.payment.count({ where }),
      this.db.payment.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);
    return (0, query_1.pagination)(total, q, items);
  }
  async create(dto, req) {
    const amount = (0, finance_1.money)(dto.amount, true),
      paidAt = (0, finance_1.calendarDate)(dto.paidAt);
    if (paidAt > (0, finance_1.calendarDate)((0, finance_1.today)()))
      throw new common_1.BadRequestException(
        "Data e pagesës nuk mund të jetë në të ardhmen.",
      );
    const allocations = dto.allocations.map((a) => ({
      ...a,
      amount: (0, finance_1.money)(a.amount, true),
    }));
    if (
      new Set(allocations.map((a) => a.invoiceId)).size !== allocations.length
    )
      throw new common_1.BadRequestException(
        "Një faturë nuk mund të përsëritet në pagesë.",
      );
    const sum = allocations.reduce(
      (total, a) => total.plus(a.amount),
      new client_1.Prisma.Decimal(0),
    );
    if (!sum.eq(amount))
      throw new common_1.BadRequestException(
        "Ndarjet duhet të jenë të barabarta me shumën e pagesës.",
      );
    return (0, finance_1.atomic)(this.db, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.idempotencyKey}))`;
      const previous = await tx.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include,
      });
      if (previous) {
        const same =
          previous.studentId === dto.studentId &&
          previous.amount.eq(amount) &&
          previous.method === dto.method &&
          previous.paidAt.getTime() === paidAt.getTime() &&
          previous.notes === dto.notes &&
          previous.allocations.length === allocations.length &&
          allocations.every((a) =>
            previous.allocations.some(
              (p) => p.invoiceId === a.invoiceId && p.amount.eq(a.amount),
            ),
          );
        if (!same)
          throw new common_1.ConflictException(
            "Kjo kërkesë pagese është përdorur me të dhëna të tjera.",
          );
        return previous;
      }
      // A student-level lock serializes competing allocations across different months.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.studentId}))`;
      const openInvoices = await tx.invoice.findMany({
        where: {
          studentId: dto.studentId,
          status: { in: ["UNPAID", "PARTIAL"] },
        },
        orderBy: [{ period: "asc" }, { id: "asc" }],
      });
      checkOldestMonths(openInvoices, allocations);
      for (const a of [...allocations].sort((a, b) =>
        a.invoiceId.localeCompare(b.invoiceId),
      )) {
        const invoice = await tx.invoice.findUnique({
          where: { id: a.invoiceId },
        });
        if (
          !invoice ||
          invoice.studentId !== dto.studentId ||
          invoice.status === "VOID"
        )
          throw new common_1.BadRequestException(
            "Fatura nuk i përket nxënësit ose është e anuluar.",
          );
        const paid = invoice.paidAmount.plus(a.amount);
        if (paid.gt(invoice.amount))
          throw new common_1.ConflictException(
            "Shuma tejkalon mbetjen e faturës. Rifreskoni të dhënat.",
          );
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: paid,
            status: paid.eq(invoice.amount) ? "PAID" : "PARTIAL",
          },
        });
      }
      const payment = await tx.payment.create({
        data: {
          number: await (0, finance_1.number)(
            tx,
            "PAG",
            paidAt.getUTCFullYear(),
          ),
          studentId: dto.studentId,
          userId: req.user.id,
          amount,
          method: dto.method,
          paidAt,
          notes: dto.notes,
          idempotencyKey: dto.idempotencyKey,
          allocations: { create: allocations },
        },
        include,
      });
      await (0, finance_1.audit)(tx, req.user.id, "PAYMENT_CREATE", payment.id);
      return payment;
    });
  }
  reverse(id, dto, req) {
    if (!dto.reason.trim())
      throw new common_1.BadRequestException("Shkruani arsyen.");
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const old = await tx.payment.findUnique({
        where: { id },
        include: { allocations: true },
      });
      if (!old) throw new common_1.NotFoundException("Pagesa nuk u gjet.");
      if (old.reversedAt)
        throw new common_1.ConflictException("Pagesa është anuluar tashmë.");
      for (const a of old.allocations) {
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: a.invoiceId },
        });
        const paid = invoice.paidAmount.minus(a.amount);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { paidAmount: paid, status: paid.eq(0) ? "UNPAID" : "PARTIAL" },
        });
      }
      const result = await tx.payment.update({
        where: { id },
        data: { reversedAt: new Date(), reverseReason: dto.reason },
      });
      await (0, finance_1.audit)(tx, req.user.id, "PAYMENT_REVERSE", id);
      return result;
    });
  }
  async receipt(id, res) {
    const p = await this.db.payment.findUnique({ where: { id }, include });
    if (!p) throw new common_1.NotFoundException("Pagesa nuk u gjet.");
    const rows = [
      ["Nxënësi", `${p.student.firstName} ${p.student.lastName}`],
      ["Data", p.paidAt.toISOString().slice(0, 10)],
      ["Metoda", p.method === "CASH" ? "Para të gatshme" : "Bankë"],
      ["Regjistruar nga", p.user.name],
      ...p.allocations.map((a) => [
        a.invoice.number + " · " + a.invoice.period,
        a.amount.toFixed(2) + " EUR",
      ]),
      ["Totali", p.amount.toFixed(2) + " EUR"],
      ["Shënime", p.notes || "-"],
    ];
    if (p.reversedAt) rows.push(["ANULUAR", p.reverseReason ?? ""]);
    res
      .type("application/pdf")
      .attachment(p.number + ".pdf")
      .send(await (0, documents_1.pdf)("Dëshmi e pagesës", p.number, rows));
  }
};
exports.PaymentsController = PaymentsController;
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
  PaymentsController.prototype,
  "list",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Post)(),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      PaymentDto,
      typeof (_d =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _d
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  PaymentsController.prototype,
  "create",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Post)(":id/reverse"),
    (0, auth_1.Roles)("ADMIN"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__param(2, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      String,
      typeof (_e =
        typeof invoices_1.Reason !== "undefined" && invoices_1.Reason) ===
      "function"
        ? _e
        : Object,
      typeof (_f =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _f
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  PaymentsController.prototype,
  "reverse",
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
      typeof (_g =
        typeof express_1.Response !== "undefined" && express_1.Response) ===
      "function"
        ? _g
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  PaymentsController.prototype,
  "receipt",
  null,
);
exports.PaymentsController = PaymentsController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("payments"),
    (0, auth_1.Roles)("ADMIN", "FINANCE"),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_b =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _b
        : Object,
    ]),
  ],
  PaymentsController,
);
