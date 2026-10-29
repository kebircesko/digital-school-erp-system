import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdir, stat } from "node:fs/promises";
import ExcelJS from "exceljs";
export async function erpDesktopSmoke(credentials) {
  const env = { ...process.env, ELECTRON_DEV: "0" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ["apps/desktop"],
    env,
    timeout: 30000,
  });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    async function openPage(name) {
      const button = page.getByRole("button", { name, exact: true });
      if (!(await button.isVisible()))
        await page
          .locator(".nav-group")
          .filter({ hasText: name })
          .locator("summary")
          .click();
      await button.click();
    }

    await page.getByText("Konfigurimi i serverit", { exact: true }).click();
    const server = page.getByLabel("Adresa e API-së", { exact: true });
    const currentServer = await server.inputValue();
    await server.fill("http://server.test.invalid/api");
    await page.getByRole("button", { name: "Ruaj adresën" }).click();
    await page
      .getByRole("alert")
      .getByText(/Serveri në internet kërkon HTTPS/)
      .waitFor();
    await server.fill(currentServer);
    await page.getByRole("button", { name: "Ruaj adresën" }).click();
    await page
      .getByRole("status")
      .getByText("Adresa u ruajt. Mund të kyçeni.")
      .waitFor();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("erp-api-url")),
      currentServer,
    );
    await page.evaluate(() => localStorage.removeItem("erp-api-url"));
    await page.getByText("Konfigurimi i serverit", { exact: true }).click();
    await page.getByLabel("Emaili", { exact: true }).fill(credentials.email);
    await page
      .getByLabel("Fjalëkalimi", { exact: true })
      .fill(credentials.password);
    await page.getByRole("button", { name: "Kyçu në platformë" }).click();
    await page.getByRole("heading", { name: /Mirë se erdhe/ }).waitFor();
    await openPage("Përdoruesit");
    await page
      .getByRole("button", { name: "Shto përdorues", exact: true })
      .click();
    let modal = page.getByRole("dialog");
    await modal.getByLabel("Emri", { exact: true }).fill("Instruktor UI");
    await modal
      .getByLabel("Emaili", { exact: true })
      .fill("instructor-ui@test.invalid");
    await modal.getByLabel(/Fjalëkalimi/).fill(credentials.password);
    await modal.getByLabel("Roli", { exact: true }).selectOption("INSTRUCTOR");
    await modal.getByRole("button", { name: "Ruaj", exact: true }).click();
    await page
      .getByRole("cell", { name: "Instruktor UI", exact: true })
      .waitFor();
    await openPage("Kurset");
    await page.getByRole("button", { name: "Shto kurs", exact: true }).click();
    modal = page.getByRole("dialog");
    await modal.getByLabel("Emri i kursit").fill("Programim UI");
    await modal.getByLabel("Çmimi mujor EUR").fill("85.50");
    await modal.getByLabel("Kohëzgjatja në muaj").fill("12");
    await modal.getByRole("button", { name: "Ruaj", exact: true }).click();
    await page
      .getByRole("cell", { name: "Programim UI", exact: true })
      .waitFor();
    await openPage("Grupet");
    await page.getByRole("button", { name: "Shto grup", exact: true }).click();
    modal = page.getByRole("dialog");
    await modal.getByLabel("Emri i grupit").fill("Grupi UI");
    await modal
      .getByLabel("Kursi", { exact: true })
      .getByRole("option", { name: "Programim UI" })
      .waitFor({ state: "attached" });
    await modal
      .getByLabel("Kursi", { exact: true })
      .selectOption({ label: "Programim UI" });
    await modal
      .getByLabel("Instruktori", { exact: true })
      .getByRole("option", { name: "Instruktor UI" })
      .waitFor({ state: "attached" });
    await modal
      .getByLabel("Instruktori", { exact: true })
      .selectOption({ label: "Instruktor UI" });
    await modal.getByRole("button", { name: "Ruaj", exact: true }).click();
    await page.getByRole("cell", { name: "Grupi UI", exact: true }).waitFor();
    await openPage("Nxënësit");
    await page
      .getByRole("button", { name: "Regjistro nxënës", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal.getByLabel("Emri", { exact: true }).fill("Nxënës ERP");
    await modal.getByLabel("Mbiemri", { exact: true }).fill("UI");
    await modal.getByLabel("Data e lindjes").fill("2013-01-15");
    await modal
      .getByLabel("Emri i prindit / kujdestarit")
      .fill("Prind Sintetik");
    await modal.getByLabel("Telefoni i prindit").fill("+383 44000000");
    await modal.getByRole("button", { name: "Ruaj nxënësin" }).click();
    await page.getByText("Nxënës ERP UI", { exact: true }).waitFor();
    await openPage("Regjistrimet");
    await page
      .getByRole("button", { name: "Shto regjistrim", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal
      .getByLabel("Kërko: Nxënësi", { exact: true })
      .fill("Nxënës ERP");
    await modal.getByRole("option", { name: /Nxënës ERP UI/ }).click();
    await modal
      .getByLabel("Grupi", { exact: true })
      .getByRole("option", { name: "Grupi UI · Instruktor UI", exact: true })
      .waitFor({ state: "attached" });
    await modal
      .getByLabel("Grupi", { exact: true })
      .selectOption({ label: "Grupi UI · Instruktor UI" });
    await modal
      .getByLabel("Data e fillimit")
      .fill(new Date().toISOString().slice(0, 7) + "-01");
    await modal.getByLabel("Çmimi individual mujor EUR").fill("85.50");
    await modal.getByLabel("Zbritja mujore EUR").fill("5.50");
    await modal.getByRole("button", { name: "Ruaj", exact: true }).click();
    await page
      .getByRole("cell", { name: "Nxënës ERP UI", exact: true })
      .waitFor();
    await openPage("Faturat");
    await page
      .getByRole("button", { name: "Faturat e muajit", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Faturat e muajit", exact: true })
      .waitFor();
    await page.getByText("Importo mungesat nga Excel", { exact: true }).click();
    await mkdir("tests/artifacts", { recursive: true });
    const attendancePath =
      process.cwd() + `/tests/artifacts/ui-attendance-${Date.now()}.xlsx`;
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, attendancePath);
    await page
      .getByRole("button", { name: "Shkarko modelin", exact: true })
      .click();
    for (let i = 0; i < 50; i++) {
      try {
        if ((await stat(attendancePath)).size > 1000) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    const attendanceBook = new ExcelJS.Workbook();
    await attendanceBook.xlsx.readFile(attendancePath);
    const attendanceSheet = attendanceBook.worksheets[0];
    attendanceSheet.getCell("F2").value = 8;
    attendanceSheet.getCell("G2").value = 2;
    attendanceSheet.getCell("H2").value = 1;
    await page.getByLabel("Ngarko Excel të mungesave").setInputFiles({
      name: "mungesat-ui.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from(await attendanceBook.xlsx.writeBuffer()),
    });
    await page
      .getByRole("button", { name: "Konfirmo importin", exact: true })
      .click();
    await page.getByText(/1 rreshta mungesash u ruajtën/).waitFor();
    await page
      .locator(".monthly-invoices")
      .getByRole("button", { name: "Regjistro faturën", exact: true })
      .click();
    modal = page.getByRole("dialog", {
      name: "Regjistro faturën",
      exact: true,
    });
    await modal.getByLabel("Shuma e faturës EUR").waitFor();
    assert.equal(
      await modal.getByLabel("Shuma e faturës EUR").inputValue(),
      "80.00",
    );
    await modal.getByText("Mungesat për kontroll", { exact: true }).click();
    await modal.getByText(/2 mungesa nga 8 orë/).waitFor();
    await page.screenshot({
      path: "tests/artifacts/invoice-create.png",
      fullPage: true,
    });
    await modal
      .getByRole("button", { name: "Ruaj faturën", exact: true })
      .click();
    modal = page.getByRole("dialog", { name: "Fatura", exact: true });
    await modal.getByLabel("Shuma e pagesës EUR").waitFor();
    await modal.getByLabel("Shuma e pagesës EUR").fill("30.00");
    await modal
      .getByRole("button", { name: "Ruaj pagesën", exact: true })
      .click();
    await modal
      .getByText("Pagesa u ruajt. Fatura për printim përmban edhe pagesën.")
      .waitFor();
    await modal
      .locator(".invoice-balance")
      .getByText("50.00 €", { exact: true })
      .waitFor();
    await modal.getByRole("cell", { name: "30.00 €", exact: true }).waitFor();
    await modal.getByRole("button", { name: "Shiko PDF", exact: true }).click();
    const pdfPreview = page.getByRole("dialog", {
      name: "Pamja PDF",
      exact: true,
    });
    await pdfPreview
      .getByRole("button", { name: "Printo", exact: true })
      .waitFor();
    await pdfPreview.locator("canvas").waitFor();
    await pdfPreview
      .getByRole("button", { name: "Mbyll PDF-në", exact: true })
      .click();
    await page.screenshot({
      path: "tests/artifacts/invoice-with-payment.png",
      fullPage: true,
    });
    await modal
      .getByRole("button", { name: "Mbyll faturën", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Lista e faturave", exact: true })
      .click();
    await page
      .getByRole("cell", { name: "Nxënës ERP UI", exact: true })
      .waitFor();
    await page.screenshot({
      path: "tests/artifacts/invoices-simple.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Pagesat", exact: true }).click();
    await page.getByRole("cell", { name: "30 €", exact: true }).waitFor();
    await openPage("Borxhet");
    await page.getByRole("cell", { name: "50.00 €", exact: true }).waitFor();
    await mkdir("tests/screenshots", { recursive: true });
    await page.screenshot({ path: "tests/screenshots/erp-debts.png" });
    await openPage("Raportet");
    await page.getByText("30.00 €", { exact: true }).first().waitFor();
    const excelPath = process.cwd() + "/tests/artifacts/ui-report.xlsx";
    await mkdir("tests/artifacts", { recursive: true });
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, excelPath);
    await page
      .getByRole("button", { name: "Eksporto Excel", exact: true })
      .click();
    let saved = false;
    for (let i = 0; i < 50; i++) {
      try {
        if ((await stat(excelPath)).size > 1000) {
          saved = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(
      saved,
      true,
      "Excel export was saved through the desktop dialog.",
    );
    await openPage("Backup");
    await page
      .getByRole("button", { name: "Krijo backup", exact: true })
      .click();
    await page.getByText("Backup-i i enkriptuar u krijua.").waitFor();
    await openPage("Historiku");
    await page
      .getByRole("cell", { name: "Krijim kopjeje rezervë", exact: true })
      .waitFor();
    await openPage("Përmbledhja");
    await page.getByText("50.00 €", { exact: true }).waitFor();
    await page.screenshot({
      path: "tests/screenshots/erp-dashboard.png",
      fullPage: true,
    });
    // Complete payment directly from its invoice, then create next month from the same workspace.
    await openPage("Faturat");
    await page.getByRole("button", { name: "Paguaj", exact: true }).click();
    modal = page.getByRole("dialog", { name: "Fatura", exact: true });
    await modal.getByLabel("Shuma e pagesës EUR").waitFor();
    assert.equal(
      await modal.getByLabel("Shuma e pagesës EUR").inputValue(),
      "50.00",
    );
    await modal
      .getByRole("button", { name: "Ruaj pagesën", exact: true })
      .click();
    await modal
      .getByText("Pagesa u ruajt. Fatura për printim përmban edhe pagesën.")
      .waitFor();
    await modal
      .locator(".invoice-balance")
      .getByText("0.00 €", { exact: true })
      .waitFor();
    await modal
      .getByRole("button", { name: "Mbyll faturën", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Faturat e muajit", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Muaji i ardhshëm", exact: true })
      .click();
    await page
      .locator(".monthly-invoices")
      .getByRole("button", { name: "Regjistro faturën", exact: true })
      .click();
    modal = page.getByRole("dialog", {
      name: "Regjistro faturën",
      exact: true,
    });
    await modal.getByLabel("Shuma e faturës EUR").waitFor();
    await modal.getByLabel("Shuma e faturës EUR").fill("75.00");
    await modal
      .getByLabel("Arsyeja e ndryshimit")
      .fill("Zbritje sipas mungesave, vendim i adminit");
    await modal
      .getByRole("button", { name: "Ruaj faturën", exact: true })
      .click();
    modal = page.getByRole("dialog", { name: "Fatura", exact: true });
    await modal.getByLabel("Shuma e pagesës EUR").waitFor();
    assert.equal(
      await modal.getByLabel("Shuma e pagesës EUR").inputValue(),
      "75.00",
    );
    await modal
      .getByRole("button", { name: "Mbyll faturën", exact: true })
      .click();
    await page.getByRole("button", { name: "Çkyçu", exact: true }).click();
    await page
      .getByRole("heading", { name: "Kyçuni në hapësirën tuaj" })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "Electron ERP: përdorues, kurs, grup, nxënës, regjistrim, faturë, PDF, pagesë e pjesshme, borxhe, raporte Excel, backup, audit dhe dashboard kaluan.",
    );
  } finally {
    await app.close();
  }
}
