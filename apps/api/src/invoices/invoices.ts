import {
  Injectable,
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Cron, Timeout } from "@nestjs/schedule";
import { IsString, MaxLength } from "class-validator";
import { Prisma, InvoiceStatus } from "@prisma/client";
import { Response } from "express";
import { PrismaService } from "../common/prisma.service";
import {
  atomic,
  audit,
  number,
  periodDates,
  calendarDate,
  today,
} from "../common/finance";
import { Roles, AuthRequest } from "../auth/auth";
import { ListQuery, pagination } from "../common/query";
import { pdf } from "../reports/documents";
export class InvoiceGenerate {
  @IsString() period!: string;
}
export class Reason {
  @IsString() @MaxLength(500) reason!: string;
}
export function invoiceWhere(q: ListQuery): Prisma.InvoiceWhereInput {
  if (q.period) periodDates(q.period);
  if (
    q.status &&
    !Object.values(InvoiceStatus).includes(q.status as InvoiceStatus)
  )
    throw new BadRequestException("Statusi i faturës është i pavlefshëm.");
  return {
    ...(q.studentId ? { studentId: q.studentId } : {}),
    ...(q.courseId ? { courseId: q.courseId } : {}),
    ...(q.groupId ? { groupId: q.groupId } : {}),
    ...(q.period ? { period: q.period } : {}),
    ...(q.status ? { status: q.status as InvoiceStatus } : {}),
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
@Injectable()
export class InvoiceService {
  private running = false;
  constructor(private db: PrismaService) {}
  async generate(period: string, userId: string | null) {
    const { first, last } = periodDates(period);
    if (first > calendarDate(today()))
      throw new BadRequestException("Nuk mund të faturoni muajt e ardhshëm.");
    return atomic(this.db, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(612040)`;
      const enrollments = await tx.enrollment.findMany({
        where: {
          startDate: { lte: last },
          OR: [{ endDate: null }, { endDate: { gte: first } }],
          student: { status: "ACTIVE" },
        },
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
        include: { student: true, course: true, group: true },
      });
      let created = 0;
      for (const e of enrollments) {
        const exists = await tx.invoice.findUnique({
          where: {
            studentId_courseId_period: {
              studentId: e.studentId,
              courseId: e.courseId,
              period,
            },
          },
        });
        if (exists) continue;
        const amount = e.monthlyPrice.minus(e.discount);
        const dueDate = new Date(
          Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 15),
        );
        await tx.invoice.create({
          data: {
            number: await number(tx, "FAT", first.getUTCFullYear()),
            studentId: e.studentId,
            enrollmentId: e.id,
            courseId: e.courseId,
            groupId: e.groupId,
            period,
            issuedAt: calendarDate(today()),
            dueDate,
            subtotal: e.monthlyPrice,
            discount: e.discount,
            amount,
            status: amount.eq(0) ? "PAID" : "UNPAID",
            studentName: `${e.student.firstName} ${e.student.lastName}`,
            courseName: e.course.name,
            groupName: e.group.name,
          },
        });
        created++;
      }
      if (created)
        await audit(tx, userId, "INVOICES_GENERATE", `${period}:${created}`);
      return { created, period };
    });
  }
  @Timeout(15000) initial() {
    return this.scheduled();
  }
  @Cron("0 10 * * * *", { timeZone: "Europe/Tirane" }) async scheduled() {
    if (process.env.AUTO_INVOICES === "false" || this.running) return;
    this.running = true;
    try {
      const oldest = await this.db.enrollment.findFirst({
        where: { student: { status: "ACTIVE" } },
        orderBy: { startDate: "asc" },
        select: { startDate: true },
      });
      if (!oldest) return;
      const current = calendarDate(today().slice(0, 7) + "-01");
      const cursor = new Date(
        Date.UTC(
          oldest.startDate.getUTCFullYear(),
          oldest.startDate.getUTCMonth(),
          1,
        ),
      );
      while (cursor <= current) {
        await this.generate(cursor.toISOString().slice(0, 7), null);
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    } catch (error) {
      console.error(
        "Faturimi automatik dështoi:",
        error instanceof Error ? error.message : "Gabim",
      );
    } finally {
      this.running = false;
    }
  }
}
@Controller("invoices")
@Roles("ADMIN", "FINANCE")
export class InvoicesController {
  constructor(
    private db: PrismaService,
    private service: InvoiceService,
  ) {}
  @Get() async list(@Query() q: ListQuery) {
    const where = invoiceWhere(q);
    const [total, items] = await this.db.$transaction([
      this.db.invoice.count({ where }),
      this.db.invoice.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: [{ period: "desc" }, { number: "desc" }],
      }),
    ]);
    return pagination(
      total,
      q,
      items.map((i) => ({
        ...i,
        balance: i.amount.minus(i.paidAmount).toFixed(2),
      })),
    );
  }
  @Post("generate") generate(
    @Body() dto: InvoiceGenerate,
    @Req() req: AuthRequest,
  ) {
    return this.service.generate(dto.period, req.user.id);
  }
  @Post(":id/void") async void(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: Reason,
    @Req() req: AuthRequest,
  ) {
    if (!dto.reason.trim()) throw new BadRequestException("Shkruani arsyen.");
    return atomic(this.db, async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) throw new NotFoundException("Fatura nuk u gjet.");
      if (invoice.status === "VOID" || invoice.paidAmount.gt(0))
        throw new BadRequestException(
          "Fatura e paguar ose e anuluar nuk mund të anulohet.",
        );
      const result = await tx.invoice.update({
        where: { id },
        data: { status: "VOID", voidReason: dto.reason },
      });
      await audit(tx, req.user.id, "INVOICE_VOID", id);
      return result;
    });
  }
  @Get(":id/pdf") async document(
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const i = await this.db.invoice.findUnique({ where: { id } });
    if (!i) throw new NotFoundException("Fatura nuk u gjet.");
    const data = await pdf("Faturë mujore", i.number, [
      ["Nxënësi", i.studentName],
      ["Kursi / Grupi", `${i.courseName} / ${i.groupName}`],
      ["Periudha", i.period],
      ["Lëshuar më", i.issuedAt.toISOString().slice(0, 10)],
      ["Afati i pagesës", i.dueDate.toISOString().slice(0, 10)],
      ["Çmimi bazë", i.subtotal.toFixed(2) + " EUR"],
      ["Zbritja", i.discount.toFixed(2) + " EUR"],
      ["Totali", i.amount.toFixed(2) + " EUR"],
      ["Paguar", i.paidAmount.toFixed(2) + " EUR"],
      ["Mbetja", i.amount.minus(i.paidAmount).toFixed(2) + " EUR"],
      [
        "Statusi",
        {
          UNPAID: "Papaguar",
          PARTIAL: "Pjesërisht paguar",
          PAID: "Paguar",
          VOID: "Anuluar",
        }[i.status],
      ],
    ]);
    res
      .type("application/pdf")
      .attachment(i.number + ".pdf")
      .send(data);
  }
}
