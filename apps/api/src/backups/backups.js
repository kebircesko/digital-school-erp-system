"use strict";
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupsController = exports.BackupService = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const express_1 = require("express");
const prisma_service_1 = require("../common/prisma.service");
const auth_1 = require("../auth/auth");
const finance_1 = require("../common/finance");
const snapshot_1 = require("./snapshot");
let BackupService = class BackupService {
  db;
  busy = false;
  dir = (0, node_path_1.resolve)(process.env.BACKUP_DIR ?? ".local/backups");
  constructor(db) {
    this.db = db;
  }
  async list() {
    await (0, promises_1.mkdir)(this.dir, { recursive: true, mode: 0o700 });
    const names = (await (0, promises_1.readdir)(this.dir)).filter((n) =>
      /^backup-[a-zA-Z0-9-]+\.erpbackup$/.test(n),
    );
    return Promise.all(
      names
        .sort()
        .reverse()
        .map(async (name) => {
          const s = await (0, promises_1.stat)(
            (0, node_path_1.join)(this.dir, name),
          );
          return { name, size: s.size, createdAt: s.mtime.toISOString() };
        }),
    );
  }
  async create(userId) {
    if (this.busy)
      throw new common_1.BadRequestException(
        "Një backup është duke u krijuar.",
      );
    if (!process.env.BACKUP_KEY)
      throw new common_1.BadRequestException(
        "Konfiguroni BACKUP_KEY në server para backup-it.",
      );
    this.busy = true;
    try {
      const data = (0, snapshot_1.encrypt)(
        await (0, snapshot_1.snapshot)(this.db),
        process.env.BACKUP_KEY,
      );
      await (0, promises_1.mkdir)(this.dir, { recursive: true, mode: 0o700 });
      const name = `backup-${(0, finance_1.today)()}-${(0, node_crypto_1.randomUUID)()}.erpbackup`,
        temp = (0, node_path_1.join)(this.dir, name + ".tmp");
      await (0, promises_1.writeFile)(temp, data, { mode: 0o600 });
      await (0, promises_1.rename)(temp, (0, node_path_1.join)(this.dir, name));
      await this.db.auditLog.create({
        data: { userId, action: "BACKUP_CREATE", entityId: name },
      });
      return { name, size: data.length };
    } finally {
      this.busy = false;
    }
  }
  async initial() {
    if (process.env.AUTO_BACKUP === "false" || !process.env.BACKUP_KEY) return;
    const files = await this.list();
    if (
      !files.some((file) =>
        file.name.startsWith("backup-" + (0, finance_1.today)() + "-"),
      )
    )
      await this.scheduled();
  }
  async scheduled() {
    if (process.env.AUTO_BACKUP === "false" || !process.env.BACKUP_KEY) return;
    try {
      await this.create(null);
    } catch (error) {
      console.error(
        "Backup automatik dështoi:",
        error instanceof Error ? error.message : "Gabim",
      );
    }
  }
  async file(name) {
    if (!/^backup-[a-zA-Z0-9-]+\.erpbackup$/.test(name))
      throw new common_1.BadRequestException("Emri është i pavlefshëm.");
    try {
      return await (0, promises_1.readFile)(
        (0, node_path_1.join)(this.dir, name),
      );
    } catch {
      throw new common_1.NotFoundException("Backup-i nuk u gjet.");
    }
  }
};
exports.BackupService = BackupService;
tslib_1.__decorate(
  [
    (0, schedule_1.Timeout)(30000),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  BackupService.prototype,
  "initial",
  null,
);
tslib_1.__decorate(
  [
    (0, schedule_1.Cron)("0 0 2 * * *", { timeZone: "Europe/Tirane" }),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  BackupService.prototype,
  "scheduled",
  null,
);
exports.BackupService = BackupService = tslib_1.__decorate(
  [
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_a =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _a
        : Object,
    ]),
  ],
  BackupService,
);
let BackupsController = class BackupsController {
  backups;
  constructor(backups) {
    this.backups = backups;
  }
  list() {
    return this.backups.list();
  }
  create(req) {
    return this.backups.create(req.user.id);
  }
  async download(name, res) {
    res
      .type("application/octet-stream")
      .attachment(name)
      .send(await this.backups.file(name));
  }
};
exports.BackupsController = BackupsController;
tslib_1.__decorate(
  [
    (0, common_1.Get)(),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  BackupsController.prototype,
  "list",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Post)(),
    tslib_1.__param(0, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_b =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _b
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  BackupsController.prototype,
  "create",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)(":name"),
    tslib_1.__param(0, (0, common_1.Param)("name")),
    tslib_1.__param(1, (0, common_1.Res)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      String,
      typeof (_c =
        typeof express_1.Response !== "undefined" && express_1.Response) ===
      "function"
        ? _c
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  BackupsController.prototype,
  "download",
  null,
);
exports.BackupsController = BackupsController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("backups"),
    (0, auth_1.Roles)("ADMIN"),
    tslib_1.__metadata("design:paramtypes", [BackupService]),
  ],
  BackupsController,
);
