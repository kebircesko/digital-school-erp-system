import { erpChecks } from "./erp-integration.mjs";
import EmbeddedPostgres from "embedded-postgres";
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import password from "../apps/api/dist/auth/password.js";
const dir = await mkdtemp(join(tmpdir(), "erp-pg-"));
const secret = randomBytes(24).toString("hex");
const url = `postgresql://erp:${secret}@127.0.0.1:55439/erp_test`;
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "erp",
  password: secret,
  port: 55439,
  persistent: false,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
const backupKey = randomBytes(32).toString("hex");
process.env.ERP_TEST_BACKUP_KEY = backupKey;
let server,
  db,
  logs = "";
function command(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const executable =
      cmd === "npm" && process.platform === "win32" ? "npm.cmd" : cmd;
    const child = spawn(executable, args, {
      shell: executable === "npm.cmd",
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} failed: ${code}`)),
    );
  });
}
const base = "http://127.0.0.1:3109/api";
let passed = 0;
async function request(path, method = "GET", body, token, expected = 200) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await res.json();
  assert.equal(
    res.status,
    expected,
    `${method} ${path}: ${JSON.stringify(result)}`,
  );
  passed++;
  return result;
}
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("erp_test");
  await command("npm", ["run", "db:migrate"], { DATABASE_URL: url });
  db = new PrismaClient({ datasources: { db: { url } } });
  const loginPassword = randomBytes(20).toString("hex");
  for (const role of ["ADMIN", "FINANCE", "INSTRUCTOR"])
    await db.user.create({
      data: {
        email: `${role.toLowerCase()}@test.invalid`,
        name: `Test ${role}`,
        role,
        passwordHash: password.hashPassword(loginPassword),
      },
    });
  server = spawn(process.execPath, ["apps/api/dist/main.js"], {
    env: {
      ...process.env,
      DATABASE_URL: url,
      PORT: "3109",
      AUTO_INVOICES: "false",
      AUTO_BACKUP: "false",
      BACKUP_KEY: backupKey,
      BACKUP_DIR: join(dir, "backups"),
      HOST: "127.0.0.1",
      CORS_ORIGINS: "http://localhost:5173,app://erp",
    },
  });
  server.stdout.on("data", (b) => (logs += b));
  server.stderr.on("data", (b) => (logs += b));
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(base + "/auth/me");
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (!ready) throw new Error("API did not start: " + logs);
  await request("/students", "GET", undefined, undefined, 401);
  await request(
    "/auth/login",
    "POST",
    { email: "admin@test.invalid", password: "wrong" },
    undefined,
    401,
  );
  const admin = (
    await request(
      "/auth/login",
      "POST",
      { email: "admin@test.invalid", password: loginPassword },
      undefined,
      201,
    )
  ).token;
  const finance = (
    await request(
      "/auth/login",
      "POST",
      { email: "finance@test.invalid", password: loginPassword },
      undefined,
      201,
    )
  ).token;
  const instructor = (
    await request(
      "/auth/login",
      "POST",
      { email: "instructor@test.invalid", password: loginPassword },
      undefined,
      201,
    )
  ).token;
  const student = {
    firstName: "Nxënës",
    lastName: "Sintetik",
    birthDate: "2013-06-15",
    parentName: "Prind Sintetik",
    parentPhone: "+383 44000000",
    address: "Adresë testimi",
    notes: "Vetëm test",
    status: "ACTIVE",
  };
  await request("/students", "POST", student, instructor, 403);
  await request(
    "/students",
    "POST",
    { ...student, birthDate: "2025-02-30" },
    admin,
    400,
  );
  await request(
    "/students",
    "POST",
    { ...student, extra: "forbidden" },
    admin,
    400,
  );
  const created = await request("/students", "POST", student, admin, 201);
  assert.equal(
    (await request("/students/" + created.id, "GET", undefined, instructor))
      .firstName,
    student.firstName,
  );
  assert.equal(
    (
      await request(
        "/students?search=sintetik&status=ACTIVE",
        "GET",
        undefined,
        finance,
      )
    ).total,
    1,
  );
  const dashboard = await request("/dashboard", "GET", undefined, admin);
  assert.equal(dashboard.total, 1);
  assert.equal(dashboard.active, 1);
  const changed = await request(
    "/students/" + created.id,
    "PATCH",
    { ...student, status: "INACTIVE", version: 1 },
    finance,
  );
  assert.equal(changed.version, 2);
  await request(
    "/students/" + created.id,
    "PATCH",
    { ...student, version: 1 },
    admin,
    409,
  );
  const concurrent = await Promise.all([
    fetch(base + "/students/" + created.id, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${admin}`,
      },
      body: JSON.stringify({ ...student, version: 2 }),
    }),
    fetch(base + "/students/" + created.id, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${finance}`,
      },
      body: JSON.stringify({ ...student, version: 2 }),
    }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  passed++;
  await request("/students/" + created.id, "DELETE", undefined, finance, 403);
  await request("/students/not-a-uuid", "GET", undefined, admin, 400);
  await request("/students?page=0", "GET", undefined, admin, 400);
  const expired = randomBytes(32).toString("hex");
  const adminUser = await db.user.findUnique({
    where: { email: "admin@test.invalid" },
  });
  await db.session.create({
    data: {
      userId: adminUser.id,
      tokenHash: password.hashToken(expired),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await request("/students", "GET", undefined, expired, 401);
  await request("/auth/logout", "POST", undefined, instructor, 201);
  await request("/students", "GET", undefined, instructor, 401);
  await request("/students/" + created.id, "DELETE", undefined, admin);
  await request("/students/" + created.id, "GET", undefined, admin, 404);
  assert.equal(
    await db.auditLog.count({ where: { action: "STUDENT_CREATE" } }),
    1,
  );
  assert.equal(
    await db.auditLog.count({ where: { action: "STUDENT_UPDATE" } }),
    2,
  );
  assert.equal(
    await db.auditLog.count({ where: { action: "STUDENT_DELETE" } }),
    1,
  );
  passed += 3;
  if (process.env.ERP_TEST === "1") {
    const erpExtra = await erpChecks({
      request,
      admin,
      finance,
      instructor,
      db,
      pg,
      url,
      base,
      loginPassword,
    });
    passed += erpExtra;
  }
  if (process.env.UI_TEST === "1") {
    const { desktopSmoke } = await import("./ui-smoke.mjs");
    await desktopSmoke({
      email: "admin@test.invalid",
      password: loginPassword,
    });
    passed++;
    if (process.env.ERP_UI_TEST === "1") {
      const { erpDesktopSmoke } = await import("./erp-ui-smoke.mjs");
      await erpDesktopSmoke({
        email: "admin@test.invalid",
        password: loginPassword,
      });
      passed++;
    }
  }
  const summary = `${passed} integration checks passed against real PostgreSQL.\n`;
  console.log(summary);
  await writeFile(
    process.env.ERP_TEST === "1"
      ? "tests/last-erp-integration.txt"
      : process.env.UI_TEST === "1"
        ? "tests/last-desktop-integration.txt"
        : "tests/last-integration.txt",
    summary,
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(resolve, 3000).unref();
    });
  }
  if (db) await db.$disconnect();
  await pg.stop().catch(() => {});
  await rm(dir, { recursive: true, force: true });
}
