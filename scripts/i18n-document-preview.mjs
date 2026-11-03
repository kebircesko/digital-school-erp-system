// Synthetic invoices and reports for language/layout verification only.
import { mkdir, writeFile } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import invoice from "../apps/api/src/reports/invoice.js";
import documents from "../apps/api/src/reports/documents.js";
import i18n from "../apps/api/src/common/i18n.js";
const dec = (v) => new Prisma.Decimal(v);
const sample = {
  number: "TEST-2026-001",
  studentName: "Arbër Gashi",
  student: { address: "Prizren" },
  courseName: "Programim",
  period: "2026-11",
  issuedAt: new Date("2026-11-01"),
  dueDate: new Date("2026-12-05"),
  subtotal: dec(40),
  discount: dec(5),
  amount: dec(35),
  paidAmount: dec(15),
  status: "PARTIAL",
  allocations: [
    {
      amount: dec(15),
      payment: {
        paidAt: new Date("2026-11-02"),
        method: "CASH",
        reversedAt: null,
      },
    },
  ],
};
await mkdir("output/i18n", { recursive: true });
for (const language of ["sq", "en"]) {
  await i18n.locale.run(language, async () => {
    await writeFile(
      `output/i18n/invoice-${language}.pdf`,
      await invoice.invoicePdf(sample),
    );
    await writeFile(
      `output/i18n/report-${language}.pdf`,
      await documents.pdf(
        i18n.t("Raport financiar"),
        "2026-11-01 - 2026-11-30",
        [
          [i18n.t("Totali i arkëtuar"), "15.00 EUR"],
          ["Arbër Gashi · Programim", "15.00 EUR"],
        ],
      ),
    );
  });
}
console.log("Created synthetic PDF previews in Albanian and English.");
