import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";
import password from "../apps/api/src/auth/password.js";
import finance from "../apps/api/src/common/finance.js";
import backups from "../apps/api/src/backups/snapshot.js";
import billing from "../apps/api/src/common/billing.js";
import review from "../apps/api/src/invoices/review.js";

// This explicit, local-only fixture never runs during normal database initialization.
const root = resolve(import.meta.dirname, "..");
const batch = "DEMO-300-20261021";
const firstNames = [
  "Ardit",
  "Elira",
  "Dardan",
  "Arta",
  "Alban",
  "Besa",
  "Drin",
  "Era",
  "Luan",
  "Dafina",
  "Besart",
  "Diona",
  "Erion",
  "Doruntina",
  "Endrit",
  "Fjolla",
  "Fidan",
  "Flaka",
  "Fisnik",
  "Gentiana",
  "Gent",
  "Hana",
  "Granit",
  "Iliriana",
  "Ilir",
  "Kaltrina",
  "Jeton",
  "Leona",
  "Kreshnik",
  "Liridona",
  "Labinot",
  "Luljeta",
  "Leart",
  "Medina",
  "Lorik",
  "Nora",
  "Mal",
  "Rina",
  "Nderim",
  "Rovena",
  "Qëndrim",
  "Sara",
  "Rron",
  "Shqipe",
  "Shkëlzen",
  "Teuta",
  "Taulant",
  "Tringa",
  "Trim",
  "Valbona",
  "Valon",
  "Vesa",
  "Yll",
  "Vlora",
  "Ylber",
  "Zana",
  "Arian",
  "Alma",
  "Bleron",
  "Diellza",
];
const lastNames = [
  "Krasniqi",
  "Gashi",
  "Berisha",
  "Hoxha",
  "Shala",
  "Morina",
  "Bytyqi",
  "Kryeziu",
  "Thaçi",
  "Sopi",
  "Shabani",
  "Mustafa",
  "Rexhepi",
  "Halili",
  "Bajrami",
  "Osmani",
  "Mehmeti",
  "Selimi",
  "Dervishi",
  "Hasani",
  "Ramadani",
  "Jashari",
  "Mazreku",
  "Gega",
  "Daka",
  "Deda",
  "Basha",
  "Elshani",
  "Qorraj",
  "Kastrati",
  "Shoshi",
  "Sahiti",
  "Avdullahu",
  "Zeqiri",
  "Ismaili",
  "Limani",
  "Maloku",
  "Hoti",
  "Gërguri",
  "Miftari",
  "Gjonaj",
  "Brahimi",
  "Qerimi",
  "Kelmendi",
  "Shatri",
  "Pllana",
  "Tahiraj",
  "Rama",
  "Zogaj",
  "Dobruna",
  "Veseli",
  "Neziri",
  "Syla",
  "Haxhaj",
  "Rrahmani",
  "Leka",
  "Kuqi",
  "Dreshaj",
  "Haziri",
  "Ahmeti",
];
const locations = [
  "Prizren",
  "Krushë e Madhe, Rahovec",
  "Rahovec",
  "Gjonaj, Has",
  "Landovicë, Prizren",
  "Korishë, Prizren",
  "Zhur, Prizren",
  "Vërmicë, Prizren",
  "Piranë, Prizren",
  "Krushë e Vogël, Prizren",
  "Xërxë, Rahovec",
  "Ratkoc, Rahovec",
  "Celinë, Rahovec",
  "Nagavc, Rahovec",
  "Brestoc, Rahovec",
  "Hoçë e Vogël, Rahovec",
  "Bellacërkë, Rahovec",
  "Fortesë, Rahovec",
  "Mazrek, Has",
  "Planejë, Has",
  "Kushnin, Has",
  "Romajë, Has",
  "Grazhdanik, Prizren",
  "Petrovë, Prizren",
  "Lutogllavë, Prizren",
  "Reçan, Prizren",
  "Mamushë",
  "Suharekë",
  "Studençan, Suharekë",
  "Duhël, Suharekë",
];
const parentNames = [
  "Agron",
  "Mimoza",
  "Bashkim",
  "Shpresa",
  "Arben",
  "Valdete",
  "Blerim",
  "Lindita",
  "Faton",
  "Miranda",
  "Bekim",
  "Afërdita",
];
const courseDefinitions = [
  ["Scratch – Programim për fëmijë", "45.00"],
  ["Python – Hapat e parë", "60.00"],
  ["Web – HTML, CSS dhe JavaScript", "65.00"],
  ["Robotikë", "70.00"],
  ["Dizajn grafik", "55.00"],
  ["Gjuhë angleze", "40.00"],
];
const instructors = [
  "Arben Krasniqi",
  "Valbona Gashi",
  "Driton Morina",
  "Blerina Berisha",
];
const asDate = (value) => new Date(`${value}T00:00:00Z`);
const atTime = (date) => new Date(`${date}T10:00:00Z`);
function id(kind, index) {
  const hex = createHash("sha256")
    .update(`${batch}:${kind}:${index}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function plan() {
  const today = finance.today(),
    current = today.slice(0, 7);
  const previous = review.shiftPeriod(current, -1),
    oldest = review.shiftPeriod(current, -2);
  const students = Array.from({ length: 300 }, (_, i) => {
    const lastName = lastNames[((i % 60) * 7 + Math.floor(i / 60) * 11) % 60];
    const inactive = i >= 270;
    const period = inactive
      ? oldest
      : [oldest, previous, current][Math.floor(i / 100)];
    const maxDay =
      period === current ? Math.min(20, Number(today.slice(8))) : 20;
    const start = `${period}-${String(1 + (i % maxDay)).padStart(2, "0")}`;
    return {
      index: i,
      id: id("student", i),
      firstName: firstNames[i % 60],
      lastName,
      birthDate: `${2008 + (i % 10)}-${String(1 + ((i * 7) % 12)).padStart(2, "0")}-${String(1 + ((i * 11) % 28)).padStart(2, "0")}`,
      parentName: `${parentNames[i % parentNames.length]} ${lastName}`,
      parentPhone: `+383 00 ${String(i + 1).padStart(6, "0")}`,
      address: `${locations[i % locations.length]} · Adresë testuese ${1 + Math.floor(i / locations.length)}`,
      notes: `[${batch}] Nxënës sintetik ${String(i + 1).padStart(3, "0")}/300. Kontaktet janë fiktive; vetëm për testim.`,
      status: inactive ? "INACTIVE" : "ACTIVE",
      start,
      period,
      courseIndex: i % 6,
      groupIndex: i % 24,
      scenario: inactive
        ? "INACTIVE"
        : i < 90
          ? "PAID"
          : i < 150
            ? "PARTIAL"
            : i < 210
              ? "UNPAID"
              : "PENDING",
    };
  });
  assert.equal(
    new Set(students.map((s) => `${s.firstName} ${s.lastName}`)).size,
    300,
  );
  assert.ok(students.every((s) => s.start <= today && s.birthDate < s.start));
  return { today, current, previous, oldest, students };
}
function expected(plan) {
  return {
    batch,
    students: 300,
    active: 270,
    inactive: 30,
    courses: 6,
    groups: 24,
    instructors: 4,
    currentPeriod: plan.current,
    nextPeriod: review.shiftPeriod(plan.current, 1),
    currentPaid: 90,
    currentPartial: 60,
    currentUnpaid: 60,
    currentPending: 60,
    nextPending: 90,
    locations: locations.length,
    phoneNumbers: "Fiktivë (+383 00 ...)",
  };
}
async function inspect(db, data) {
  const ids = data.students.map((s) => s.id);
  const [
    students,
    enrollments,
    invoices,
    payments,
    attendance,
    currentRows,
    nextRows,
  ] = await Promise.all([
    db.student.count({ where: { id: { in: ids } } }),
    db.enrollment.count({ where: { studentId: { in: ids } } }),
    db.invoice.findMany({
      where: { studentId: { in: ids }, period: data.current },
    }),
    db.payment.count({ where: { studentId: { in: ids } } }),
    db.monthlyAttendance.count({ where: { studentId: { in: ids } } }),
    review.pendingFor(db, data.current),
    review.pendingFor(db, review.shiftPeriod(data.current, 1)),
  ]);
  const demoIds = new Set(ids);
  const result = {
    ...expected(data),
    actualStudents: students,
    enrollments,
    payments,
    attendance,
    invoiceStates: Object.fromEntries(
      ["PAID", "PARTIAL", "UNPAID"].map((status) => [
        status,
        invoices.filter((i) => i.status === status).length,
      ]),
    ),
    actualCurrentPending: currentRows.filter((r) => demoIds.has(r.studentId))
      .length,
    actualNextPending: nextRows.filter((r) => demoIds.has(r.studentId)).length,
  };
  assert.equal(students, 300);
  assert.equal(enrollments, 300);
  for (const [status, count] of [
    ["PAID", 90],
    ["PARTIAL", 60],
    ["UNPAID", 60],
  ])
    assert.equal(result.invoiceStates[status], count);
  assert.equal(result.actualCurrentPending, 60);
  assert.equal(result.actualNextPending, 90);
  const mismatches =
    await db.$queryRaw`SELECT COUNT(*)::int AS count FROM "Invoice" i WHERE i."studentId" IN (SELECT "id" FROM "Student" WHERE "notes" LIKE ${`[${batch}]%`}) AND i."paidAmount" <> COALESCE((SELECT SUM(a."amount") FROM "PaymentAllocation" a JOIN "Payment" p ON p."id"=a."paymentId" WHERE a."invoiceId"=i."id" AND p."reversedAt" IS NULL),0)`;
  assert.equal(mismatches[0].count, 0);
  return result;
}
async function main() {
  const data = plan();
  if (process.argv.includes("--preview")) {
    console.log(JSON.stringify(expected(data), null, 2));
    return;
  }
  const env = dotenv.parse(await readFile(resolve(root, "apps/api/.env")));
  const local = JSON.parse(
    await readFile(resolve(root, ".local/postgres.json"), "utf8"),
  );
  const expectedUrl = `postgresql://erp:${local.password}@127.0.0.1:55432/digital_school`;
  if (env.DATABASE_URL !== expectedUrl)
    throw new Error(
      "Ky skript lejohet vetëm në databazën lokale të këtij projekti.",
    );
  const db = new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
  });
  try {
    if (process.argv.includes("--verify")) {
      console.log(JSON.stringify(await inspect(db, data), null, 2));
      return;
    }
    const existing = await db.student.count({
      where: { id: { in: data.students.map((s) => s.id) } },
    });
    if (existing) {
      if (existing !== 300)
        throw new Error(
          "U gjet një grup i paplotë testues; nuk u ndryshua asgjë.",
        );
      console.log("Grupi testues ekziston tashmë. Nuk u shtuan dublikata.");
      console.log(JSON.stringify(await inspect(db, data), null, 2));
      return;
    }
    const admin = await db.user.findFirst({
      where: { role: "ADMIN", active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) throw new Error("Duhet të ekzistojë një administrator aktiv.");
    const backup = await backups.snapshot(db),
      folder = resolve(root, ".local/backups");
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const backupPath = resolve(
      folder,
      `before-${batch}-${Date.now()}.erpbackup`,
    );
    await writeFile(backupPath, backups.encrypt(backup, env.BACKUP_KEY), {
      mode: 0o600,
    });
    const instructorHash = password.hashPassword(
      randomBytes(32).toString("base64url"),
    );
    await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(612040)`;
        if (
          await tx.student.count({
            where: { id: { in: data.students.map((s) => s.id) } },
          })
        )
          throw new Error("Grupi testues u krijua nga një proces tjetër.");
        for (let i = 0; i < 4; i++)
          await tx.user.create({
            data: {
              id: id("instructor", i),
              email: `instruktor-${i + 1}@demo.erp.invalid`,
              name: `${instructors[i]} [TEST]`,
              role: "INSTRUCTOR",
              active: true,
              passwordHash: instructorHash,
            },
          });
        for (let c = 0; c < 6; c++) {
          await tx.course.create({
            data: {
              id: id("course", c),
              name: `${courseDefinitions[c][0]} [TEST]`,
              description: `[${batch}] Kurs demonstrues për testimin e regjistrimeve dhe pagesave.`,
              monthlyPrice: courseDefinitions[c][1],
              durationMonths: 12,
            },
          });
          for (let section = 0; section < 4; section++)
            await tx.group.create({
              data: {
                id: id("group", section * 6 + c),
                name: `TEST · ${["Scratch", "Python", "Web", "Robotikë", "Dizajn", "Anglisht"][c]} · ${"ABCD"[section]}`,
                courseId: id("course", c),
                instructorId: id("instructor", section),
                days: [1, 3],
                startTime: [
                  "09:00",
                  "10:30",
                  "12:00",
                  "13:30",
                  "15:00",
                  "16:30",
                ][c],
                durationMinutes: 90,
                capacity: 15,
              },
            });
        }
        for (const s of data.students) {
          const {
            index,
            scenario,
            start,
            period,
            courseIndex,
            groupIndex,
            ...student
          } = s;
          const price = new Prisma.Decimal(courseDefinitions[courseIndex][1]);
          const discount = new Prisma.Decimal(
            index % 10 === 0 ? "10.00" : index % 4 === 0 ? "5.00" : "0.00",
          );
          const amount = price.minus(discount),
            createdAt = atTime(start),
            courseId = id("course", courseIndex),
            groupId = id("group", groupIndex),
            enrollmentId = id("enrollment", index);
          await tx.student.create({
            data: {
              ...student,
              birthDate: asDate(student.birthDate),
              createdAt,
            },
          });
          await tx.enrollment.create({
            data: {
              id: enrollmentId,
              studentId: s.id,
              courseId,
              groupId,
              startDate: asDate(start),
              endDate:
                scenario === "INACTIVE"
                  ? finance.periodDates(data.previous).last
                  : null,
              status: scenario === "INACTIVE" ? "ENDED" : "ACTIVE",
              monthlyPrice: price,
              discount,
              offer: discount.gt(0) ? "Zbritje testuese për familje" : "",
              createdAt,
            },
          });
          for (
            let month = period;
            month <= data.current;
            month = review.shiftPeriod(month, 1)
          ) {
            if (scenario === "INACTIVE" && month === data.current) continue;
            const totalLessons = 8,
              absences = (index + Number(month.slice(5))) % 5,
              excusedAbsences = absences ? index % (absences + 1) : 0;
            const attendance = {
              period: month,
              totalLessons,
              absences,
              excusedAbsences,
            };
            await tx.monthlyAttendance.create({
              data: {
                id: id("attendance", `${index}:${month}`),
                studentId: s.id,
                courseId,
                ...attendance,
                sourceFile: `${batch}-sintetik`,
              },
            });
            if (month === data.current && scenario === "PENDING") continue;
            const current = month === data.current;
            const invoiceStatus = current ? scenario : "PAID";
            const paidAmount =
              invoiceStatus === "PAID"
                ? amount
                : invoiceStatus === "PARTIAL"
                  ? amount.div(2).toDecimalPlaces(2)
                  : new Prisma.Decimal(0);
            const invoiceId = id("invoice", `${index}:${month}`),
              issuedAt = asDate(month === period ? start : `${month}-01`);
            await tx.invoice.create({
              data: {
                id: invoiceId,
                number: await finance.number(
                  tx,
                  "FAT",
                  Number(month.slice(0, 4)),
                ),
                studentId: s.id,
                enrollmentId,
                courseId,
                groupId,
                period: month,
                issuedAt,
                dueDate: asDate(billing.registrationDeadline(month, start)),
                subtotal: price,
                discount,
                amount,
                paidAmount,
                status: invoiceStatus,
                studentName: `${s.firstName} ${s.lastName}`,
                courseName: `${courseDefinitions[courseIndex][0]} [TEST]`,
                groupName: `TEST · ${["Scratch", "Python", "Web", "Robotikë", "Dizajn", "Anglisht"][courseIndex]} · ${"ABCD"[Math.floor(groupIndex / 6)]}`,
                approvalNotes: `[${batch}] Faturë sintetike për testim.`,
                attendanceSnapshot: { current: attendance, previous: null },
                createdAt: atTime(month === period ? start : `${month}-01`),
              },
            });
            if (paidAmount.gt(0)) {
              const maxDay = current
                ? Math.min(20, Number(data.today.slice(8)))
                : 20;
              const paymentDate = `${month}-${String(1 + (index % maxDay)).padStart(2, "0")}`;
              await tx.payment.create({
                data: {
                  id: id("payment", `${index}:${month}`),
                  number: await finance.number(
                    tx,
                    "PAG",
                    Number(month.slice(0, 4)),
                  ),
                  studentId: s.id,
                  userId: admin.id,
                  amount: paidAmount,
                  method: index % 3 === 0 ? "BANK" : "CASH",
                  paidAt: asDate(paymentDate),
                  notes: `[${batch}] Pagesë sintetike ${invoiceStatus === "PARTIAL" ? "e pjesshme" : "e plotë"}.`,
                  idempotencyKey: randomUUID(),
                  createdAt: atTime(paymentDate),
                  allocations: { create: { invoiceId, amount: paidAmount } },
                },
              });
            }
          }
        }
        await finance.audit(tx, admin.id, "DEMO_DATA_CREATE", `${batch}:300`);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 120000,
        maxWait: 10000,
      },
    );
    const summary = { ...(await inspect(db, data)), backupPath };
    await mkdir(resolve(root, ".local/demo"), { recursive: true, mode: 0o700 });
    await writeFile(
      resolve(root, `.local/demo/${batch}.json`),
      JSON.stringify(summary, null, 2),
      { mode: 0o600 },
    );
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
