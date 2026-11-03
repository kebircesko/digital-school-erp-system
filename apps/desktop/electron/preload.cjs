const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  openPdf: (data, language) => ipcRenderer.invoke("open-pdf", data, language),
  saveFile: (data, name, language) =>
    ipcRenderer.invoke("save-file", data, name, language),
});
