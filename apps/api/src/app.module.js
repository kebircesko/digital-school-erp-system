"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const tslib_1 = require("tslib");
const schedule_1 = require("@nestjs/schedule");
const courses_1 = require("./courses/courses");
const groups_1 = require("./groups/groups");
const enrollments_1 = require("./enrollments/enrollments");
const invoices_1 = require("./invoices/invoices");
const { InvoiceReviewController } = require("./invoices/review");
const { AttendanceController } = require("./attendance/attendance");
const payments_1 = require("./payments/payments");
const reports_1 = require("./reports/reports");
const users_1 = require("./users/users");
const backups_1 = require("./backups/backups");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const prisma_service_1 = require("./common/prisma.service");
const auth_1 = require("./auth/auth");
const students_1 = require("./students/students");
const dashboard_1 = require("./dashboard/dashboard");
let AppModule = class AppModule {};
exports.AppModule = AppModule;
exports.AppModule = AppModule = tslib_1.__decorate(
  [
    (0, common_1.Module)({
      imports: [
        schedule_1.ScheduleModule.forRoot(),
        config_1.ConfigModule.forRoot({ isGlobal: true }),
        throttler_1.ThrottlerModule.forRoot([
          { ttl: 60000, limit: 120 },
          {
            name: "login",
            ttl: 60000,
            limit: 10,
            skipIf: (ctx) => ctx.getHandler().name !== "login",
          },
        ]),
      ],
      controllers: [
        auth_1.AuthController,
        students_1.StudentsController,
        dashboard_1.DashboardController,
        courses_1.CoursesController,
        groups_1.GroupsController,
        enrollments_1.EnrollmentsController,
        invoices_1.InvoicesController,
        InvoiceReviewController,
        AttendanceController,
        payments_1.PaymentsController,
        reports_1.ReportsController,
        users_1.UsersController,
        users_1.AuditController,
        backups_1.BackupsController,
      ],
      providers: [
        prisma_service_1.PrismaService,
        invoices_1.InvoiceService,
        reports_1.ReportService,
        backups_1.BackupService,
        { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard },
        { provide: core_1.APP_GUARD, useClass: auth_1.AuthGuard },
      ],
    }),
  ],
  AppModule,
);
