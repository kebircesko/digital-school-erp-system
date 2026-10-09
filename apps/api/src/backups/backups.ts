import {
  Injectable,
  Controller,
  Get,
  Post,
  Param,
  Res,
  Req,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Cron, Timeout } from "@nestjs/schedule";
import {
  mkdir,
  readdir,
  stat,
  readFile,
  writeFile,
  unlink,
  rename,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { Response } from "express";
import { PrismaService } from "../common/prisma.service";
import { Roles, AuthRequest } from "../auth/auth";
import { audit, today } from "../common/finance";
import { snapshot, encrypt } from "./snapshot";
@Injectable()
export class BackupService {
  private busy = false;
  readonly dir = resolve(process.env.BACKUP_DIR ?? ".local/backups");
  constructor(private db: PrismaService) {}
  async list() {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const names = (await readdir(this.dir)).filter((n) =>
      /^backup-[a-zA-Z0-9-]+\.erpbackup$/.test(n),
    );
    return Promise.all(
      names
        .sort()
        .reverse()
        .map(async (name) => {
          const s = await stat(join(this.dir, name));
          return { name, size: s.size, createdAt: s.mtime.toISOString() };
        }),
    );
  }
  async create(userId: string | null) {
    if (this.busy)
      throw new BadRequestException("Një backup është duke u krijuar.");
    if (!process.env.BACKUP_KEY)
      throw new BadRequestException(
        "Konfiguroni BACKUP_KEY në server para backup-it.",
      );
    this.busy = true;
    try {
      const data = encrypt(await snapshot(this.db), process.env.BACKUP_KEY);
      await mkdir(this.dir, { recursive: true, mode: 0o700 });
      const name = `backup-${today()}-${randomUUID()}.erpbackup`,
        temp = join(this.dir, name + ".tmp");
      await writeFile(temp, data, { mode: 0o600 });
      await rename(temp, join(this.dir, name));
      await this.db.auditLog.create({
        data: { userId, action: "BACKUP_CREATE", entityId: name },
      });
      return { name, size: data.length };
    } finally {
      this.busy = false;
    }
  }
  @Timeout(30000) async initial() {
    if (process.env.AUTO_BACKUP === "false" || !process.env.BACKUP_KEY) return;
    const files = await this.list();
    if (!files.some((file) => file.name.startsWith("backup-" + today() + "-")))
      await this.scheduled();
  }
  @Cron("0 0 2 * * *", { timeZone: "Europe/Tirane" }) async scheduled() {
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
  async file(name: string) {
    if (!/^backup-[a-zA-Z0-9-]+\.erpbackup$/.test(name))
      throw new BadRequestException("Emri është i pavlefshëm.");
    try {
      return await readFile(join(this.dir, name));
    } catch {
      throw new NotFoundException("Backup-i nuk u gjet.");
    }
  }
}
@Controller("backups")
@Roles("ADMIN")
export class BackupsController {
  constructor(private backups: BackupService) {}
  @Get() list() {
    return this.backups.list();
  }
  @Post() create(@Req() req: AuthRequest) {
    return this.backups.create(req.user.id);
  }
  @Get(":name") async download(
    @Param("name") name: string,
    @Res() res: Response,
  ) {
    res
      .type("application/octet-stream")
      .attachment(name)
      .send(await this.backups.file(name));
  }
}
