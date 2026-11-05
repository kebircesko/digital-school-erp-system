import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";

export async function adminToolsUi({
  email,
  password,
  base,
  groupId,
  invoiceNumber,
}) {
  const vite = spawn(
    process.execPath,
    [
      resolve("node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5189",
    ],
    {
      cwd: resolve("apps/desktop"),
      env: { ...process.env, VITE_API_URL: base },
      stdio: "ignore",
    },
  );
  let browser;
  const errors = [];
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        if ((await fetch("http://127.0.0.1:5189")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(200);
    }
    assert.ok(ready, "Vite starts for isolated UI checks");
    browser = await chromium.launch({
      headless: true,
      ...(existsSync("/opt/google/chrome/chrome")
        ? { executablePath: "/opt/google/chrome/chrome" }
        : {}),
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 950 },
    });
    page.setDefaultTimeout(12000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5189");
    await page.getByLabel("Emaili", { exact: true }).fill(email);
    await page.getByLabel("Fjalëkalimi", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Kyçu në platformë" }).click();
    await page.getByRole("heading", { name: /Mirë se erdhe/ }).waitFor();
    await page
      .locator(".admin-tasks")
      .getByText("Kontakto prindin", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Nxënësit", exact: true }).click();
    await page.getByRole("button", { name: "Pa grup", exact: true }).click();
    await page.getByText("NoGroup Workflow", { exact: true }).waitFor();
    assert.equal(
      await page.getByText("Arta Workflow", { exact: true }).count(),
      0,
    );
    await page.getByRole("button", { name: "Me borxh", exact: true }).click();
    await page.getByText("Arta Workflow", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Pastro filtrat", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Regjistro nxënës", exact: true })
      .click();
    let modal = page.getByRole("dialog");
    async function fillStudent() {
      await modal.getByLabel("Emri", { exact: true }).fill("UI");
      await modal.getByLabel("Mbiemri", { exact: true }).fill("Workflow");
      await modal
        .getByLabel("Data e lindjes", { exact: true })
        .fill("2014-01-15");
      await modal.getByLabel("Emri i prindit / kujdestarit").fill("UI Parent");
      await modal.getByLabel("Telefoni i prindit").fill("044123456");
    }
    await fillStudent();
    await modal.getByRole("button", { name: "Vazhdo", exact: true }).click();
    await modal.getByLabel("Grupi", { exact: true }).selectOption(groupId);
    await modal
      .locator(`select[aria-label="Grupi"] option[value="${groupId}"]`)
      .evaluate((option) => {
        option.textContent = "Grup me emër shumë të gjatë ".repeat(15);
      });
    for (const width of [1440, 1000, 480]) {
      await page.setViewportSize({ width, height: 700 });
      const layout = await modal.evaluate((element) => {
        const body = element.querySelector(".student-form-body"),
          actions = element.querySelector(".modal-actions");
        return {
          horizontal:
            element.scrollWidth > element.clientWidth + 1 ||
            body.scrollWidth > body.clientWidth + 1,
          footerVisible:
            actions.getBoundingClientRect().bottom <=
            element.getBoundingClientRect().bottom + 1,
          bodyHeight: body.clientHeight,
        };
      });
      assert.equal(
        layout.horizontal,
        false,
        `No horizontal scrolling at ${width}px`,
      );
      assert.equal(
        layout.footerVisible,
        true,
        `Actions stay visible at ${width}px`,
      );
      assert.ok(layout.bodyHeight > 0);
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    const startInput = modal.getByLabel("Data e fillimit", { exact: true });
    const currentDate = await startInput.inputValue();
    assert.match(currentDate, /^\d{2}\/\d{2}\/\d{4}$/);
    await startInput
      .locator("..")
      .getByRole("button", { name: "Hap kalendarin" })
      .click();
    assert.deepEqual(
      await modal.locator(".date-weekdays span").allTextContents(),
      ["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"],
    );
    await modal
      .locator(".date-calendar")
      .getByRole("button", { name: currentDate, exact: true })
      .click();
    await startInput.fill("31/02/2026");
    assert.equal(
      await startInput.evaluate((input) => input.checkValidity()),
      false,
    );
    await startInput.fill(currentDate);
    assert.equal(
      await startInput.evaluate((input) => input.checkValidity()),
      true,
    );
    await page.screenshot({ path: "/tmp/erp-student-form-layout.png" });
    assert.equal(
      Number(await modal.getByLabel("Çmimi individual mujor EUR").inputValue()),
      40.1,
    );
    await modal.getByLabel("Zbritja mujore EUR").fill("0.10");
    await modal.getByLabel("Lësho faturën e parë pas konfirmimit").check();
    await modal.getByRole("button", { name: "Vazhdo", exact: true }).click();
    await modal.getByText("40.00 €", { exact: true }).waitFor();
    await page.screenshot({ path: "/tmp/erp-onboarding-review.png" });
    await modal
      .getByRole("button", { name: "Regjistro dhe lësho faturën", exact: true })
      .click();
    await modal.waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Regjistro nxënës", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await fillStudent();
    await modal.getByRole("button", { name: "Vazhdo", exact: true }).click();
    await modal
      .getByText("Ekziston nxënës me të njëjtin emër dhe datëlindje.", {
        exact: true,
      })
      .waitFor();
    await modal.getByRole("button", { name: "Mbyll formularin" }).click();
    await page.getByText("UI Workflow", { exact: true }).click();
    modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: "Shto detyrë" }).click();
    await modal.getByLabel("Detyra", { exact: true }).fill("UI follow-up");
    await modal.getByRole("button", { name: "Ruaj detyrën" }).click();
    await modal.getByText("UI follow-up", { exact: true }).waitFor();
    await modal.getByRole("button", { name: "Mbyll historikun" }).click();
    await page
      .getByRole("button", { name: "Përmbledhja", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Kontrolli i të dhënave", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Kontrolli i të dhënave", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Mbyllja e arkës", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Mbyllja ditore e arkës", exact: true })
      .waitFor();
    await page
      .getByLabel("Cash i numëruar në fund", { exact: true })
      .fill("21.00");
    await page
      .getByLabel("Shënime / Arsyeja e diferencës")
      .fill("UI reconciliation");
    await page
      .getByRole("button", { name: "Ruaj korrigjimin e mbylljes", exact: true })
      .click();
    await page.getByText("Mbyllja e arkës u ruajt.", { exact: true }).waitFor();
    await page.screenshot({ path: "/tmp/erp-cash-close.png", fullPage: true });
    await page.getByRole("button", { name: "Faturat", exact: true }).click();
    await page.getByLabel("Kërko faturë ose pagesë").fill(invoiceNumber);
    await page
      .getByRole("button", { name: invoiceNumber, exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal.getByText("Kujtesë WhatsApp", { exact: true }).click();
    await modal.getByRole("link", { name: "Hap WhatsApp" }).waitFor();
    const url = new URL(
      await modal
        .getByRole("link", { name: "Hap WhatsApp" })
        .getAttribute("href"),
    );
    assert.equal(url.hostname, "wa.me");
    assert.equal(url.pathname, "/38344123456");
    assert.match(
      await modal.getByLabel("Mesazhi për prindin").inputValue(),
      /Arta Workflow/,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: UI filters, three-step onboarding with invoice, duplicate alarm, student task, data checks, cash correction and WhatsApp message preview; no message sent.",
    );
  } catch (e) {
    if (browser) {
      const pages = browser.contexts()[0]?.pages();
      if (pages?.[0])
        await pages[0]
          .screenshot({ path: "/tmp/erp-admin-ui-failure.png", fullPage: true })
          .catch(() => {});
    }
    throw e;
  } finally {
    await browser?.close();
    vite.kill("SIGTERM");
  }
}
