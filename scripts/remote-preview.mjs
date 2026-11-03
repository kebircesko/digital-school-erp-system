// Temporary remote desktop connection; requires .local/bin/cloudflared.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, open, realpath, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const binary = `${root}.local/bin/cloudflared`;
const statePath = `${root}.local/remote-access.json`;
const logPath = `${root}.local/remote-access.log`;
const command = process.argv[2] ?? "status";
if (!["start", "status", "stop"].includes(command)) {
  console.error("Përdor: node scripts/remote-preview.mjs start|status|stop");
  process.exit(1);
}
const saved = await readFile(statePath, "utf8").then(JSON.parse).catch(() => null);
const running = saved && Number.isInteger(saved.pid) && saved.pid > 0 &&
  await realpath(`/proc/${saved.pid}/exe`).then(p => p === binary).catch(() => false);

if (command === "stop") {
  if (running) process.kill(saved.pid, "SIGTERM");
  await rm(statePath, { force: true });
  console.log("Lidhja e përkohshme u ndal. Serveri lokal vazhdon të punojë.");
} else if (running) {
  if (!saved.url) {
    const logText = await readFile(logPath, "utf8").catch(() => "");
    const url = logText.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/)?.[0];
    if (url) {
      saved.url = `${url}/api`;
      await writeFile(statePath, JSON.stringify(saved, null, 2), { mode: 0o600 });
    }
  }
  console.log(saved.url ?? `Lidhja po niset. Kontrollo ${logPath}`);
} else if (command === "status") {
  console.log("Lidhja e përkohshme nuk është aktive.");
} else {
  const response = await fetch("http://127.0.0.1:3000/api/auth/me", {
    signal: AbortSignal.timeout(5000),
  });
  if (response.status !== 401) throw Error("API lokale nuk është gati ose nuk kërkon kyçje.");
  await mkdir(`${root}.local`, { recursive: true });
  const log = await open(logPath, "w", 0o600);
  let child;
  try {
    child = spawn(binary, ["tunnel", "--config", "/dev/null", "--no-autoupdate",
      "--protocol", "http2", "--edge-ip-version", "4", "--url", "http://127.0.0.1:3000"], {
      cwd: root, detached: true, stdio: ["ignore", log.fd, log.fd],
    });
    await new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
  } finally {
    await log.close();
  }
  child.unref();
  const state = { pid: child.pid, startedAt: new Date().toISOString(), url: null };
  await writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  for (let attempt = 0; attempt < 80; attempt++) {
    await delay(500);
    const logText = await readFile(logPath, "utf8");
    const url = logText.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/)?.[0];
    if (url && logText.includes("Registered tunnel connection")) {
      state.url = `${url}/api`;
      await writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
      console.log(state.url);
      console.log("Adresë e përkohshme. Mbaje këtë kompjuter dhe API-në ndezur.");
      break;
    }
    if (attempt === 79) {
      console.error(`Adresa ende nuk u krijua. Kontrollo ${logPath}`);
      process.exitCode = 1;
    }
  }
}
