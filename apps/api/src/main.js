"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const errors_1 = require("./common/errors");
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const helmet_1 = tslib_1.__importDefault(require("helmet"));
const app_module_1 = require("./app.module");
async function bootstrap() {
  const app = await core_1.NestFactory.create(app_module_1.AppModule, {
    bodyParser: false,
  });
  app.use(require("express").json({ limit: "3mb" }));
  app.setGlobalPrefix("api");
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5)
    throw new Error("TRUST_PROXY_HOPS është i pavlefshëm.");
  if (proxyHops)
    app.getHttpAdapter().getInstance().set("trust proxy", proxyHops);
  app.use((0, helmet_1.default)());
  app.useGlobalFilters(new errors_1.DatabaseErrors());
  const origins = (
    process.env.CORS_ORIGINS ??
    "http://localhost:5174,http://127.0.0.1:5174,app://erp"
  ).split(",");
  if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGINS)
    throw new Error("CORS_ORIGINS është i detyrueshëm në prodhim.");
  app.enableCors({
    origin: origins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });
  app.useGlobalPipes(
    new common_1.ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: () =>
        new common_1.BadRequestException(
          "Të dhënat e dërguara janë të pavlefshme. Kontrolloni fushat dhe provoni përsëri.",
        ),
    }),
  );
  app.enableShutdownHooks();
  await app.listen(
    Number(process.env.PORT ?? 3000),
    process.env.HOST ?? "127.0.0.1",
  );
}
bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
