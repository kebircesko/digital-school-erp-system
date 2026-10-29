"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdf = pdf;
exports.excel = excel;
const tslib_1 = require("tslib");
const pdfkit_1 = tslib_1.__importDefault(require("pdfkit"));
const exceljs_1 = tslib_1.__importDefault(require("exceljs"));
const node_path_1 = require("node:path");
async function pdf(title, reference, rows) {
  const doc = new pdfkit_1.default({
    size: "A4",
    margin: 48,
    bufferPages: true,
  });
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.registerFont(
    "Regular",
    (0, node_path_1.resolve)(__dirname, "../../assets/DejaVuSans.ttf"),
  );
  doc.registerFont(
    "Bold",
    (0, node_path_1.resolve)(__dirname, "../../assets/DejaVuSans-Bold.ttf"),
  );
  doc
    .font("Bold")
    .fillColor("#00004E")
    .fontSize(17)
    .text("SHKOLLA DIGJITALE PRIZREN");
  doc
    .font("Regular")
    .fillColor("#77778C")
    .fontSize(10)
    .text("Platforma e menaxhimit të shkollës")
    .moveDown(2);
  doc.font("Bold").fillColor("#00004E").fontSize(23).text(title);
  doc
    .font("Regular")
    .fillColor("#77778C")
    .fontSize(11)
    .text(reference)
    .moveDown(1.5);
  for (const [label, value] of rows) {
    doc.font("Regular").fontSize(10);
    const height =
      Math.max(
        doc.heightOfString(label, { width: 155 }),
        doc.heightOfString(value, { width: 307 }),
      ) + 22;
    if (doc.y + height > 740) doc.addPage();
    const y = doc.y;
    doc.fillColor("#F4F5FA").rect(48, y, 499, height).fill();
    doc.fillColor("#62627D").text(label, 60, y + 10, { width: 155 });
    doc.fillColor("#20203A").text(value, 228, y + 10, { width: 307 });
    doc.y = y + height + 5;
    doc.x = 48;
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Regular")
      .fontSize(8)
      .fillColor("#77778C")
      .text("Shkolla Digjitale Prizren · EUR", 48, 780, { lineBreak: false });
    doc.text(`${i + 1} / ${range.count}`, 480, 780, { lineBreak: false });
  }
  doc.end();
  return finished;
}
async function excel(title, headers, rows) {
  const book = new exceljs_1.default.Workbook();
  book.creator = "Shkolla Digjitale Prizren";
  const sheet = book.addWorksheet(title.slice(0, 31));
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF00004E" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of rows) sheet.addRow(row);
  sheet.columns = headers.map((_, i) => ({ width: i === 0 ? 28 : 22 }));
  sheet.autoFilter = { from: "A1", to: { row: 1, column: headers.length } };
  return Buffer.from(await book.xlsx.writeBuffer());
}
