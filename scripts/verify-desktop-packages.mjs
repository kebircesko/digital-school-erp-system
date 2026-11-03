// Verify that both installers contain the current client and shared translations.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import asar from "@electron/asar";
const root = resolve("apps/desktop"),
  release = join(root, "release");
const { version } = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
);
const sha = async (file) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
};
const sourceFiles = [
  "electron/main.cjs",
  "electron/preload.cjs",
  "node_modules/@erp/shared/src/translate.cjs",
  "node_modules/@erp/shared/src/translate.mjs",
  "node_modules/@erp/shared/src/en.json",
];
const clientFiles = asar
  .listPackage(join(release, "linux-unpacked/resources/app.asar"))
  .filter(
    (file) =>
      file.startsWith("/dist/") &&
      !asar.statFile(
        join(release, "linux-unpacked/resources/app.asar"),
        file.slice(1),
      ).files,
  )
  .map((file) => file.slice(1));
assert.ok(
  clientFiles.some((file) => file.includes("pdf.worker")),
  "Include the PDF worker",
);
const platforms = {};
for (const platform of ["linux", "win"]) {
  const file = join(release, `${platform}-unpacked/resources/app.asar`);
  const metadata = JSON.parse(asar.extractFile(file, "package.json"));
  assert.equal(metadata.version, version);
  const entries = asar.listPackage(file);
  assert.ok(
    !entries.some((p) =>
      /^\/(?:\.env(?:\.|$)|\.aws\/|\.git\/|\.local\/|apps\/api\/)/.test(p),
    ),
    "Do not package server configuration or local data",
  );
  for (const path of [...sourceFiles, ...clientFiles]) {
    const source = path.startsWith("node_modules/@erp/shared/")
      ? resolve(
          "packages/shared",
          path.slice("node_modules/@erp/shared/".length),
        )
      : join(root, path);
    assert.deepEqual(
      asar.extractFile(file, path),
      await readFile(source),
      `${platform}: current ${path}`,
    );
  }
  platforms[platform] = {
    archiveSha256: await sha(file),
    checkedFiles: sourceFiles.length + clientFiles.length,
  };
}
const installer = join(release, `Shkolla Digjitale ERP Setup ${version}.exe`);
const temp = await mkdtemp(join(tmpdir(), "erp-installer-verify-"));
try {
  execFileSync(
    "7z",
    ["x", installer, "$PLUGINSDIR/app-64.7z", `-o${temp}`, "-y"],
    { stdio: "pipe" },
  );
  execFileSync(
    "7z",
    [
      "x",
      join(temp, "$PLUGINSDIR/app-64.7z"),
      "resources/app.asar",
      `-o${join(temp, "payload")}`,
      "-y",
    ],
    { stdio: "pipe" },
  );
  assert.equal(
    await sha(join(temp, "payload/resources/app.asar")),
    platforms.win.archiveSha256,
    "The Windows installer contains the verified application archive",
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
const artifacts = [];
for (const name of [
  `Shkolla Digjitale ERP-${version}.AppImage`,
  `Shkolla Digjitale ERP Setup ${version}.exe`,
]) {
  const file = join(release, name);
  artifacts.push({
    name,
    bytes: (await stat(file)).size,
    sha256: await sha(file),
  });
}
const checksums =
  artifacts.map((a) => `${a.sha256}  ${a.name}`).join("\n") + "\n";
await writeFile(join(release, `SHA256SUMS-${version}.txt`), checksums);
await writeFile(join(release, "SHA256SUMS.txt"), checksums);
await writeFile(
  join(release, `RELEASE-${version}.json`),
  JSON.stringify({ version, platforms, artifacts }, null, 2) + "\n",
);
console.log(
  `PASS: Windows installer payload and both ${version} archives contain the current renderer, PDF worker, native bridge and translation catalog. SHA-256 manifests written.`,
);
