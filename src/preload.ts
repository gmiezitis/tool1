// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
// import type { AppSettings } from "./manualSettingsStore"; // Old import
import type {
  AppSettings,
  PenSize,
  Tool,
  WindowSource as AppWindowSource,
} from "./types"; // Corrected import for AppSettings and others from ./types
// import type { WindowSource } from "./types"; // Already imported as AppWindowSource

// --- REMOVE WindowSource Definition ---
// interface WindowSource {
//   id: string;
//   name: string;
//   thumbnailDataUrl: string;
//   appIcon?: string;
// }
// --- End Remove ---

// Define the type for the API exposed by preload.ts
export interface IElectronAPI {
  invokeCapture: (type: string, options?: any) => Promise<any>;
  onCaptureData: (
    callback: (
      event: IpcRendererEvent,
      data: { success: boolean; dataUrl?: string; message?: string }
    ) => void
  ) => () => void; // Return a cleanup function
  quitApp: () => void;
  saveImageAs: (
    imageDataUrl: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  getWindowSources: () => Promise<AppWindowSource[]>;
  captureWindow: (windowId: string) => Promise<{
    success: boolean;
    dataUrl?: string;
    message?: string;
    error?: string;
  }>;
  getScreenSources: () => Promise<Electron.DesktopCapturerSource[]>;
  saveVideo: (buffer: ArrayBuffer) => Promise<any>;
  onSaveComplete: (
    callback: (event: IpcRendererEvent, result: any) => void
  ) => () => void;
  hideMainWindow: () => void;
  showMainWindow: () => void;
  getSettings: () => Promise<AppSettings>;
  saveSettings: (
    newSettings: Partial<AppSettings>
  ) => Promise<{ success: boolean }>;
  resetSettings: () => Promise<AppSettings>;
  on: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: any[]) => void
  ) => () => void;
}

// Expose specific IPC functions to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  // Function to invoke a capture action in the main process
  // Example type: 'fullscreen', 'region', 'window'
  invokeCapture: (type: string, options?: any) => {
    console.log(`[preload.ts] invokeCapture called with type: ${type}`);
    return ipcRenderer.invoke("capture", type, options);
  },

  // Expose the listener function
  onCaptureData: (callback: (event: IpcRendererEvent, data: any) => void) => {
    // Define the listener
    const listener = (event: IpcRendererEvent, data: any) =>
      callback(event, data);
    // Register the listener for the specific channel
    ipcRenderer.on("capture-data", listener);

    // Return a cleanup function to remove the listener
    return () => {
      ipcRenderer.removeListener("capture-data", listener);
    };
  },

  // Expose the quit function
  quitApp: () => ipcRenderer.send("quit-app"),

  // --- NEW: Expose Save As ---
  saveImageAs: (imageDataUrl: string) =>
    ipcRenderer.invoke("save-image-as", imageDataUrl),
  // --- END NEW ---

  // --- NEW Window Capture API ---
  getWindowSources: () => ipcRenderer.invoke("get-window-sources"),
  captureWindow: (windowId: string) =>
    ipcRenderer.invoke("capture-window", windowId),
  // --- END NEW Window Capture ---

  // --- NEW Video Recording IPC ---
  getScreenSources: () => ipcRenderer.invoke("get-screen-sources"),
  saveVideo: (buffer: ArrayBuffer) => ipcRenderer.invoke("save-video", buffer), // Pass buffer directly
  onSaveComplete: (
    callback: (event: IpcRendererEvent, result: any) => void
  ) => {
    const listener = (event: IpcRendererEvent, result: any) =>
      callback(event, result);
    ipcRenderer.on("save-complete", listener);
    return () => {
      ipcRenderer.removeListener("save-complete", listener);
    };
  },
  // --- END NEW ---

  // --- Window Visibility ---
  hideMainWindow: () => ipcRenderer.send("hide-main-window"),
  showMainWindow: () => ipcRenderer.send("show-main-window"),
  focusMainWindow: () => ipcRenderer.send("focus-main-window"),
  // ---

  // --- NEW Expose Settings API ---
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (newSettings: Partial<AppSettings>) =>
    ipcRenderer.invoke("save-settings", newSettings),
  resetSettings: () => ipcRenderer.invoke("reset-settings"),
  // --- END NEW ---

  // NEW: Implementation for the generic listener
  on: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: any[]) => void
  ) => {
    const wrappedListener = (event: IpcRendererEvent, ...args: any[]) =>
      listener(event, ...args);
    ipcRenderer.on(channel, wrappedListener);
    // Return a cleanup function
    return () => {
      ipcRenderer.removeListener(channel, wrappedListener);
    };
  },
});
