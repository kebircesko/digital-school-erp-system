const {
  app,
  BrowserWindow,
  protocol,
  net,
  session,
  ipcMain,
  dialog,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 950,
    minWidth: 1000,
    minHeight: 700,
    title: "Shkolla Digjitale • Prizren",
    icon: path.join(__dirname, "../assets/icon.png"),
    backgroundColor: "#00004E",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (
      !url.startsWith("app://erp/") &&
      !(!app.isPackaged && url.startsWith("http://localhost:5174/"))
    )
      event.preventDefault();
  });
  if (!app.isPackaged && process.env.ELECTRON_DEV === "1")
    win.loadURL("http://localhost:5174");
  else win.loadURL("app://erp/index.html");
}
app.whenReady().then(() => {
  ipcMain.handle("save-file", async (event, data, name) => {
    const origin = event.senderFrame?.url;
    if (!(
      origin?.startsWith("app://erp/") ||
      (!app.isPackaged && origin?.startsWith("http://localhost:5174/"))
    ))
      throw new Error("Qasja u refuzua.");
    if (
      typeof name !== "string" ||
      name !== path.basename(name) ||
      !/^[-a-zA-Z0-9_. ]+\.(pdf|xlsx|erpbackup)$/.test(name)
    )
      throw new Error("Emri i skedarit është i pavlefshëm.");
    const bytes = Buffer.from(data);
    if (bytes.length > 200 * 1024 * 1024)
      throw new Error("Skedari është tepër i madh.");
    const choice = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        defaultPath: name,
        filters: [
          { name: "Dokumenti ERP", extensions: [name.split(".").pop()] },
        ],
      },
    );
    if (choice.canceled || !choice.filePath) return false;
    await require("node:fs/promises").writeFile(choice.filePath, bytes, {
      mode: 0o600,
    });
    return true;
  });
  ipcMain.handle("open-pdf", async (event, data) => {
    const origin = event.senderFrame?.url;
    if (!(
      origin?.startsWith("app://erp/") ||
      (!app.isPackaged && origin?.startsWith("http://localhost:5174/"))
    ))
      throw new Error("Qasja u refuzua.");
    const bytes = Buffer.from(data);
    if (
      bytes.length > 20 * 1024 * 1024 ||
      bytes.subarray(0, 5).toString() !== "%PDF-"
    )
      throw new Error("PDF i pavlefshëm.");
    const fs = require("node:fs/promises"),
      os = require("node:os");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "erp-pdf-"));
    const file = path.join(dir, "dokument.pdf");
    await fs.writeFile(file, bytes, { mode: 0o600 });
    const viewer = new BrowserWindow({
      width: 1000,
      height: 850,
      title: "Dokumenti - ruaj ose printo",
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    viewer.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.key === "Escape") {
        event.preventDefault();
        viewer.close();
      }
    });
    viewer.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    viewer.webContents.on("will-navigate", (event) => event.preventDefault());
    viewer.on("closed", () =>
      fs.rm(dir, { recursive: true, force: true }).catch(() => {}),
    );
    await viewer.loadURL(pathToFileURL(file).toString());
  });
  const base = path.resolve(__dirname, "../dist");
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    if (url.hostname !== "erp")
      return new Response("Forbidden", { status: 403 });
    const file = path.resolve(base, "." + decodeURIComponent(url.pathname));
    if (!file.startsWith(base + path.sep))
      return new Response("Forbidden", { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!details.url.startsWith("app://erp/"))
      return callback({ responseHeaders: details.responseHeaders });
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src https: http://127.0.0.1:* http://localhost:*; object-src 'none'; base-uri 'self'; frame-src 'none'; worker-src 'self' blob:; font-src 'self' data: blob:",
        ],
      },
    });
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
