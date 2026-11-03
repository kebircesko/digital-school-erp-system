import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import finance from "../apps/api/src/common/finance.js";
import billing from "../apps/api/src/common/billing.js";
import backups from "../apps/api/src/backups/snapshot.js";

const root = resolve(import.meta.dirname, "..");
const env = dotenv.parse(await readFile(resolve(root, "apps/api/.env")));
const local = JSON.parse(
  await readFile(resolve(root, ".local/postgres.json"), "utf8"),
);
if (
  env.DATABASE_URL !==
  `postgresql://erp:${local.password}@127.0.0.1:55432/digital_school`
)
  throw new Error("Lejohet vetëm databaza lokale e këtij projekti.");
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
try {
  const rows = await db.invoice.findMany({
    where: { status: { in: ["UNPAID", "PARTIAL"] } },
    include: { enrollment: { select: { startDate: true } } },
    orderBy: [{ period: "asc" }, { number: "asc" }],
  });
  const changes = rows
    .map((row) => ({
      id: row.id,
      number: row.number,
      period: row.period,
      from: row.dueDate.toISOString().slice(0, 10),
      to: billing.registrationDeadline(row.period, row.enrollment.startDate),
    }))
    .filter((row) => row.from !== row.to);
  if (!process.argv.includes("--apply"))
    console.log(
      JSON.stringify(
        { changes: changes.length, sample: changes.slice(0, 10), apply: false },
        null,
        2,
      ),
    );
  else {
    const admin = await db.user.findFirst({
      where: { role: "ADMIN", active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) throw new Error("Nuk ka administrator aktiv.");
    let backupPath = null;
    if (changes.length) {
      const folder = resolve(root, ".local/backups");
      await mkdir(folder, { recursive: true, mode: 0o700 });
      backupPath = resolve(
        folder,
        `before-monthly-deadlines-${Date.now()}.erpbackup`,
      );
      await writeFile(
        backupPath,
        backups.encrypt(await backups.snapshot(db), env.BACKUP_KEY),
        { mode: 0o600 },
      );
    }
    const updated = await finance.atomic(db, async (tx) => {
      let count = 0;
      for (const row of changes) {
        const result = await tx.invoice.updateMany({
          where: {
            id: row.id,
            dueDate: finance.calendarDate(row.from),
            status: { in: ["UNPAID", "PARTIAL"] },
          },
          data: { dueDate: finance.calendarDate(row.to) },
        });
        if (result.count) {
          count++;
          await finance.audit(tx, admin.id, "INVOICE_DEADLINE_UPDATE", row.id);
        }
      }
      return count;
    });
    const report = { updated, backupPath, changedFields: ["dueDate"], changes };
    await mkdir(resolve(root, "output/monthly-deadlines"), { recursive: true });
    await writeFile(
      resolve(root, "output/monthly-deadlines/applied.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        { updated, backupPath, changedFields: ["dueDate"] },
        null,
        2,
      ),
    );
  }
} finally {
  await db.$disconnect();
}
