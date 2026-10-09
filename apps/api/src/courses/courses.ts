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
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import {
  IsString,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsEnum,
} from "class-validator";
import { ActivityStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { Roles, AuthRequest } from "../auth/auth";
import { money, atomic, audit } from "../common/finance";
import { ListQuery, pagination } from "../common/query";
import { Transform } from "class-transformer";
export class CourseDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
  @IsString() @MaxLength(3000) description!: string;
  @IsString() monthlyPrice!: string;
  @IsInt() @Min(1) @Max(120) durationMonths!: number;
  @IsEnum(ActivityStatus) status!: ActivityStatus;
}
export class CourseUpdate extends CourseDto {
  @IsInt() @Min(1) version!: number;
}
@Controller("courses")
export class CoursesController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Query() q: ListQuery, @Req() req: AuthRequest) {
    if (
      q.status &&
      !Object.values(ActivityStatus).includes(q.status as ActivityStatus)
    )
      throw new BadRequestException("Statusi është i pavlefshëm.");
    const where = {
      ...(q.status ? { status: q.status as ActivityStatus } : {}),
      ...(q.search
        ? { name: { contains: q.search, mode: "insensitive" as const } }
        : {}),
    };
    const [total, items] = await this.db.$transaction([
      this.db.course.count({ where }),
      this.db.course.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { groups: true, enrollments: true } } },
      }),
    ]);
    return pagination(
      total,
      q,
      items.map((c) =>
        req.user.role === "INSTRUCTOR" ? { ...c, monthlyPrice: undefined } : c,
      ),
    );
  }
  @Post() @Roles("ADMIN", "FINANCE") create(
    @Body() dto: CourseDto,
    @Req() req: AuthRequest,
  ) {
    return atomic(this.db, async (tx) => {
      const result = await tx.course.create({
        data: {
          ...dto,
          name: dto.name.trim(),
          monthlyPrice: money(dto.monthlyPrice),
        },
      });
      await audit(tx, req.user.id, "COURSE_CREATE", result.id);
      return result;
    });
  }
  @Patch(":id") @Roles("ADMIN", "FINANCE") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CourseUpdate,
    @Req() req: AuthRequest,
  ) {
    return atomic(this.db, async (tx) => {
      const { version, ...data } = dto;
      const result = await tx.course.updateMany({
        where: { id, version },
        data: {
          ...data,
          name: data.name.trim(),
          monthlyPrice: money(data.monthlyPrice),
          version: { increment: 1 },
        },
      });
      if (!result.count)
        throw new ConflictException(
          "Kursi u ndryshua ose nuk ekziston. Rifreskoni listën.",
        );
      await audit(tx, req.user.id, "COURSE_UPDATE", id);
      return tx.course.findUnique({ where: { id } });
    });
  }
  @Delete(":id") @Roles("ADMIN") remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return atomic(this.db, async (tx) => {
      if (
        (await tx.group.count({ where: { courseId: id } })) ||
        (await tx.enrollment.count({ where: { courseId: id } })) ||
        (await tx.invoice.count({ where: { courseId: id } }))
      )
        throw new ConflictException(
          "Kursi ka historik të lidhur. Çaktivizojeni në vend të fshirjes.",
        );
      const result = await tx.course.deleteMany({ where: { id } });
      if (!result.count) throw new NotFoundException("Kursi nuk u gjet.");
      await audit(tx, req.user.id, "COURSE_DELETE", id);
      return { message: "Kursi u fshi." };
    });
  }
}
