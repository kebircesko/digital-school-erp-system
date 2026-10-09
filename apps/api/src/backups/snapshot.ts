import { PrismaClient, Prisma } from "@prisma/client";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
export const tables = [
  "user",
  "student",
  "course",
  "group",
  "enrollment",
  "invoice",
  "payment",
  "paymentAllocation",
  "auditLog",
  "counter",
] as const;
export async function snapshot(db: PrismaClient) {
  return db.$transaction(
    async (tx) => {
      const records: Record<string, unknown[]> = {};
      for (const table of tables)
        records[table] = await (tx[table] as any).findMany();
      return { format: 1, createdAt: new Date().toISOString(), records };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 60000,
    },
  );
}
export function encrypt(data: unknown, key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new Error("BACKUP_KEY duhet të jetë një çelës hex me 64 karaktere.");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const content = Buffer.concat([
    cipher.update(gzipSync(Buffer.from(JSON.stringify(data)))),
    cipher.final(),
  ]);
  return Buffer.concat([
    Buffer.from("ERPBACK1"),
    iv,
    cipher.getAuthTag(),
    content,
  ]);
}
export function decrypt(data: Buffer, key: string) {
  if (data.subarray(0, 8).toString() !== "ERPBACK1")
    throw new Error("Skedari nuk është backup i ERP-së.");
  const decipher = createDecipheriv(
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
    gunzipSync(plain, { maxOutputLength: 512 * 1024 * 1024 }).toString(),
  );
  if (
    result.format !== 1 ||
    !tables.every((t) => Array.isArray(result.records?.[t]))
  )
    throw new Error("Formati i backup-it nuk mbështetet.");
  return result;
}
export async function restore(
  db: PrismaClient,
  backup: ReturnType<typeof decrypt>,
) {
  await db.$transaction(
    async (tx) => {
      await tx.session.deleteMany();
      for (const table of [...tables].reverse())
        await (tx[table] as any).deleteMany();
      for (const table of tables) {
        const rows = backup.records[table];
        if (table === "enrollment") {
          await tx.enrollment.createMany({
            data: rows.map((r: any) => ({ ...r, previousId: null })),
          });
          for (const row of rows)
            if (row.previousId)
              await tx.enrollment.update({
                where: { id: row.id },
                data: { previousId: row.previousId },
              });
        } else if (rows.length)
          await (tx[table] as any).createMany({ data: rows });
      }
    },
    {
      timeout: 120000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
