import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
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
    await page
      .getByRole("button", { name: "Përdoruesit", exact: true })
      .click();
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
    await page.getByRole("button", { name: "Kurset", exact: true }).click();
    await page.getByRole("button", { name: "Shto kurs", exact: true }).click();
    modal = page.getByRole("dialog");
    await modal.getByLabel("Emri i kursit").fill("Programim UI");
    await modal.getByLabel("Çmimi mujor EUR").fill("85.50");
    await modal.getByLabel("Kohëzgjatja në muaj").fill("12");
    await modal.getByRole("button", { name: "Ruaj", exact: true }).click();
    await page
      .getByRole("cell", { name: "Programim UI", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Grupet", exact: true }).click();
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
    await page.getByRole("button", { name: "Nxënësit", exact: true }).click();
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
    await page
      .getByRole("button", { name: "Regjistrimet", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Shto regjistrim", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal
      .getByLabel("Nxënësi", { exact: true })
      .getByRole("option", { name: "Nxënës ERP UI" })
      .waitFor({ state: "attached" });
    await modal
      .getByLabel("Nxënësi", { exact: true })
      .selectOption({ label: "Nxënës ERP UI" });
    await modal
      .getByLabel("Grupi", { exact: true })
      .getByRole("option", { name: "Grupi UI" })
      .waitFor({ state: "attached" });
    await modal
      .getByLabel("Grupi", { exact: true })
      .selectOption({ label: "Grupi UI" });
    await modal
      .getByLabel("Data e fillimit")
      .fill(new Date().toISOString().slice(0, 7) + "-01");
    await modal.getByLabel("Çmimi individual mujor EUR").fill("85.50");
    await modal.getByLabel("Zbritja mujore EUR").fill("5.50");
    await modal.getByRole("button", { name: "Ruaj", exact: true }).click();
    await page
      .getByRole("cell", { name: "Nxënës ERP UI", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Faturat", exact: true }).click();
    await page
      .getByRole("button", { name: "Gjenero faturat", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Gjenero", exact: true })
      .click();
    await page
      .getByRole("cell", { name: "Nxënës ERP UI", exact: true })
      .waitFor();
    await page.getByRole("cell", { name: "80 €", exact: true }).waitFor();
    const pdfEvent = app.waitForEvent("window");
    await page
      .getByRole("button", { name: "PDF / Printo", exact: true })
      .click();
    const pdfWindow = await pdfEvent;
    await pdfWindow.waitForLoadState();
    assert.ok(pdfWindow.url().endsWith("/dokument.pdf"));
    await pdfWindow.close();
    await page.getByRole("button", { name: "Pagesat", exact: true }).click();
    await page
      .getByRole("button", { name: "Regjistro pagesë", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal
      .getByLabel("Nxënësi", { exact: true })
      .getByRole("option", { name: "Nxënës ERP UI" })
      .waitFor({ state: "attached" });
    await modal
      .getByLabel("Nxënësi", { exact: true })
      .selectOption({ label: "Nxënës ERP UI" });
    const check = modal.getByRole("checkbox");
    await check.waitFor();
    await check.check();
    const allocation = modal.getByLabel(/Shuma për/);
    await allocation.fill("30.00");
    await modal
      .getByRole("button", { name: "Regjistro pagesën", exact: true })
      .click();
    await page.getByRole("cell", { name: "30 €", exact: true }).waitFor();
    await page.getByRole("button", { name: "Borxhet", exact: true }).click();
    await page.getByRole("cell", { name: "50.00 €", exact: true }).waitFor();
    await mkdir("tests/screenshots", { recursive: true });
    await page.screenshot({ path: "tests/screenshots/erp-debts.png" });
    await page.getByRole("button", { name: "Raportet", exact: true }).click();
    await page.getByText("30.00 €", { exact: true }).first().waitFor();
    const excelPath = process.cwd() + "/tests/artifacts/ui-report.xlsx";
    await mkdir("tests/artifacts", { recursive: true });
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, excelPath);
    await page
      .getByRole("button", { name: "Eksporto Excel", exact: true })
      .click();
    const { stat } = await import("node:fs/promises");
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
    await page.getByRole("button", { name: "Backup", exact: true }).click();
    await page
      .getByRole("button", { name: "Krijo backup", exact: true })
      .click();
    await page.getByText("Backup-i i enkriptuar u krijua.").waitFor();
    await page.getByRole("button", { name: "Historiku", exact: true }).click();
    await page
      .getByRole("cell", { name: "Krijim kopjeje rezervë", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Përmbledhja", exact: true })
      .click();
    await page.getByText("50.00 €", { exact: true }).waitFor();
    await page.screenshot({
      path: "tests/screenshots/erp-dashboard.png",
      fullPage: true,
    });
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
