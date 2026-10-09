const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  openPdf: (data) => ipcRenderer.invoke("open-pdf", data),
  saveFile: (data, name) => ipcRenderer.invoke("save-file", data, name),
});
