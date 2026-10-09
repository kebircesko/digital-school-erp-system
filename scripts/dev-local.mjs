import EmbeddedPostgres from "embedded-postgres";
import { createConnection } from "node:net";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  access,
  readdir,
  utimes,
} from "node:fs/promises";
import { resolve } from "node:path";
import dotenv from "dotenv";
async function main() {
  const root = resolve(import.meta.dirname, "..");
  const local = resolve(root, ".local");
  const envPath = resolve(root, "apps/api/.env");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  async function exists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
  function run(args, env = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(npm, args, {
        cwd: root,
        env: { ...process.env, ...env },
        stdio: "inherit",
        shell: process.platform === "win32",
      });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`npm ${args.join(" ")} dështoi.`)),
      );
    });
  }
  await mkdir(local, { recursive: true, mode: 0o700 });
  const configPath = resolve(local, "postgres.json");
  if (!(await exists(configPath)))
    await writeFile(
      configPath,
      JSON.stringify({ password: randomBytes(32).toString("hex") }),
      { mode: 0o600 },
    );
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const url = `postgresql://erp:${config.password}@127.0.0.1:55432/digital_school`;
  if (await exists(envPath)) {
    const current = dotenv.parse(await readFile(envPath));
    if (current.DATABASE_URL !== url)
      throw new Error(
        "apps/api/.env përdor një databazë tjetër. Përdorni npm run dev për atë konfigurim; dev:local nuk e ndryshon.",
      );
  } else {
    await writeFile(
      envPath,
      `DATABASE_URL=${url}\nHOST=127.0.0.1\nPORT=3000\nCORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,app://erp\nADMIN_EMAIL=admin@shkolla.local\nADMIN_PASSWORD=${randomBytes(18).toString("base64url")}\nADMIN_NAME=Administrator\n`,
      { mode: 0o600 },
    );
  }
  let localEnvironment = await readFile(envPath, "utf8");
  let keyAdded = false;
  if (!dotenv.parse(localEnvironment).BACKUP_KEY) {
    keyAdded = true;
    localEnvironment += `\nBACKUP_KEY=${randomBytes(32).toString("hex")}\nBACKUP_DIR=${resolve(local, "backups")}\n`;
    await writeFile(envPath, localEnvironment, { mode: 0o600 });
  }
  const desktopEnv = resolve(root, "apps/desktop/.env");
  if (!(await exists(desktopEnv)))
    await writeFile(desktopEnv, "VITE_API_URL=http://127.0.0.1:3000/api\n", {
      mode: 0o600,
    });
  const dbDir = resolve(local, "postgres");
  let postgresOutput = "";
  const pg = new EmbeddedPostgres({
    databaseDir: dbDir,
    user: "erp",
    password: config.password,
    port: 55432,
    persistent: true,
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: (message) => {
      postgresOutput = (postgresOutput + message).slice(-4000);
    },
    onError: (message) => console.error(message),
  });
  let started = false,
    child,
    stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    child?.kill("SIGTERM");
    if (started) await pg.stop();
  }
  process.on("SIGINT", () => {
    stop().finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    stop().finally(() => process.exit(0));
  });
  try {
    const portOpen = await new Promise((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port: 55432 });
      const finish = (value) => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(1500);
      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.once("timeout", () => finish(false));
    });
    if (portOpen) {
      const probe = pg.getPgClient("postgres", "127.0.0.1");
      try {
        await probe.connect();
        const result = await probe.query("SHOW data_directory");
        if (resolve(result.rows[0].data_directory) !== dbDir)
          throw new Error("Databazë tjetër në portën lokale.");
      } catch {
        throw new Error(
          "Porta 55432 përdoret nga një shërbim tjetër ose kredencialet lokale nuk përputhen. Databaza ekzistuese nuk u ndryshua.",
        );
      } finally {
        await probe.end();
      }
      console.log(
        "PostgreSQL lokal është tashmë aktiv; po përdor instancën ekzistuese.",
      );
      // A repeated start must not regenerate files or restart services already in use.
      try {
        const [api, ui] = await Promise.all([
          fetch("http://127.0.0.1:3000/api/auth/me", {
            signal: AbortSignal.timeout(2000),
          }),
          fetch("http://127.0.0.1:5173", { signal: AbortSignal.timeout(2000) }),
        ]);
        if (
          api.status === 401 &&
          (await api.json()).message === "Ju lutemi kyçuni." &&
          (await ui.text()).includes("<title>Shkolla Digjitale")
        ) {
          const check = pg.getPgClient("digital_school", "127.0.0.1");
          let migrated = false;
          try {
            await check.connect();
            const applied = await check.query(
              'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
            );
            const expected = (
              await readdir(resolve(root, "apps/api/prisma/migrations"), {
                withFileTypes: true,
              })
            )
              .filter((item) => item.isDirectory())
              .map((item) => item.name);
            migrated = expected.every((name) =>
              applied.rows.some((row) => row.migration_name === name),
            );
          } finally {
            await check.end();
          }
          if (migrated) {
            if (
              keyAdded &&
              (await exists(resolve(root, "apps/api/dist/main.js")))
            ) {
              const now = new Date();
              await utimes(resolve(root, "apps/api/dist/main.js"), now, now);
            }
            console.log(
              "API-ja dhe ndërfaqja janë aktive. Hapni http://localhost:5173 ose aplikacionin Electron.",
            );
            return;
          }
        }
      } catch {}
    } else {
      if (!(await exists(resolve(dbDir, "PG_VERSION")))) await pg.initialise();
      try {
        await pg.start();
      } catch {
        throw new Error(
          "PostgreSQL lokal nuk u nis. " +
            (postgresOutput.trim() ||
              "Kontrolloni portën 55432 dhe lejet e dosjes .local/postgres."),
        );
      }
      started = true;
    }
    const client = pg.getPgClient();
    await client.connect();
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      ["digital_school"],
    );
    if (!result.rowCount)
      await client.query('CREATE DATABASE "digital_school"');
    await client.end();
    await run(["run", "db:generate"], {
      XDG_CACHE_HOME: resolve(local, "cache"),
    });
    await run(["run", "db:migrate"], { DATABASE_URL: url });
    const check = pg.getPgClient("digital_school");
    await check.connect();
    const users = await check.query(
      'SELECT COUNT(*)::int AS count FROM "User"',
    );
    await check.end();
    if (!users.rows[0].count) await run(["run", "db:seed"]);
    await run(["run", "build", "-w", "@erp/shared"]);
    console.log(
      "\nDatabaza lokale është gati. Llogaria fillestare: ADMIN_EMAIL dhe ADMIN_PASSWORD në apps/api/.env.",
    );
    console.log(
      "Ndërfaqja: http://localhost:5173 · Electron: ELECTRON_DEV=1 npm run desktop\n",
    );
    let frontendRunning = false;
    try {
      const response = await fetch("http://127.0.0.1:5173", {
        signal: AbortSignal.timeout(2000),
      });
      frontendRunning = (await response.text()).includes(
        "<title>Shkolla Digjitale",
      );
      if (!frontendRunning)
        throw new Error("Porta 5173 përdoret nga një aplikacion tjetër.");
    } catch (error) {
      if (error.message === "Porta 5173 përdoret nga një aplikacion tjetër.")
        throw error;
    }
    let apiRunning = false;
    try {
      const response = await fetch("http://127.0.0.1:3000/api/auth/me", {
        signal: AbortSignal.timeout(2000),
      });
      const body = await response.json();
      apiRunning =
        response.status === 401 && body.message === "Ju lutemi kyçuni.";
    } catch {}
    if (frontendRunning && apiRunning) {
      console.log(
        "Ndërfaqja dhe API-ja janë tashmë të hapura. Databaza lokale do të qëndrojë aktive.",
      );
      if (!started) return;
      await new Promise(() => {});
    }
    if (frontendRunning)
      console.log("Ndërfaqja është tashmë e hapur. Po nis vetëm API-në.");
    child = spawn(
      npm,
      frontendRunning
        ? ["run", "dev", "-w", "@erp/api"]
        : apiRunning
          ? ["run", "dev", "-w", "@erp/desktop"]
          : ["run", "dev"],
      {
        cwd: root,
        env: process.env,
        stdio: "inherit",
        shell: process.platform === "win32",
      },
    );
    await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0 || stopping
          ? resolve()
          : reject(new Error("Procesi i zhvillimit u ndal me gabim.")),
      );
    });
  } finally {
    await stop();
  }
}
main().catch((error) => {
  console.error(
    "Nisja lokale dështoi:",
    error instanceof Error
      ? error.message
      : "Gabim i panjohur. Kontrolloni konfigurimin lokal.",
  );
  process.exitCode = 1;
});
