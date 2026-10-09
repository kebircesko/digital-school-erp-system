import { spawnSync } from "node:child_process";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const build = spawnSync(npm, ["run", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (build.status !== 0) process.exit(build.status ?? 1);
const tests = spawnSync(process.execPath, ["scripts/integration.mjs"], {
  stdio: "inherit",
  env: { ...process.env, ERP_TEST: "1" },
});
process.exit(tests.status ?? 1);
