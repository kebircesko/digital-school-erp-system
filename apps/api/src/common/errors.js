"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseErrors = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
let DatabaseErrors = class DatabaseErrors {
  logger = new common_1.Logger("API");
  catch(error, host) {
    const response = host.switchToHttp().getResponse();
    if (error instanceof common_1.HttpException) {
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
    let code = error?.code;
    // Some PostgreSQL versions surface SQLSTATE inside an unknown Prisma error.
    const message = error?.message ?? "";
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
    this.logger.error("Gabim i papritur në API: " + error?.name);
    response.status(500).json({
      statusCode: 500,
      message: "Gabim i brendshëm në server. Provoni përsëri.",
    });
  }
};
exports.DatabaseErrors = DatabaseErrors;
exports.DatabaseErrors = DatabaseErrors = tslib_1.__decorate(
  [(0, common_1.Catch)()],
  DatabaseErrors,
);
