"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tables = void 0;
exports.snapshot = snapshot;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.restore = restore;
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const node_zlib_1 = require("node:zlib");
exports.tables = [
  "user",
  "student",
  "course",
  "group",
  "enrollment",
  "invoice",
  "monthlyAttendance",
  "payment",
  "paymentAllocation",
  "auditLog",
  "counter",
];
async function snapshot(db) {
  return db.$transaction(
    async (tx) => {
      const records = {};
      for (const table of exports.tables)
        records[table] = await tx[table].findMany();
      return { format: 1, createdAt: new Date().toISOString(), records };
    },
    {
      isolationLevel: client_1.Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 60000,
    },
  );
}
function encrypt(data, key) {
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error("BACKUP_KEY duhet të jetë një çelës hex me 64 karaktere.");
  const iv = (0, node_crypto_1.randomBytes)(12),
    cipher = (0, node_crypto_1.createCipheriv)(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      iv,
    );
  const content = Buffer.concat([
    cipher.update((0, node_zlib_1.gzipSync)(Buffer.from(JSON.stringify(data)))),
    cipher.final(),
  ]);
  return Buffer.concat([
    Buffer.from("ERPBACK1"),
    iv,
    cipher.getAuthTag(),
    content,
  ]);
}
function decrypt(data, key) {
  if (data.subarray(0, 8).toString() !== "ERPBACK1")
    throw new Error("Skedari nuk është backup i ERP-së.");
  const decipher = (0, node_crypto_1.createDecipheriv)(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    data.subarray(8, 20),
  );
  decipher.setAuthTag(data.subarray(20, 36));
  const plain = Buffer.concat([
    decipher.update(data.subarray(36)),
    decipher.final(),
  ]);
  const result = JSON.parse(
    (0, node_zlib_1.gunzipSync)(plain, {
      maxOutputLength: 512 * 1024 * 1024,
    }).toString(),
  );
  // Older backups predate attendance tracking.
  if (
    result.format === 1 &&
    result.records &&
    result.records.monthlyAttendance === undefined
  )
    result.records.monthlyAttendance = [];
  if (
    result.format !== 1 ||
    !exports.tables.every((t) => Array.isArray(result.records?.[t]))
  )
    throw new Error("Formati i backup-it nuk mbështetet.");
  return result;
}
async function restore(db, backup) {
  await db.$transaction(
    async (tx) => {
      await tx.session.deleteMany();
      for (const table of [...exports.tables].reverse())
        await tx[table].deleteMany();
      for (const table of exports.tables) {
        const rows = backup.records[table].map((row) =>
          table === "invoice" && row.attendanceSnapshot == null
            ? { ...row, attendanceSnapshot: client_1.Prisma.DbNull }
            : table === "monthlyAttendance" && row.sourceCounts == null
              ? { ...row, sourceCounts: client_1.Prisma.DbNull }
              : row,
        );
        if (table === "enrollment") {
          await tx.enrollment.createMany({
            data: rows.map((r) => ({ ...r, previousId: null })),
          });
          for (const row of rows)
            if (row.previousId)
              await tx.enrollment.update({
                where: { id: row.id },
                data: { previousId: row.previousId },
              });
        } else if (rows.length) await tx[table].createMany({ data: rows });
      }
    },
    {
      timeout: 120000,
      isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
