"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const snapshot_1 = require("../src/backups/snapshot");
const db = new client_1.PrismaClient();
async function main() {
  const file = process.argv[2];
  if (!file || process.env.RESTORE_CONFIRM !== "RESTORE_DIGITAL_SCHOOL")
    throw new Error(
      "Ndaleni API-në, vendosni RESTORE_CONFIRM=RESTORE_DIGITAL_SCHOOL dhe jepni rrugën e backup-it.",
    );
  if (!process.env.BACKUP_KEY) throw new Error("BACKUP_KEY mungon.");
  const backup = (0, snapshot_1.decrypt)(
    await (0, promises_1.readFile)(file),
    process.env.BACKUP_KEY,
  );
  const dir = (0, node_path_1.resolve)(
    process.env.BACKUP_DIR ?? ".local/backups",
  );
  await (0, promises_1.mkdir)(dir, { recursive: true, mode: 0o700 });
  await (0, promises_1.writeFile)(
    (0, node_path_1.resolve)(dir, `before-restore-${Date.now()}.erpbackup`),
    (0, snapshot_1.encrypt)(
      await (0, snapshot_1.snapshot)(db),
      process.env.BACKUP_KEY,
    ),
    { mode: 0o600 },
  );
  await (0, snapshot_1.restore)(db, backup);
  console.log(
    "Rikthimi përfundoi. Sesionet u revokuan; përdoruesit duhet të kyçen përsëri.",
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
