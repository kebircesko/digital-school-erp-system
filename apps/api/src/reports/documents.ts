import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { resolve } from "node:path";
export async function pdf(
  title: string,
  reference: string,
  rows: [string, string][],
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.registerFont(
    "Regular",
    resolve(__dirname, "../../assets/DejaVuSans.ttf"),
  );
  doc.registerFont(
    "Bold",
    resolve(__dirname, "../../assets/DejaVuSans-Bold.ttf"),
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
export async function excel(
  title: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const book = new ExcelJS.Workbook();
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
