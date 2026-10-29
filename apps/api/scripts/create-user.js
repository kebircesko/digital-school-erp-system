"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const password_1 = require("../src/auth/password");
const db = new client_1.PrismaClient();
async function main() {
  const email = process.env.NEW_USER_EMAIL?.trim().toLowerCase(),
    password = process.env.NEW_USER_PASSWORD,
    role = process.env.NEW_USER_ROLE;
  if (
    !email ||
    !password ||
    password.length < 12 ||
    !Object.values(client_1.Role).includes(role)
  )
    throw new Error(
      "Kërkohen NEW_USER_EMAIL, NEW_USER_PASSWORD (12+ karaktere), NEW_USER_ROLE (ADMIN/FINANCE/INSTRUCTOR).",
    );
  await db.user.create({
    data: {
      email,
      passwordHash: (0, password_1.hashPassword)(password),
      name: process.env.NEW_USER_NAME ?? email,
      role,
    },
  });
  console.log("Përdoruesi u krijua.");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
