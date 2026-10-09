import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  IsString,
  MinLength,
  MaxLength,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
  Matches,
} from "class-validator";
import { ActivityStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { Roles, AuthRequest } from "../auth/auth";
import { atomic, audit, calendarDate, today } from "../common/finance";
import { ListQuery, pagination } from "../common/query";
import { Transform } from "class-transformer";
export class GroupDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
  @IsUUID() courseId!: string;
  @IsUUID() instructorId!: string;
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  days!: number[];
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime!: string;
  @IsInt() @Min(15) @Max(480) durationMinutes!: number;
  @IsInt() @Min(1) @Max(500) capacity!: number;
  @IsEnum(ActivityStatus) status!: ActivityStatus;
}
export class GroupUpdate extends GroupDto {
  @IsInt() @Min(1) version!: number;
}
@Controller("groups")
export class GroupsController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Query() q: ListQuery, @Req() req: AuthRequest) {
    if (
      q.status &&
      !Object.values(ActivityStatus).includes(q.status as ActivityStatus)
    )
      throw new BadRequestException("Statusi është i pavlefshëm.");
    const where = {
      ...(req.user.role === "INSTRUCTOR" ? { instructorId: req.user.id } : {}),
      ...(q.courseId ? { courseId: q.courseId } : {}),
      ...(q.status ? { status: q.status as ActivityStatus } : {}),
      ...(q.search
        ? { name: { contains: q.search, mode: "insensitive" as const } }
        : {}),
    };
    const active = {
      startDate: { lte: calendarDate(today()) },
      OR: [{ endDate: null }, { endDate: { gte: calendarDate(today()) } }],
    };
    const [total, items] = await this.db.$transaction([
      this.db.group.count({ where }),
      this.db.group.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { name: "asc" },
        include: {
          course: { select: { id: true, name: true } },
          instructor: { select: { id: true, name: true } },
          _count: { select: { enrollments: { where: active } } },
        },
      }),
    ]);
    return pagination(total, q, items);
  }
  @Post() @Roles("ADMIN", "FINANCE") create(
    @Body() dto: GroupDto,
    @Req() req: AuthRequest,
  ) {
    return atomic(this.db, async (tx) => {
      const instructor = await tx.user.findUnique({
        where: { id: dto.instructorId },
      });
      if (!instructor?.active || instructor.role !== "INSTRUCTOR")
        throw new BadRequestException("Zgjidhni një instruktor aktiv.");
      const course = await tx.course.findUnique({
        where: { id: dto.courseId },
      });
      if (!course || course.status !== "ACTIVE")
        throw new BadRequestException("Zgjidhni një kurs aktiv.");
      const group = await tx.group.create({ data: dto });
      await audit(tx, req.user.id, "GROUP_CREATE", group.id);
      return group;
    });
  }
  @Patch(":id") @Roles("ADMIN", "FINANCE") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: GroupUpdate,
    @Req() req: AuthRequest,
  ) {
    return atomic(this.db, async (tx) => {
      const old = await tx.group.findUnique({
        where: { id },
        include: { _count: { select: { enrollments: true } } },
      });
      if (!old) throw new NotFoundException("Grupi nuk u gjet.");
      if (old.courseId !== dto.courseId && old._count.enrollments)
        throw new BadRequestException(
          "Kursi i grupit me regjistrime nuk mund të ndryshohet.",
        );
      const instructor = await tx.user.findUnique({
        where: { id: dto.instructorId },
      });
      if (!instructor?.active || instructor.role !== "INSTRUCTOR")
        throw new BadRequestException("Instruktori duhet të jetë aktiv.");
      if (dto.capacity < old.capacity) {
        const start = calendarDate(today()).getTime();
        const enrollments = await tx.enrollment.findMany({
          where: {
            groupId: id,
            OR: [{ endDate: null }, { endDate: { gte: new Date(start) } }],
          },
          select: { startDate: true, endDate: true },
        });
        const events = enrollments
          .flatMap((e) => [
            { time: Math.max(start, e.startDate.getTime()), change: 1 },
            ...(e.endDate
              ? [{ time: e.endDate.getTime() + 86400000, change: -1 }]
              : []),
          ])
          .sort((a, b) => a.time - b.time || a.change - b.change);
        let occupancy = 0;
        for (const event of events) {
          occupancy += event.change;
          if (occupancy > dto.capacity)
            throw new ConflictException(
              "Kapaciteti nuk mund të jetë më i vogël se regjistrimet ekzistuese ose të ardhshme.",
            );
        }
      }
      const { version, ...data } = dto;
      const updated = await tx.group.updateMany({
        where: { id, version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!updated.count)
        throw new ConflictException(
          "Grupi është ndryshuar. Rifreskoni listën.",
        );
      await audit(tx, req.user.id, "GROUP_UPDATE", id);
      return tx.group.findUnique({ where: { id } });
    });
  }
  @Delete(":id") @Roles("ADMIN") remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return atomic(this.db, async (tx) => {
      if (
        (await tx.enrollment.count({ where: { groupId: id } })) ||
        (await tx.invoice.count({ where: { groupId: id } }))
      )
        throw new ConflictException(
          "Grupi ka historik të lidhur. Çaktivizojeni në vend të fshirjes.",
        );
      await tx.group.delete({ where: { id } });
      await audit(tx, req.user.id, "GROUP_DELETE", id);
      return { message: "Grupi u fshi." };
    });
  }
  @Get("instructors") async instructors() {
    return this.db.user.findMany({
      where: { role: "INSTRUCTOR", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
}
