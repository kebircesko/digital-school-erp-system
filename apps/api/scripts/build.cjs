const { cpSync, rmSync, readdirSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { execFileSync } = require("node:child_process");

const root = resolve(__dirname, "..");
const source = join(root, "src");
const destination = join(root, "dist");

function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) check(file);
    else if (entry.name.endsWith(".js"))
      execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
  }
}

check(source);
rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
