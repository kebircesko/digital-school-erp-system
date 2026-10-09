import { Controller, Get, Query, Res, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Response } from "express";
import { PrismaService } from "../common/prisma.service";
import { Roles } from "../auth/auth";
import { calendarDate, today } from "../common/finance";
import { ListQuery } from "../common/query";
import { invoiceWhere } from "../invoices/invoices";
import { pdf, excel } from "./documents";
@Injectable()
export class ReportService {
  constructor(private db: PrismaService) {}
  async debts(q: ListQuery) {
    const invoices = await this.db.invoice.findMany({
      where: {
        ...invoiceWhere({ ...q, status: undefined }),
        status: { in: ["UNPAID", "PARTIAL"] },
      },
      orderBy: [{ studentName: "asc" }, { period: "asc" }],
    });
    const rows = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        amount: Prisma.Decimal;
        invoices: typeof invoices;
      }
    >();
    for (const i of invoices) {
      const row = rows.get(i.studentId) ?? {
        studentId: i.studentId,
        studentName: i.studentName,
        amount: new Prisma.Decimal(0),
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
          new Prisma.Decimal(0),
        )
        .toFixed(2),
      items: [...rows.values()].map((r) => ({
        ...r,
        amount: r.amount.toFixed(2),
      })),
    };
  }
  async financial(q: ListQuery) {
    const from = calendarDate(q.from ?? today().slice(0, 7) + "-01"),
      to = calendarDate(q.to ?? today());
    if (from > to)
      throw new (await import("@nestjs/common")).BadRequestException(
        "Data e fillimit duhet të jetë para përfundimit.",
      );
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
    const daily = new Map<string, Prisma.Decimal>(),
      courses = new Map<string, Prisma.Decimal>(),
      groups = new Map<string, Prisma.Decimal>(),
      methods = new Map<string, Prisma.Decimal>();
    const courseNames = new Map<string, string>(),
      groupNames = new Map<string, string>();
    let total = new Prisma.Decimal(0);
    const rows = allocations.map((a) => {
      courseNames.set(a.invoice.courseId, a.invoice.courseName);
      groupNames.set(a.invoice.groupId, a.invoice.groupName);
      const day = a.payment.paidAt.toISOString().slice(0, 10);
      for (const [map, key] of [
        [daily, day],
        [courses, a.invoice.courseId],
        [groups, a.invoice.groupId],
        [methods, a.payment.method],
      ] as const)
        map.set(key, (map.get(key) ?? new Prisma.Decimal(0)).plus(a.amount));
      total = total.plus(a.amount);
      return {
        payment: a.payment.number,
        invoice: a.invoice.number,
        student: a.invoice.studentName,
        course: a.invoice.courseName,
        group: a.invoice.groupName,
        date: day,
        method: a.payment.method,
        amount: a.amount.toFixed(2),
        user: a.payment.user.name,
      };
    });
    const list = (map: Map<string, Prisma.Decimal>) =>
      [...map.entries()].map(([name, amount]) => ({
        name,
        amount: amount.toFixed(2),
      }));
    return {
      from: q.from ?? today().slice(0, 7) + "-01",
      to: q.to ?? today(),
      total: total.toFixed(2),
      daily: list(daily),
      courses: list(courses).map((r) => ({
        ...r,
        id: r.name,
        name: courseNames.get(r.name)!,
      })),
      groups: list(groups).map((r) => ({
        ...r,
        id: r.name,
        name: groupNames.get(r.name)!,
      })),
      methods: list(methods),
      rows,
    };
  }
}
@Controller("reports")
@Roles("ADMIN", "FINANCE")
export class ReportsController {
  constructor(private reports: ReportService) {}
  @Get("debts") debts(@Query() q: ListQuery) {
    return this.reports.debts(q);
  }
  @Get("financial") financial(@Query() q: ListQuery) {
    return this.reports.financial(q);
  }
  @Get("financial.xlsx") async workbook(
    @Query() q: ListQuery,
    @Res() res: Response,
  ) {
    const report = await this.reports.financial(q);
    const data = await excel(
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
  @Get("financial.pdf") async document(
    @Query() q: ListQuery,
    @Res() res: Response,
  ) {
    const report = await this.reports.financial(q);
    res
      .type("application/pdf")
      .attachment("raport-financiar.pdf")
      .send(
        await pdf("Raport financiar", `${report.from} - ${report.to}`, [
          ["Totali i arkëtuar", report.total + " EUR"],
          ...report.rows.map(
            (r) =>
              [
                `${r.date} · ${r.payment}\n${r.student}\n${r.course} / ${r.group}`,
                r.amount + " EUR",
              ] as [string, string],
          ),
        ]),
      );
  }
  @Get("debts.xlsx") async debtExcel(
    @Query() q: ListQuery,
    @Res() res: Response,
  ) {
    const report = await this.reports.debts(q);
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment("borxhet.xlsx")
      .send(
        await excel(
          "Borxhet",
          ["Nxënësi", "Borxhi EUR", "Fatura"],
          report.items.map((r) => [r.studentName, r.amount, r.invoices.length]),
        ),
      );
  }
  @Get("debts.pdf") async debtPdf(@Query() q: ListQuery, @Res() res: Response) {
    const report = await this.reports.debts(q);
    res
      .type("application/pdf")
      .attachment("borxhet.pdf")
      .send(
        await pdf("Detyrimet e nxënësve", q.period ?? "Të gjitha periudhat", [
          ["Borxhi total", report.total + " EUR"],
          ...report.items.map(
            (r) => [r.studentName, r.amount + " EUR"] as [string, string],
          ),
        ]),
      );
  }
}
