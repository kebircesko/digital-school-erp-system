// Creates an Albanian walkthrough using the real UI/API and an isolated database.
import EmbeddedPostgres from "embedded-postgres";
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  symlink,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import password from "../apps/api/dist/auth/password.js";

const output = resolve(
  process.env.VIDEO_REHEARSAL
    ? "output/prezantimi/rehearsal"
    : "output/prezantimi",
);
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), "erp-video-"));
const browserCache = join(temporary, "browsers");
const browserManifest = JSON.parse(
  await readFile("node_modules/playwright-core/browsers.json", "utf8"),
);
const ffmpegRevision = browserManifest.browsers.find(
  (entry) => entry.name === "ffmpeg",
).revision;
await mkdir(join(browserCache, `ffmpeg-${ffmpegRevision}`), {
  recursive: true,
});
await symlink(
  "/usr/bin/ffmpeg",
  join(browserCache, `ffmpeg-${ffmpegRevision}`, "ffmpeg-linux"),
);
process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;
const { chromium } = await import("playwright");
const secret = randomBytes(24).toString("hex");
const demoPassword = "Demonstrim-2026!";
const dbUrl = `postgresql://erp:${secret}@127.0.0.1:55448/erp_video`;
const apiBase = "http://127.0.0.1:3118/api";
const webBase = "http://127.0.0.1:5188";
const pg = new EmbeddedPostgres({
  databaseDir: join(temporary, "postgres"),
  user: "erp",
  password: secret,
  port: 55448,
  persistent: false,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog() {},
  onError() {},
});
const children = [];
function start(command, args, env = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.logs = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (data) => {
      child.logs = (child.logs + data).slice(-8000);
    });
  children.push(child);
  return child;
}
async function run(command, args, env = {}) {
  const child = start(command, args, env);
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(child.logs)),
    );
  });
}
async function ready(url, child) {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(url);
      return;
    } catch {}
    if (child.exitCode !== null) throw new Error(child.logs);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Server did not start: " + child.logs);
}
const cues = [],
  chapters = [];
let db,
  browser,
  pgStarted = false;
try {
  await pg.initialise();
  await pg.start();
  pgStarted = true;
  await pg.createDatabase("erp_video");
  await run("npm", ["run", "db:migrate"], { DATABASE_URL: dbUrl });
  db = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  const admin = await db.user.create({
    data: {
      name: "Administrator Demo",
      email: "admin@demo.local",
      passwordHash: password.hashPassword(demoPassword),
      role: "ADMIN",
    },
  });
  const instructor = await db.user.create({
    data: {
      name: "Instruktor Demo",
      email: "instruktor@demo.local",
      passwordHash: password.hashPassword(demoPassword),
      role: "INSTRUCTOR",
    },
  });
  await db.user.create({
    data: {
      name: "Financa Demo",
      email: "financa@demo.local",
      passwordHash: password.hashPassword(demoPassword),
      role: "FINANCE",
    },
  });
  const courses = [],
    groups = [];
  for (const [name, price, groupName, days, time] of [
    ["Programim për fëmijë", "65.00", "Programim · Grupi A", [1, 3], "16:00"],
    ["Dizajn grafik", "55.00", "Dizajn · Grupi B", [2, 4], "17:30"],
    ["Robotikë", "75.00", "Robotikë · Grupi C", [5, 6], "15:00"],
  ]) {
    const course = await db.course.create({
      data: {
        name,
        monthlyPrice: price,
        durationMonths: 12,
        description: "Kurs demonstrimi",
      },
    });
    courses.push(course);
    groups.push(
      await db.group.create({
        data: {
          name: groupName,
          courseId: course.id,
          instructorId: instructor.id,
          days,
          startTime: time,
          durationMinutes: 90,
          capacity: 20,
        },
      }),
    );
  }
  const names = [
    ["Arta", "Demo"],
    ["Ardit", "Shembulli"],
    ["Elira", "Demo"],
    ["Dardan", "Shembulli"],
    ["Besa", "Demo"],
    ["Drin", "Shembulli"],
    ["Era", "Demo"],
    ["Luan", "Shembulli"],
    ["Dafina", "Demo"],
    ["Erion", "Shembulli"],
    ["Hana", "Demo"],
    ["Leart", "Shembulli"],
    ["Rina", "Demo"],
    ["Trim", "Shembulli"],
    ["Vesa", "Demo"],
    ["Yll", "Shembulli"],
    ["Nora", "Demo"],
    ["Mal", "Shembulli"],
  ];
  let invoiceNumber = 0,
    paymentNumber = 0;
  for (const [index, [firstName, lastName]] of names.entries()) {
    const course = courses[index % 3],
      group = groups[index % 3];
    const student = await db.student.create({
      data: {
        firstName,
        lastName,
        birthDate: new Date("2013-04-12"),
        parentName: "Prind Demonstrimi",
        parentPhone: `000 000 ${String(index + 1).padStart(3, "0")}`,
        address: "Prizren · adresë demonstrimi",
        status: index > 15 ? "INACTIVE" : "ACTIVE",
        notes: "Të dhëna sintetike për prezantim.",
      },
    });
    const enrollment = await db.enrollment.create({
      data: {
        studentId: student.id,
        courseId: course.id,
        groupId: group.id,
        startDate: new Date("2026-09-01"),
        monthlyPrice: course.monthlyPrice,
        discount: "0.00",
      },
    });
    for (const period of ["2026-09", "2026-10"]) {
      const paid = period === "2026-09" || index % 3 === 0;
      const partial = !paid && index % 3 === 1;
      const paidAmount = paid
        ? String(course.monthlyPrice)
        : partial
          ? "20.00"
          : "0.00";
      const invoice = await db.invoice.create({
        data: {
          number: `DEMO-F-${String(++invoiceNumber).padStart(4, "0")}`,
          studentId: student.id,
          courseId: course.id,
          groupId: group.id,
          enrollmentId: enrollment.id,
          period,
          issuedAt: new Date(period + "-01"),
          dueDate: new Date(period + (index % 2 ? "-31" : "-10")),
          subtotal: course.monthlyPrice,
          discount: "0.00",
          amount: course.monthlyPrice,
          paidAmount,
          status: paid ? "PAID" : partial ? "PARTIAL" : "UNPAID",
          studentName: `${firstName} ${lastName}`,
          courseName: course.name,
          groupName: group.name,
        },
      });
      if (Number(paidAmount) > 0)
        await db.payment.create({
          data: {
            number: `DEMO-P-${String(++paymentNumber).padStart(4, "0")}`,
            studentId: student.id,
            userId: admin.id,
            amount: paidAmount,
            method: index % 2 ? "BANK" : "CASH",
            paidAt: new Date(period + "-08"),
            idempotencyKey: randomUUID(),
            allocations: {
              create: { invoiceId: invoice.id, amount: paidAmount },
            },
          },
        });
    }
    for (const period of ["2026-09", "2026-10"])
      await db.monthlyAttendance.create({
        data: {
          studentId: student.id,
          courseId: course.id,
          period,
          totalLessons: 8,
          absences: index % 3,
          sourceFile: "vijueshmeri-demo.xlsx",
        },
      });
  }
  const api = start(process.execPath, ["apps/api/dist/main.js"], {
    DATABASE_URL: dbUrl,
    HOST: "127.0.0.1",
    PORT: "3118",
    CORS_ORIGINS: webBase,
    AUTO_INVOICES: "false",
    AUTO_BACKUP: "false",
    BACKUP_KEY: randomBytes(32).toString("hex"),
    BACKUP_DIR: join(temporary, "backups"),
  });
  const vite = start(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "apps/desktop",
      "--host",
      "127.0.0.1",
      "--port",
      "5188",
      "--strictPort",
    ],
    { VITE_API_URL: apiBase },
  );
  await Promise.all([ready(apiBase + "/auth/me", api), ready(webBase, vite)]);
  console.log("Isolated demo database and real API are ready.");
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 800 },
    recordVideo: {
      dir: join(output, "raw"),
      size: { width: 1600, height: 800 },
    },
    timezoneId: "Europe/Tirane",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // A visible pointer makes clicks easy to follow in a screen recording.
  await context.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const dot = document.createElement("div");
      dot.id = "presentation-pointer";
      dot.style.cssText =
        "position:fixed;width:26px;height:26px;border:2px solid #7a6cff;border-radius:50%;background:#8f82ff24;pointer-events:none;z-index:2147483647;left:-100px;top:-100px;transition:transform .12s;box-shadow:0 0 0 5px #8f82ff12";
      document.body.append(dot);
      document.addEventListener("mousemove", (e) => {
        dot.style.left = `${e.clientX - 13}px`;
        dot.style.top = `${e.clientY - 13}px`;
      });
      document.addEventListener("mousedown", () => {
        dot.style.transform = "scale(1.5)";
        dot.style.background = "#8f82ff77";
      });
      document.addEventListener("mouseup", () => {
        dot.style.transform = "scale(1)";
        dot.style.background = "#8f82ff24";
      });
    });
  });
  const started = performance.now();
  const elapsed = () => (performance.now() - started) / 1000;
  async function hold(text, seconds = 6) {
    const from = elapsed();
    await page.waitForTimeout(
      seconds * 1000 * (process.env.VIDEO_REHEARSAL ? 0.03 : 1),
    );
    cues.push({ from, to: elapsed(), text });
  }
  async function chapter(title, text, action, seconds = 7) {
    const from = elapsed();
    console.log(`Recording: ${title}`);
    await action();
    await page.waitForTimeout(
      seconds * 1000 * (process.env.VIDEO_REHEARSAL ? 0.03 : 1),
    );
    cues.push({ from, to: elapsed(), text });
    chapters.push({ from, to: elapsed(), title });
  }
  async function click(locator) {
    await locator.waitFor({ state: "visible" });
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: process.env.VIDEO_REHEARSAL ? 2 : 16,
    });
    await page.waitForTimeout(process.env.VIDEO_REHEARSAL ? 20 : 350);
    await locator.click();
    await page.waitForTimeout(process.env.VIDEO_REHEARSAL ? 150 : 650);
  }
  async function type(locator, value) {
    await click(locator);
    await locator.fill("");
    await locator.pressSequentially(value, {
      delay: process.env.VIDEO_REHEARSAL ? 1 : 60,
    });
  }
  async function nav(name) {
    const button = page
      .locator("nav")
      .getByRole("button", { name, exact: true });
    if (!(await button.isVisible()))
      await click(
        page.locator(".nav-group").filter({ hasText: name }).locator("summary"),
      );
    await click(button);
  }
  async function card(kicker, title, description, cards) {
    await page.setContent(
      `<!doctype html><html lang="sq"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#080827;color:#f5f5ff;font-family:Arial,sans-serif;min-height:100vh;padding:82px 100px;background:radial-gradient(ellipse at 85% 5%,#363077 0,transparent 55%),#080827}.k{font-size:17px;letter-spacing:5px;color:#b3a9ff;font-weight:700}h1{font-size:65px;line-height:1.08;margin:28px 0;max-width:1250px;letter-spacing:-2px}p{font-size:25px;line-height:1.5;color:#c6c5de;max-width:1100px}.cards{display:flex;gap:22px;margin-top:46px}.card{flex:1;padding:25px;border:1px solid #ffffff26;border-radius:18px;background:#ffffff08}.card b{display:block;font-size:24px;margin-bottom:12px}.card span{font-size:18px;line-height:1.5;color:#c6c5de}.foot{position:fixed;bottom:30px;color:#9691bc;font-size:15px;letter-spacing:1px}</style><div class="k">${kicker}</div><h1>${title}</h1><p>${description}</p><div class="cards">${cards.map(([title, body]) => `<div class="card"><b>${title}</b><span>${body}</span></div>`).join("")}</div><div class="foot">SHKOLLA DIGJITALE PRIZREN · ERP · PREZANTIM ME TË DHËNA DEMONSTRIMI</div></html>`,
    );
  }
  await chapter(
    "01 · Projekti",
    "Shkolla Digjitale ERP: një platformë për ta bërë punën e administratorit më të thjeshtë.",
    () =>
      card(
        "PREZANTIMI I PROJEKTIT",
        "Më pak hapa.<br>Më shumë kohë për shkollën.",
        "Menaxhimi i nxënësve, kurseve dhe financave në një hapësirë të përbashkët.",
        [
          ["Nxënësit", "Profile, kontakte dhe regjistrime"],
          ["Financat", "Fatura, pagesa dhe borxhe"],
          ["Organizimi", "Kurse, grupe dhe raporte"],
        ],
      ),
    8,
  );
  await chapter(
    "02 · Zhvillimi",
    "Ndërfaqja është ndërtuar me React dhe Vite; Electron e sjell projektin në desktop.",
    () =>
      card(
        "SI ËSHTË NDËRTUAR",
        "Një ndërfaqe e përbashkët.<br>Të dhëna të lidhura.",
        "Desktop → API qendrore → databazë",
        [
          ["React + Electron", "Ndërfaqja dhe aplikacioni desktop"],
          ["NestJS + Prisma", "API, validime dhe logjika e punës"],
          ["PostgreSQL", "Nxënësit, regjistrimet dhe transaksionet"],
        ],
      ),
    6,
  );
  await hold(
    "Roli i përdoruesit përcakton qasjen. Historiku ruan gjurmën e veprimeve administrative.",
    6,
  );
  await chapter(
    "03 · Kyçja",
    "Përdoruesi kyçet me llogarinë e tij. Në demonstrim përdorim rolin e administratorit.",
    async () => {
      await page.goto(webBase);
      await type(
        page.getByLabel("Emaili", { exact: true }),
        "admin@demo.local",
      );
      await type(page.getByLabel("Fjalëkalimi", { exact: true }), demoPassword);
    },
    5,
  );
  await chapter(
    "04 · Përmbledhja",
    "Përmbledhja tregon nxënësit, kurset, grupet dhe gjendjen e faturave në një vend.",
    async () => {
      await click(page.getByRole("button", { name: "Kyçu në platformë" }));
      await page.getByRole("heading", { name: /Mirë se erdhe/ }).waitFor();
    },
    7,
  );
  await chapter(
    "05 · Numrat hapin listën",
    "Klikimi mbi numrin e nxënësve aktivë hap menjëherë listën e filtruar.",
    async () => {
      await click(
        page.getByRole("button", { name: /Nxënës aktivë:.*Hap listën/ }),
      );
      await page.locator("tbody tr").first().waitFor();
    },
    6,
  );
  await chapter(
    "06 · Kërkimi i shpejtë",
    "Nga çdo faqe kërkojmë nxënësin sipas emrit, prindit ose telefonit; profili hapet pa ndërruar faqe.",
    async () => {
      await type(page.getByLabel("Kërko nxënës nga çdo faqe"), "Arta");
      await page
        .locator(".quick-results")
        .getByRole("button", { name: /Arta Demo/ })
        .waitFor();
    },
    5,
  );
  await chapter(
    "07 · Profili i nxënësit",
    "Profili bashkon kontaktet, regjistrimet, faturat dhe historikun e pagesave të nxënësit.",
    async () => {
      await click(
        page
          .locator(".quick-results")
          .getByRole("button", { name: /Arta Demo/ }),
      );
      await page
        .getByRole("dialog")
        .getByText("Kurset dhe regjistrimet", { exact: true })
        .waitFor();
    },
    7,
  );
  await click(
    page.getByRole("button", { name: "Mbyll historikun", exact: true }),
  );
  await chapter(
    "08 · Regjistro nxënës",
    "Me «Veprim i ri» hapim regjistrimin direkt. Plotësojmë të dhënat dhe kontaktin e prindit.",
    async () => {
      await click(
        page.getByRole("button", { name: "Veprim i ri", exact: true }),
      );
      await click(
        page
          .locator("#quick-create-actions")
          .getByRole("button", { name: "Regjistro nxënës", exact: true }),
      );
      const dialog = page.getByRole("dialog");
      await type(dialog.getByLabel("Emri", { exact: true }), "Lira");
      await type(dialog.getByLabel("Mbiemri", { exact: true }), "Demo");
      await dialog.getByLabel("Data e lindjes").fill("2014-05-18");
      await type(
        dialog.getByLabel("Emri i prindit / kujdestarit"),
        "Prind Demonstrimi",
      );
      await type(dialog.getByLabel("Telefoni i prindit"), "000 000 100");
    },
    5,
  );
  await chapter(
    "09 · Regjistrimi në grup",
    "Pas ruajtjes hapet profili. E regjistrojmë nxënësin në grup pa e kërkuar përsëri.",
    async () => {
      await click(
        page.getByRole("button", { name: "Ruaj nxënësin", exact: true }),
      );
      await page.getByRole("dialog", { name: "Profili · Lira Demo" }).waitFor();
      await click(
        page.getByRole("button", {
          name: "Regjistro në kurs / grup",
          exact: true,
        }),
      );
      await page
        .getByLabel("Grupi", { exact: true })
        .selectOption(groups[0].id);
      await page
        .getByLabel("Data e fillimit", { exact: true })
        .fill("2026-10-01");
      await type(page.getByLabel("Çmimi individual mujor EUR"), "65.00");
    },
    7,
  );
  await hold(
    "Kontrollojmë grupin, datën e fillimit dhe çmimin individual përpara se ta ruajmë regjistrimin.",
    5,
  );
  await click(
    page.getByRole("dialog").getByRole("button", { name: "Ruaj", exact: true }),
  );
  await page.getByRole("dialog", { name: "Profili · Lira Demo" }).waitFor();
  await hold(
    "Regjistrimi ruhet te profili. Të dhënat mbeten të lidhura me kursin dhe grupin përkatës.",
    5,
  );
  await click(
    page.getByRole("button", { name: "Mbyll historikun", exact: true }),
  );
  await chapter(
    "10 · Kurset dhe grupet",
    "Kurset mbajnë çmimet dhe kohëzgjatjen; grupet lidhin kursin me instruktorin dhe orarin.",
    async () => {
      await nav("Grupet");
      await page.locator("tbody tr").first().waitFor();
    },
    6,
  );
  await chapter(
    "11 · Lidhje direkte",
    "Klikimi mbi emrin e grupit hap vetëm regjistrimet e atij grupi, pa vendosur filtra me dorë.",
    async () => {
      await click(
        page.getByRole("button", { name: groups[0].name, exact: true }),
      );
      await page
        .getByRole("status")
        .filter({ hasText: "Regjistrimet:" })
        .waitFor();
    },
    6,
  );
  await chapter(
    "12 · Faturat e muajit",
    "Te «Faturat e muajit» kontrollojmë regjistrimet, vijueshmërinë dhe shumat para aprovimit.",
    async () => {
      await nav("Faturat");
      await click(
        page.getByRole("button", { name: "Faturat e muajit", exact: true }),
      );
      await page.waitForTimeout(1200);
    },
    7,
  );
  await chapter(
    "13 · Krijo faturën",
    "Për një faturë të re zgjedhim nxënësin dhe muajin; sistemi propozon shumën e regjistrimit.",
    async () => {
      await click(
        page.getByRole("button", { name: "Veprim i ri", exact: true }),
      );
      await click(
        page
          .locator("#quick-create-actions")
          .getByRole("button", { name: "Regjistro faturën", exact: true }),
      );
      const dialog = page.getByRole("dialog");
      await type(dialog.getByLabel("Kërko: Nxënësi", { exact: true }), "Lira");
      await click(dialog.getByRole("option", { name: /Lira Demo/ }));
      await dialog.getByLabel("Shuma e faturës EUR").waitFor();
    },
    7,
  );
  await chapter(
    "14 · Fatura dhe pagesa",
    "Pasi ruajmë faturën, mund ta shikojmë, ta printojmë ose ta paguajmë në të njëjtën dritare.",
    async () => {
      await click(
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Ruaj faturën", exact: true }),
      );
      await page
        .getByRole("dialog", { name: "Fatura", exact: true })
        .getByRole("button", { name: "Regjistro pagesën", exact: true })
        .waitFor();
    },
    6,
  );
  await chapter(
    "15 · Regjistro pagesën",
    "Shuma plotësohet nga mbetja. Kontrollojmë datën, vijueshmërinë dhe mënyrën e pagesës.",
    async () => {
      await click(
        page.getByRole("button", { name: "Regjistro pagesën", exact: true }),
      );
      await page.getByLabel("Shuma e pagesës EUR").waitFor();
      await page
        .getByRole("button", { name: "Ruaj pagesën", exact: true })
        .scrollIntoViewIfNeeded();
    },
    7,
  );
  await chapter(
    "16 · Gjendja përditësohet",
    "Pas ruajtjes, fatura shënohet e paguar dhe pagesa shfaqet në historikun e saj.",
    async () => {
      await click(
        page.getByRole("button", { name: "Ruaj pagesën", exact: true }),
      );
      await page
        .getByRole("status")
        .filter({ hasText: "Pagesa u ruajt." })
        .waitFor();
      await page
        .getByRole("dialog", { name: "Fatura", exact: true })
        .getByRole("heading", { name: /Fatura/ })
        .scrollIntoViewIfNeeded();
    },
    7,
  );
  await click(page.getByRole("button", { name: "Mbyll faturën", exact: true }));
  await chapter(
    "17 · Borxhet",
    "Te borxhet shohim detyrimet e mbetura. Çdo numër fature hap detajet dhe pagesën direkte.",
    async () => {
      await nav("Borxhet");
      await page.locator("tbody tr").first().waitFor();
    },
    7,
  );
  await chapter(
    "18 · Raportet",
    "Raportet filtrohen sipas datës, kursit, grupit dhe metodës. Rezultatet eksportohen në Excel ose PDF.",
    async () => {
      await nav("Raportet");
      await click(page.getByRole("button", { name: "Ky muaj", exact: true }));
    },
    7,
  );
  await chapter(
    "19 · Gjurmueshmëria",
    "Historiku regjistron veprimet. Administratori mund të kontrollojë kush e ka kryer një ndryshim.",
    async () => {
      await nav("Historiku");
      await page.locator("tbody tr").first().waitFor();
    },
    6,
  );
  await chapter(
    "20 · Puna e përditshme",
    "Kërko, hap profilin dhe kryej veprimin. Qëllimi është më pak kalime mes faqeve dhe më pak punë e përsëritur.",
    async () => {
      await nav("Përmbledhja");
      await page.getByRole("heading", { name: /Mirë se erdhe/ }).waitFor();
    },
    7,
  );
  await chapter(
    "21 · Përfundimi",
    "Shkolla Digjitale ERP: nga regjistrimi te pagesa, një rrjedhë më e qartë për administratorin.",
    () =>
      card(
        "SHKOLLA DIGJITALE PRIZREN",
        "Një rrjedhë më e thjeshtë.<br>Një shkollë më e organizuar.",
        "Regjistro nxënësin → Lidhe me grupin → Krijo faturën → Regjistro pagesën → Kontrollo raportin",
        [
          ["Më pak hapa", "Kërkim dhe veprime nga çdo faqe"],
          ["Më shumë qartësi", "Profile, detyrime dhe raporte të lidhura"],
          ["Kontroll i punës", "Role dhe historik i veprimeve"],
        ],
      ),
    9,
  );
  if (errors.length) throw new Error("UI errors: " + errors.join("; "));
  const video = page.video();
  await context.close();
  const rawPath = await video.path();
  const timestamp = (seconds, separator = ",") => {
    const milliseconds = Math.round(seconds * 1000);
    return `${String(Math.floor(milliseconds / 3600000)).padStart(2, "0")}:${String(Math.floor(milliseconds / 60000) % 60).padStart(2, "0")}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")}${separator}${String(milliseconds % 1000).padStart(3, "0")}`;
  };
  await writeFile(
    join(output, "titra-shqip.srt"),
    cues
      .map(
        (cue, index) =>
          `${index + 1}\n${timestamp(cue.from)} --> ${timestamp(cue.to)}\n${cue.text}\n`,
      )
      .join("\n"),
  );
  await writeFile(
    join(output, "timeline.json"),
    JSON.stringify({ rawPath, duration: elapsed(), cues, chapters }, null, 2),
  );
  await writeFile(
    join(output, "SKENARI.md"),
    "# Shkolla Digjitale ERP — prezantimi\n\nVideo me ndërfaqen dhe API-në reale, të lidhura me një databazë të përkohshme. Të gjitha të dhënat janë sintetike.\n\n" +
      chapters
        .map(
          (chapter) =>
            `- ${timestamp(chapter.from).slice(3, 8)} — ${chapter.title}`,
        )
        .join("\n") +
      "\n\n## Titrat\n\n" +
      cues.map((cue) => cue.text).join("\n\n") +
      "\n",
  );
  console.log(
    JSON.stringify({
      rawPath,
      duration: elapsed(),
      cues: cues.length,
      chapters: chapters.length,
    }),
  );
} finally {
  await browser?.close();
  for (const child of children)
    if (child.exitCode === null) child.kill("SIGTERM");
  await db?.$disconnect();
  if (pgStarted) await pg.stop();
  await rm(temporary, { recursive: true, force: true });
}
