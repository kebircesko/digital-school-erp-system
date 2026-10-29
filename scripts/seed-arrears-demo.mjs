import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import finance from "../apps/api/src/common/finance.js";
import billing from "../apps/api/src/common/billing.js";
import review from "../apps/api/src/invoices/review.js";
import backups from "../apps/api/src/backups/snapshot.js";

const batch = "DEMO-ARREARS-10-V1";
function id(kind, number = "") {
  const hex = createHash("sha256")
    .update(`${batch}:${kind}:${number}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function arrearsPlan(period = finance.today().slice(0, 7)) {
  finance.periodDates(period);
  return {
    batch,
    period,
    courseId: id("course"),
    groupId: id("group"),
    students: [
      "Arben",
      "Elira",
      "Dardan",
      "Hana",
      "Luan",
      "Arta",
      "Besa",
      "Drin",
      "Era",
      "Yll",
    ].map((firstName, index) => {
      const count = index < 5 ? 3 : 5;
      const periods = Array.from({ length: count }, (_, offset) =>
        review.shiftPeriod(period, offset - count + 1),
      );
      return {
        id: id("student", index),
        enrollmentId: id("enrollment", index),
        firstName,
        lastName: `Demo${count}Muaj`,
        months: count,
        periods,
        startDate: periods[0] + "-05",
        phone: `000 000 ${String(index + 1).padStart(3, "0")}`,
      };
    }),
  };
}
export async function inspectArrears(db, plan) {
  const students = await db.student.findMany({
    where: { id: { in: plan.students.map((row) => row.id) } },
    include: { invoices: { orderBy: { period: "asc" } } },
  });
  return {
    batch,
    count: students.length,
    students: plan.students.map((planned) => {
      const row = students.find((row) => row.id === planned.id);
      return {
        id: planned.id,
        name: `${planned.firstName} ${planned.lastName}`,
        expectedMonths: planned.months,
        unpaidMonths:
          row?.invoices
            .filter((invoice) => ["UNPAID", "PARTIAL"].includes(invoice.status))
            .map((invoice) => invoice.period) ?? [],
        debt:
          row?.invoices
            .filter((invoice) => ["UNPAID", "PARTIAL"].includes(invoice.status))
            .reduce(
              (sum, invoice) =>
                sum.plus(invoice.amount.minus(invoice.paidAmount)),
              finance.money("0"),
            )
            .toFixed(2) ?? "0.00",
      };
    }),
  };
}
export async function seedArrears(db, plan) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(715031)`;
      const existing = await tx.student.count({
        where: { id: { in: plan.students.map((row) => row.id) } },
      });
      if (existing === 10) return { created: false };
      if (existing)
        throw new Error(
          "Grupi demonstrues është i paplotë. Nuk u ndryshua asgjë.",
        );
      const admin = await tx.user.findFirst({
        where: { role: "ADMIN", active: true },
        orderBy: { createdAt: "asc" },
      });
      const teacher = await tx.user.findFirst({
        where: { role: "INSTRUCTOR", active: true },
        orderBy: { createdAt: "asc" },
      });
      if (!admin || !teacher)
        throw new Error(
          "Nevojitet një administrator dhe një instruktor aktiv.",
        );
      const occupied = await tx.group.findMany({
        where: { instructorId: teacher.id, status: "ACTIVE" },
        select: { days: true, startTime: true, durationMinutes: true },
      });
      let slot;
      for (const day of [7, 6, 5, 4, 3, 2, 1]) {
        for (let hour = 7; hour < 21; hour++) {
          if (
            !occupied.some((group) => {
              const [h, m] = group.startTime.split(":").map(Number),
                start = h * 60 + m;
              return (
                group.days.includes(day) &&
                hour * 60 < start + group.durationMinutes &&
                hour * 60 + 60 > start
              );
            })
          ) {
            slot = { day, startTime: String(hour).padStart(2, "0") + ":00" };
            break;
          }
        }
        if (slot) break;
      }
      if (!slot)
        throw new Error("Nuk u gjet orar i lirë për grupin demonstrues.");
      await tx.course.create({
        data: {
          id: plan.courseId,
          name: "DEMO · Pagesa të prapambetura",
          description: "Vetëm për provimin e borxheve 3 dhe 5 muaj.",
          monthlyPrice: "40.00",
          durationMonths: 12,
        },
      });
      await tx.group.create({
        data: {
          id: plan.groupId,
          name: "DEMO · Borxhe 3–5 muaj",
          courseId: plan.courseId,
          instructorId: teacher.id,
          days: [slot.day],
          startTime: slot.startTime,
          durationMinutes: 60,
          capacity: 15,
        },
      });
      for (const [index, student] of plan.students.entries()) {
        const startDate = finance.calendarDate(student.startDate);
        await tx.student.create({
          data: {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            birthDate: finance.calendarDate("2013-05-10"),
            parentName: "Prind demonstrimi",
            parentPhone: student.phone,
            address: "Të dhëna demonstrimi",
            notes: `${batch} · Nxënës sintetik për provë me ${student.months} muaj të papaguar.`,
            createdAt: startDate,
          },
        });
        await tx.enrollment.create({
          data: {
            id: student.enrollmentId,
            studentId: student.id,
            groupId: plan.groupId,
            courseId: plan.courseId,
            startDate,
            monthlyPrice: "40.00",
            discount: "0.00",
            offer: batch,
          },
        });
        await finance.audit(tx, admin.id, "STUDENT_CREATE", student.id);
        await finance.audit(
          tx,
          admin.id,
          "ENROLLMENT_CREATE",
          student.enrollmentId,
        );
        for (const period of student.periods) {
          const invoice = await tx.invoice.create({
            data: {
              id: id("invoice", `${index}:${period}`),
              number: await finance.number(
                tx,
                "DEMO-FAT",
                Number(period.slice(0, 4)),
              ),
              studentId: student.id,
              enrollmentId: student.enrollmentId,
              courseId: plan.courseId,
              groupId: plan.groupId,
              period,
              issuedAt: finance.calendarDate(period + "-05"),
              dueDate: finance.calendarDate(
                billing.registrationDeadline(period, startDate),
              ),
              subtotal: "40.00",
              discount: "0.00",
              amount: "40.00",
              paidAmount: "0.00",
              status: "UNPAID",
              studentName: `${student.firstName} ${student.lastName}`,
              courseName: "DEMO · Pagesa të prapambetura",
              groupName: "DEMO · Borxhe 3–5 muaj",
              approvalNotes: batch,
            },
          });
          await finance.audit(tx, admin.id, "INVOICE_APPROVE", invoice.id);
        }
      }
      return { created: true };
    },
    { isolationLevel: "Serializable", timeout: 60000 },
  );
}
async function main() {
  const root = resolve(import.meta.dirname, "..");
  const plan = arrearsPlan();
  if (process.argv.includes("--preview")) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  const env = dotenv.parse(await readFile(resolve(root, "apps/api/.env")));
  const local = JSON.parse(
    await readFile(resolve(root, ".local/postgres.json"), "utf8"),
  );
  if (
    env.DATABASE_URL !==
    `postgresql://erp:${local.password}@127.0.0.1:55432/digital_school`
  )
    throw new Error("Lejohet vetëm databaza lokale e këtij projekti.");
  const db = new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
  });
  try {
    if (process.argv.includes("--verify")) {
      console.log(JSON.stringify(await inspectArrears(db, plan), null, 2));
      return;
    }
    const exists = await db.student.count({
      where: { id: { in: plan.students.map((row) => row.id) } },
    });
    let backupPath = null;
    if (!exists) {
      const folder = resolve(root, ".local/backups");
      await mkdir(folder, { recursive: true, mode: 0o700 });
      backupPath = resolve(folder, `before-${batch}-${Date.now()}.erpbackup`);
      await writeFile(
        backupPath,
        backups.encrypt(await backups.snapshot(db), env.BACKUP_KEY),
        { mode: 0o600 },
      );
    }
    const result = await seedArrears(db, plan);
    const report = {
      ...result,
      ...(await inspectArrears(db, plan)),
      backupPath,
    };
    await mkdir(resolve(root, "output/arrears-demo"), { recursive: true });
    await writeFile(
      resolve(root, "output/arrears-demo/students.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await db.$disconnect();
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
