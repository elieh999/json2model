const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "json2ModelDesktop",
  Object.freeze({
    writeClipboard: (text) => ipcRenderer.invoke("clipboard:write", text),
  }),
);
