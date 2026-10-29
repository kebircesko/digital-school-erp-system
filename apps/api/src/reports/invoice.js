"use strict";
const PDFDocument = require("pdfkit");
const { resolve } = require("node:path");
const formatDate = (value) =>
  value
    ? new Date(value).toISOString().slice(0, 10).split("-").reverse().join(".")
    : "-";

// A separate invoice layout keeps reports and receipts independent of the invoice design.
async function invoicePdf(invoice) {
  const doc = new PDFDocument({ size: "A4", margin: 36, bufferPages: true });
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
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
  const left = 36,
    right = 559,
    width = 523;
  function text(
    value,
    x,
    y,
    w,
    size = 9,
    bold = false,
    align = "left",
    color = "#111111",
  ) {
    doc
      .font(bold ? "Bold" : "Regular")
      .fontSize(size)
      .fillColor(color)
      .text(String(value), x, y, { width: w, align, lineGap: 2 });
  }
  function line(x, y, end, color = "#222222", weight = 0.5) {
    doc
      .lineWidth(weight)
      .strokeColor(color)
      .moveTo(x, y)
      .lineTo(end, y)
      .stroke();
  }
  function bulb() {
    doc
      .save()
      .translate(38, 43)
      .scale(0.68)
      .lineWidth(2.1)
      .strokeColor("#82B950");
    doc
      .moveTo(23, 8)
      .lineTo(23, 65)
      .bezierCurveTo(6, 78, 4, 95, 16, 105)
      .bezierCurveTo(25, 113, 42, 111, 49, 102)
      .bezierCurveTo(59, 88, 48, 74, 38, 65)
      .lineTo(38, 24)
      .stroke();
    doc
      .moveTo(29, 30)
      .lineTo(29, 71)
      .lineTo(20, 82)
      .lineTo(20, 94)
      .moveTo(35, 42)
      .lineTo(35, 74)
      .lineTo(43, 83)
      .lineTo(43, 95)
      .moveTo(28, 80)
      .lineTo(28, 102)
      .moveTo(35, 85)
      .lineTo(35, 102)
      .stroke();
    for (const [x, y] of [
      [23, 5],
      [38, 20],
      [29, 26],
      [35, 38],
      [20, 97],
      [43, 98],
      [28, 105],
      [35, 105],
    ])
      doc.circle(x, y, 3).stroke();
    doc.restore();
  }
  bulb();
  text(
    process.env.SCHOOL_NAME || "SHKOLLA DIGJITALE PRIZREN",
    85,
    44,
    320,
    14,
    true,
  );
  text("FATURË", 436, 44, 123, 24, true, "right", "#666666");
  text(
    `Nr. Fiskal: ${process.env.SCHOOL_FISCAL_NUMBER || "-"}`,
    86,
    70,
    300,
    9,
  );
  text(
    `Nr. i Biznesit: ${process.env.SCHOOL_BUSINESS_NUMBER || "-"}`,
    86,
    87,
    300,
    9,
  );
  text(
    `Nr. i TVSH-së: ${process.env.SCHOOL_VAT_NUMBER || "-"}`,
    86,
    104,
    300,
    9,
  );
  line(left, 132, right, "#888888", 1.6);
  line(left, 136, right, "#888888", 0.6);
  text("Blerësi", left + 10, 152, 270, 9);
  text(invoice.studentName, left + 10, 170, 280, 11, true);
  doc.font("Bold").fontSize(11);
  const buyerY =
    170 +
    Math.max(
      14,
      doc.heightOfString(invoice.studentName, { width: 280, lineGap: 2 }),
    ) +
    8;
  text("Nr. i TVSH-së: -", left + 10, buyerY, 270, 8);
  text("Nr. Fiskal: -", left + 10, buyerY + 16, 270, 8);
  text("Nr. i Biznesit: -", left + 10, buyerY + 32, 270, 8);
  const address =
    invoice.student?.address || process.env.SCHOOL_CITY || "Prizren, Kosovë";
  text(`Adresa: ${address}`, left + 10, buyerY + 48, 280, 8);
  const buyerBottom = doc.y;
  const allocations = (invoice.allocations || [])
    .filter((a) => !a.payment.reversedAt)
    .sort((a, b) => new Date(a.payment.paidAt) - new Date(b.payment.paidAt));
  const latest = allocations.at(-1)?.payment.paidAt;
  const metadata = [
    ["NR. I FATURËS:", invoice.number],
    ["DATA E FATURËS:", formatDate(invoice.issuedAt)],
    [
      latest ? "DATA E PAGESËS:" : "AFATI I PAGESËS:",
      formatDate(latest || invoice.dueDate),
    ],
    ["VALUTA:", "EUR"],
  ];
  metadata.forEach(([label, value], index) => {
    text(label, 363, 157 + index * 21, 103, 8);
    text(value, 467, 157 + index * 21, 92, 9, true);
  });
  const tableY = Math.max(283, buyerBottom + 20, doc.y + 16),
    colWidths = [18, 190, 36, 38, 46, 45, 40, 48, 62];
  const headers = [
    "Nr",
    "Përshkrimi",
    "Grupi i\nTVSH-së",
    "Sasia",
    "Njësia",
    "Çmimi",
    "Zbritje",
    "Çmimi me\nzbritje",
    "Total",
  ];
  let x = left;
  for (let c = 0; c < headers.length; c++) {
    doc.fillColor("#E8E8E8").rect(x, tableY, colWidths[c], 37).fill();
    doc
      .lineWidth(0.5)
      .strokeColor("#222222")
      .rect(x, tableY, colWidths[c], 37)
      .stroke();
    text(
      headers[c],
      x + 3,
      tableY + 7,
      colWidths[c] - 6,
      7,
      c === 0 || c === 1,
      c === 1 ? "left" : "center",
    );
    x += colWidths[c];
  }
  const desc = `${invoice.courseName}\n${invoice.period}`;
  doc.font("Regular").fontSize(8);
  const rowHeight = Math.max(
    30,
    doc.heightOfString(desc, { width: 184, lineGap: 2 }) + 12,
  );
  const discounted = invoice.discount.gt(0);
  const values = [
    "1",
    desc,
    "0%",
    "1.00",
    "Shërbim",
    invoice.subtotal.toFixed(2),
    discounted ? invoice.discount.toFixed(2) : "",
    discounted ? invoice.amount.toFixed(2) : "",
    invoice.amount.toFixed(2),
  ];
  x = left;
  for (let c = 0; c < values.length; c++) {
    doc
      .lineWidth(0.5)
      .strokeColor("#222222")
      .rect(x, tableY + 37, colWidths[c], rowHeight)
      .stroke();
    text(
      values[c],
      x + 3,
      tableY + 43,
      colWidths[c] - 6,
      8,
      false,
      c === 1 ? "left" : c >= 5 ? "right" : "center",
    );
    x += colWidths[c];
  }
  const totalY = tableY + 37 + rowHeight;
  [
    ["Vlera Neto", invoice.amount.toFixed(2)],
    ["TVSH", "0.00"],
    ["Total për pagesë", invoice.amount.toFixed(2)],
  ].forEach(([label, value], index) => {
    text(label, 359, totalY + index * 19 + 4, 132, 9, index === 2, "right");
    doc
      .lineWidth(0.5)
      .strokeColor("#222222")
      .rect(497, totalY + index * 19, 62, 19)
      .stroke();
    text(value, 501, totalY + index * 19 + 4, 54, 9, true, "right");
  });
  if (invoice.status === "PARTIAL") {
    text(
      `Paguar: ${invoice.paidAmount.toFixed(2)} EUR`,
      365,
      totalY + 65,
      194,
      8,
      false,
      "right",
    );
    text(
      `Mbetja: ${invoice.amount.minus(invoice.paidAmount).toFixed(2)} EUR`,
      365,
      totalY + 81,
      194,
      9,
      true,
      "right",
    );
  }
  let paymentY = totalY + 108;
  function paymentHeader() {
    text("Pagesa", left + 8, paymentY, 340, 9, true);
    paymentY += 17;
    let px = left + 8;
    const widths = [75, 102, 111, 76];
    ["Data", "Lloji i pagesës", "Paguar në", "Shuma e paguar"].forEach(
      (label, index) => {
        doc.fillColor("#A6A6A6").rect(px, paymentY, widths[index], 30).fill();
        text(
          label,
          px + 4,
          paymentY + 5,
          widths[index] - 8,
          8,
          false,
          "left",
          "#FFFFFF",
        );
        px += widths[index];
      },
    );
    paymentY += 30;
  }
  paymentHeader();
  const rows = allocations.length ? allocations : [null];
  for (const allocation of rows) {
    if (paymentY + 38 > 775) {
      doc.addPage();
      paymentY = 42;
      paymentHeader();
    }
    const payment = allocation?.payment;
    const values = payment
      ? [
          formatDate(payment.paidAt),
          payment.method === "CASH" ? "Të gatshme (Cash)" : "Transfer bankar",
          payment.method === "CASH" ? "Arka zyre" : "Bankë",
          allocation.amount.toFixed(2),
        ]
      : ["-", "Pa pagesë", "-", "0.00"];
    let px = left + 8;
    [75, 102, 111, 76].forEach((w, index) => {
      doc
        .lineWidth(0.4)
        .strokeColor("#888888")
        .rect(px, paymentY, w, 34)
        .stroke();
      text(
        values[index],
        px + 4,
        paymentY + 6,
        w - 8,
        8,
        false,
        index === 3 ? "right" : "left",
      );
      px += w;
    });
    paymentY += 34;
  }
  if (invoice.status === "VOID")
    text(
      "FATURË E ANULUAR",
      left,
      paymentY + 22,
      width,
      14,
      true,
      "left",
      "#B42318",
    );
  const range = doc.bufferedPageRange();
  if (range.count > 1)
    for (let n = 0; n < range.count; n++) {
      doc.switchToPage(n);
      text(
        `${n + 1} / ${range.count}`,
        500,
        780,
        59,
        8,
        false,
        "right",
        "#888888",
      );
    }
  doc.end();
  return finished;
}
module.exports = { invoicePdf };
