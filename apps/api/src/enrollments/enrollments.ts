import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import {
  IsUUID,
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  IsIn,
} from "class-validator";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { Roles, AuthRequest } from "../auth/auth";
import { atomic, audit, calendarDate, money } from "../common/finance";
import { ListQuery, pagination } from "../common/query";
export class EnrollmentDto {
  @IsUUID() studentId!: string;
  @IsUUID() groupId!: string;
  @IsString() startDate!: string;
  @IsOptional() @IsString() endDate?: string;
  @IsString() monthlyPrice!: string;
  @IsString() discount!: string;
  @IsString() @MaxLength(300) offer!: string;
}
export class EnrollmentEnd {
  @IsString() endDate!: string;
  @IsInt() @Min(1) version!: number;
}
export class EnrollmentTransfer {
  @IsUUID() groupId!: string;
  @IsString() startDate!: string;
  @IsInt() @Min(1) version!: number;
}
export async function createEnrollment(
  tx: Prisma.TransactionClient,
  dto: EnrollmentDto,
  previousId?: string,
) {
  const startDate = calendarDate(dto.startDate),
    endDate = dto.endDate ? calendarDate(dto.endDate) : null;
  if (endDate && endDate < startDate)
    throw new BadRequestException(
      "Data e përfundimit duhet të jetë pas fillimit.",
    );
  const price = money(dto.monthlyPrice),
    discount = money(dto.discount);
  if (discount.gt(price))
    throw new BadRequestException("Zbritja nuk mund ta tejkalojë çmimin.");
  const student = await tx.student.findUnique({ where: { id: dto.studentId } });
  const group = await tx.group.findUnique({
    where: { id: dto.groupId },
    include: { course: true },
  });
  if (
    !student ||
    student.status !== "ACTIVE" ||
    !group ||
    group.status !== "ACTIVE" ||
    group.course.status !== "ACTIVE"
  )
    throw new BadRequestException(
      "Nxënësi, grupi dhe kursi duhet të jenë aktivë.",
    );
  const overlap = await tx.enrollment.count({
    where: {
      studentId: student.id,
      courseId: group.courseId,
      startDate: { lte: endDate ?? new Date("9999-12-31") },
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    },
  });
  if (overlap)
    throw new ConflictException(
      "Nxënësi ka një regjistrim të mbivendosur në këtë kurs.",
    );
  const existing = await tx.enrollment.findMany({
    where: {
      groupId: group.id,
      startDate: { lte: endDate ?? new Date("9999-12-31") },
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    },
    select: { startDate: true, endDate: true },
  });
  const events = existing
    .flatMap((e) => [
      { time: Math.max(e.startDate.getTime(), startDate.getTime()), change: 1 },
      ...(e.endDate
        ? [{ time: e.endDate.getTime() + 86400000, change: -1 }]
        : []),
    ])
    .sort((a, b) => a.time - b.time || a.change - b.change);
  let occupancy = 0;
  for (const event of events) {
    occupancy += event.change;
    if (occupancy >= group.capacity)
      throw new ConflictException(
        "Grupi ka arritur kapacitetin në periudhën e zgjedhur.",
      );
  }
  return tx.enrollment.create({
    data: {
      studentId: student.id,
      groupId: group.id,
      courseId: group.courseId,
      startDate,
      endDate,
      monthlyPrice: price,
      discount,
      offer: dto.offer,
      previousId,
    },
  });
}
@Controller("enrollments")
export class EnrollmentsController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Query() q: ListQuery, @Req() req: AuthRequest) {
    const where: Prisma.EnrollmentWhereInput = {
      ...(q.studentId ? { studentId: q.studentId } : {}),
      ...(q.search
        ? {
            OR: [
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
      ...(q.courseId ? { courseId: q.courseId } : {}),
      ...(q.groupId ? { groupId: q.groupId } : {}),
      ...(req.user.role === "INSTRUCTOR"
        ? { group: { instructorId: req.user.id } }
        : {}),
    };
    const [total, items] = await this.db.$transaction([
      this.db.enrollment.count({ where }),
      this.db.enrollment.findMany({
        where,
        orderBy: { startDate: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          student: { select: { firstName: true, lastName: true } },
          course: { select: { name: true } },
          group: { select: { name: true } },
        },
      }),
    ]);
    return pagination(
      total,
      q,
      items.map((e) =>
        req.user.role === "INSTRUCTOR"
          ? {
              ...e,
              monthlyPrice: undefined,
              discount: undefined,
              offer: undefined,
            }
          : e,
      ),
    );
  }
  @Post() @Roles("ADMIN", "FINANCE") create(
    @Body() dto: EnrollmentDto,
    @Req() req: AuthRequest,
  ) {
    return atomic(this.db, async (tx) => {
      const result = await createEnrollment(tx, dto);
      await audit(tx, req.user.id, "ENROLLMENT_CREATE", result.id);
      return result;
    });
  }
  @Patch(":id/end") @Roles("ADMIN", "FINANCE") end(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EnrollmentEnd,
    @Req() req: AuthRequest,
  ) {
    return atomic(this.db, async (tx) => {
      const old = await tx.enrollment.findUnique({ where: { id } });
      if (!old) throw new NotFoundException("Regjistrimi nuk u gjet.");
      const endDate = calendarDate(dto.endDate);
      if (endDate < old.startDate)
        throw new BadRequestException(
          "Përfundimi nuk mund të jetë para fillimit.",
        );
      const latest = await tx.invoice.findFirst({
        where: { enrollmentId: id, status: { not: "VOID" } },
        orderBy: { period: "desc" },
      });
      if (latest && dto.endDate.slice(0, 7) < latest.period)
        throw new BadRequestException(
          "Përfundimi është para muajit të faturuar.",
        );
      const result = await tx.enrollment.updateMany({
        where: { id, version: dto.version, status: "ACTIVE" },
        data: { endDate, status: "ENDED", version: { increment: 1 } },
      });
      if (!result.count)
        throw new ConflictException(
          "Regjistrimi u ndryshua ose është përfunduar.",
        );
      await audit(tx, req.user.id, "ENROLLMENT_END", id);
      return tx.enrollment.findUnique({ where: { id } });
    });
  }
  @Post(":id/transfer") @Roles("ADMIN", "FINANCE") transfer(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: EnrollmentTransfer,
    @Req() req: AuthRequest,
  ) {
    return atomic(this.db, async (tx) => {
      const old = await tx.enrollment.findUnique({ where: { id } });
      if (!old) throw new NotFoundException("Regjistrimi nuk u gjet.");
      const startDate = calendarDate(dto.startDate);
      if (
        startDate.getUTCDate() !== 1 ||
        startDate <= old.startDate ||
        old.groupId === dto.groupId
      )
        throw new BadRequestException(
          "Ndërrimi fillon më datën 1 të një muaji pas fillimit.",
        );
      const target = await tx.group.findUnique({ where: { id: dto.groupId } });
      if (!target || target.courseId !== old.courseId)
        throw new BadRequestException(
          "Zgjidhni grup tjetër të të njëjtit kurs.",
        );
      const endDate = new Date(startDate.getTime() - 86400000);
      const result = await tx.enrollment.updateMany({
        where: { id, version: dto.version, status: "ACTIVE" },
        data: { status: "ENDED", endDate, version: { increment: 1 } },
      });
      if (!result.count)
        throw new ConflictException(
          "Regjistrimi është ndryshuar ose përfunduar.",
        );
      const next = await createEnrollment(
        tx,
        {
          studentId: old.studentId,
          groupId: dto.groupId,
          startDate: dto.startDate,
          endDate: old.endDate?.toISOString().slice(0, 10),
          monthlyPrice: old.monthlyPrice.toFixed(2),
          discount: old.discount.toFixed(2),
          offer: old.offer,
        },
        id,
      );
      await audit(tx, req.user.id, "ENROLLMENT_TRANSFER", next.id);
      return next;
    });
  }
}
