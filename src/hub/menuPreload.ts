import { contextBridge, ipcRenderer } from "electron";

// Import ExternalApplication type
import type { ExternalApplication } from "../types";

// Expose a limited API to the Menu Renderer process
export interface IHubMenuElectronAPI {
  hideMenuWindow: () => void;
  triggerMainAppSnip: () => void;
  // Add application launching functionality
  launchApplication: (appId: string) => void;
  getInstalledApplications: () => Promise<ExternalApplication[]>;
  addCustomApplication: (
    app: Omit<ExternalApplication, "id" | "isCustom">
  ) => Promise<ExternalApplication>;
  removeCustomApplication: (appId: string) => void;
  browseForApplication: () => Promise<Omit<
    ExternalApplication,
    "id" | "isCustom"
  > | null>;
}

const electronAPI: IHubMenuElectronAPI = {
  hideMenuWindow: () => ipcRenderer.send("hide-menu-window"),
  // Send a specific request to the Hub's main process
  triggerMainAppSnip: () => ipcRenderer.send("request-region-capture"),
  // Application launching functionality
  launchApplication: (appId: string) =>
    ipcRenderer.send("launch-application", appId),
  getInstalledApplications: () =>
    ipcRenderer.invoke("get-installed-applications"),
  addCustomApplication: (app: Omit<ExternalApplication, "id" | "isCustom">) =>
    ipcRenderer.invoke("add-custom-application", app),
  removeCustomApplication: (appId: string) =>
    ipcRenderer.send("remove-custom-application", appId),
  browseForApplication: () => ipcRenderer.invoke("browse-for-application"),
};

// Expose the API securely
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

console.log("Hub Menu Preload Script Loaded");
