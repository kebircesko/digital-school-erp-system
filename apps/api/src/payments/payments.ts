import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  IsUUID,
  IsString,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { PaymentMethod, Prisma } from "@prisma/client";
import { Response } from "express";
import { PrismaService } from "../common/prisma.service";
import {
  atomic,
  audit,
  money,
  number,
  calendarDate,
  today,
} from "../common/finance";
import { AuthRequest, Roles } from "../auth/auth";
import { ListQuery, pagination } from "../common/query";
import { pdf } from "../reports/documents";
import { Reason } from "../invoices/invoices";
class AllocationDto {
  @IsUUID() invoiceId!: string;
  @IsString() amount!: string;
}
export class PaymentDto {
  @IsUUID() studentId!: string;
  @IsUUID() idempotencyKey!: string;
  @IsString() amount!: string;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsString() paidAt!: string;
  @IsString() @MaxLength(500) notes!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations!: AllocationDto[];
}
const include = {
  student: { select: { firstName: true, lastName: true } },
  user: { select: { name: true } },
  allocations: { include: { invoice: true } },
};
@Controller("payments")
@Roles("ADMIN", "FINANCE")
export class PaymentsController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Query() q: ListQuery) {
    const where: Prisma.PaymentWhereInput = {
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
    return pagination(total, q, items);
  }
  @Post() async create(@Body() dto: PaymentDto, @Req() req: AuthRequest) {
    const amount = money(dto.amount, true),
      paidAt = calendarDate(dto.paidAt);
    if (paidAt > calendarDate(today()))
      throw new BadRequestException(
        "Data e pagesës nuk mund të jetë në të ardhmen.",
      );
    const allocations = dto.allocations.map((a) => ({
      ...a,
      amount: money(a.amount, true),
    }));
    if (
      new Set(allocations.map((a) => a.invoiceId)).size !== allocations.length
    )
      throw new BadRequestException(
        "Një faturë nuk mund të përsëritet në pagesë.",
      );
    const sum = allocations.reduce(
      (total, a) => total.plus(a.amount),
      new Prisma.Decimal(0),
    );
    if (!sum.eq(amount))
      throw new BadRequestException(
        "Ndarjet duhet të jenë të barabarta me shumën e pagesës.",
      );
    return atomic(this.db, async (tx) => {
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
          throw new ConflictException(
            "Kjo kërkesë pagese është përdorur me të dhëna të tjera.",
          );
        return previous;
      }
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
          throw new BadRequestException(
            "Fatura nuk i përket nxënësit ose është e anuluar.",
          );
        const paid = invoice.paidAmount.plus(a.amount);
        if (paid.gt(invoice.amount))
          throw new ConflictException(
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
          number: await number(tx, "PAG", paidAt.getUTCFullYear()),
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
      await audit(tx, req.user.id, "PAYMENT_CREATE", payment.id);
      return payment;
    });
  }
  @Post(":id/reverse") @Roles("ADMIN") reverse(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: Reason,
    @Req() req: AuthRequest,
  ) {
    if (!dto.reason.trim()) throw new BadRequestException("Shkruani arsyen.");
    return atomic(this.db, async (tx) => {
      const old = await tx.payment.findUnique({
        where: { id },
        include: { allocations: true },
      });
      if (!old) throw new NotFoundException("Pagesa nuk u gjet.");
      if (old.reversedAt)
        throw new ConflictException("Pagesa është anuluar tashmë.");
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
      await audit(tx, req.user.id, "PAYMENT_REVERSE", id);
      return result;
    });
  }
  @Get(":id/pdf") async receipt(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const p = await this.db.payment.findUnique({ where: { id }, include });
    if (!p) throw new NotFoundException("Pagesa nuk u gjet.");
    const rows: [string, string][] = [
      ["Nxënësi", `${p.student.firstName} ${p.student.lastName}`],
      ["Data", p.paidAt.toISOString().slice(0, 10)],
      ["Metoda", p.method === "CASH" ? "Para të gatshme" : "Bankë"],
      ["Regjistruar nga", p.user.name],
      ...p.allocations.map(
        (a) =>
          [
            a.invoice.number + " · " + a.invoice.period,
            a.amount.toFixed(2) + " EUR",
          ] as [string, string],
      ),
      ["Totali", p.amount.toFixed(2) + " EUR"],
      ["Shënime", p.notes || "-"],
    ];
    if (p.reversedAt) rows.push(["ANULUAR", p.reverseReason ?? ""]);
    res
      .type("application/pdf")
      .attachment(p.number + ".pdf")
      .send(await pdf("Dëshmi e pagesës", p.number, rows));
  }
}
