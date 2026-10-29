"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const password_1 = require("../src/auth/password");
const db = new client_1.PrismaClient();
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(),
    password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw new Error(
      "Vendosni ADMIN_EMAIL dhe ADMIN_PASSWORD (të paktën 12 karaktere).",
    );
  if (await db.user.count())
    throw new Error("Inicializimi lejohet vetëm në databazë pa përdorues.");
  await db.user.create({
    data: {
      email,
      name: process.env.ADMIN_NAME ?? "Administrator",
      role: client_1.Role.ADMIN,
      passwordHash: (0, password_1.hashPassword)(password),
    },
  });
  console.log("Administratori u krijua.");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
