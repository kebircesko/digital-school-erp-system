import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
export async function desktopSmoke(credentials) {
  const env = { ...process.env, ELECTRON_DEV: "0" };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: ["apps/desktop"],
    env,
    timeout: 30000,
  });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(10000);
    page.on("console", (message) => console.log("Renderer:", message.text()));
    page.on("requestfailed", (request) =>
      console.log(
        "Request failed:",
        request.url(),
        request.failure()?.errorText,
      ),
    );
    page.on("response", (response) => {
      if (response.url().includes("/api/"))
        console.log("API:", response.status(), response.url());
    });
    page.on("pageerror", (error) => console.error("Renderer:", error.message));
    await page.getByLabel("Emaili", { exact: true }).fill(credentials.email);
    await page
      .getByLabel("Fjalëkalimi", { exact: true })
      .fill(credentials.password);
    await page.getByRole("button", { name: "Kyçu në platformë" }).click();
    await page
      .getByRole("heading", { name: /Mirë se erdhe/ })
      .waitFor()
      .catch(async (error) => {
        console.log(await page.locator("body").innerText());
        throw error;
      });
    await page.getByRole("button", { name: "Nxënësit", exact: true }).click();
    await page
      .getByRole("button", { name: "Regjistro nxënës", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    await modal.getByLabel("Emri", { exact: true }).fill("Nxënës UI");
    await modal.getByLabel("Mbiemri", { exact: true }).fill("Sintetik");
    await modal.getByLabel("Data e lindjes").fill("2014-01-15");
    await modal.getByLabel("Emri i prindit / kujdestarit").fill("Prind UI");
    await modal.getByLabel("Telefoni i prindit").fill("+383 44000000");
    await modal.getByRole("button", { name: "Ruaj nxënësin" }).click();
    await page.getByText("Nxënës UI Sintetik", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Ndrysho të dhënat" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Emri", { exact: true })
      .fill("Nxënës Ndryshuar");
    await page.getByRole("button", { name: "Ruaj nxënësin" }).click();
    await page
      .getByText("Nxënës Ndryshuar Sintetik", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Ndrysho temën" }).click();
    assert.equal(await page.locator("html").getAttribute("class"), "dark");
    await mkdir("tests/screenshots", { recursive: true });
    await page.screenshot({ path: "tests/screenshots/students-dark.png" });
    await page.getByRole("button", { name: "Ndrysho temën" }).click();
    await page
      .getByRole("button", { name: "Përmbledhja", exact: true })
      .click();
    await page
      .getByText("Nxënës Ndryshuar Sintetik", { exact: true })
      .waitFor();
    await page.screenshot({ path: "tests/screenshots/dashboard.png" });
    await page.getByRole("button", { name: "Nxënësit", exact: true }).click();
    await page
      .getByRole("button", { name: "Fshi nxënësin", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Fshi nxënësin", exact: true })
      .click();
    await page.getByRole("heading", { name: "Nuk u gjetën nxënës" }).waitFor();
    await page.getByRole("button", { name: "Çkyçu", exact: true }).click();
    await page
      .getByRole("heading", { name: "Kyçuni në hapësirën tuaj" })
      .waitFor();
    console.log(
      "Electron → REST API → PostgreSQL: login, create, update, dashboard, theme, delete and logout passed.",
    );
  } finally {
    await app.close();
  }
}
