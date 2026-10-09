import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Logger,
} from "@nestjs/common";
@Catch()
export class DatabaseErrors implements ExceptionFilter {
  private logger = new Logger("API");
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      response
        .status(error.getStatus())
        .json(
          typeof body === "string"
            ? { statusCode: error.getStatus(), message: body }
            : body,
        );
      return;
    }
    let code = (error as { code?: string })?.code;
    // Some PostgreSQL versions surface SQLSTATE inside an unknown Prisma error.
    const message = (error as Error)?.message ?? "";
    if (!code && message.includes("23503")) code = "P2003";
    if (!code && message.includes("23505")) code = "P2002";
    if (!code && message.includes("23514")) code = "P2004";
    if (typeof code === "string" && /^P\d{4}$/.test(code)) {
      const status =
        code === "P2025"
          ? 404
          : ["P2002", "P2003", "P2014", "P2034"].includes(code)
            ? 409
            : 400;
      const message =
        code === "P2002"
          ? "Ky regjistrim ekziston tashmë."
          : ["P2003", "P2014"].includes(code)
            ? "Regjistrimi ka historik të lidhur. Çaktivizojeni në vend të fshirjes."
            : code === "P2025"
              ? "Regjistrimi nuk u gjet."
              : "Të dhënat janë të pavlefshme ose janë ndryshuar nga një përdorues tjetër.";
      response.status(status).json({ statusCode: status, message });
      return;
    }
    this.logger.error("Gabim i papritur në API: " + (error as Error)?.name);
    response.status(500).json({
      statusCode: 500,
      message: "Gabim i brendshëm në server. Provoni përsëri.",
    });
  }
}
