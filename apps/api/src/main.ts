import { DatabaseErrors } from "./common/errors";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5)
    throw new Error("TRUST_PROXY_HOPS është i pavlefshëm.");
  if (proxyHops)
    app.getHttpAdapter().getInstance().set("trust proxy", proxyHops);
  app.use(helmet());
  app.useGlobalFilters(new DatabaseErrors());
  const origins = (
    process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,app://erp"
  ).split(",");
  if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGINS)
    throw new Error("CORS_ORIGINS është i detyrueshëm në prodhim.");
  app.enableCors({
    origin: origins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: () =>
        new BadRequestException(
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
