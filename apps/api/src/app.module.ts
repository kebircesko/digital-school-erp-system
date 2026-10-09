import { ScheduleModule } from "@nestjs/schedule";
import { CoursesController } from "./courses/courses";
import { GroupsController } from "./groups/groups";
import { EnrollmentsController } from "./enrollments/enrollments";
import { InvoiceService, InvoicesController } from "./invoices/invoices";
import { PaymentsController } from "./payments/payments";
import { ReportService, ReportsController } from "./reports/reports";
import { UsersController, AuditController } from "./users/users";
import { BackupService, BackupsController } from "./backups/backups";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaService } from "./common/prisma.service";
import { AuthController, AuthGuard } from "./auth/auth";
import { StudentsController } from "./students/students";
import { DashboardController } from "./dashboard/dashboard";
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
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
    AuthController,
    StudentsController,
    DashboardController,
    CoursesController,
    GroupsController,
    EnrollmentsController,
    InvoicesController,
    PaymentsController,
    ReportsController,
    UsersController,
    AuditController,
    BackupsController,
  ],
  providers: [
    PrismaService,
    InvoiceService,
    ReportService,
    BackupService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
