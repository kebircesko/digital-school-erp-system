import { spawnSync } from "node:child_process";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function run(args, env = {}) {
  const result = spawnSync(npm, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
  if (result.status !== 0)
    throw new Error(`Command failed: npm ${args.join(" ")}`);
}
try {
  run(["run", "build"]);
  run(["run", "build", "-w", "@erp/desktop"], {
    VITE_API_URL: "http://127.0.0.1:3109/api",
  });
  run(["run", "test:integration"], { UI_TEST: "1", ERP_UI_TEST: "1" });
} finally {
  run(["run", "build", "-w", "@erp/desktop"]);
}
