// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

// Define the type for the API exposed by preload.ts
// Moved type definition here for clarity
export interface IElectronAPI {
  invokeCapture: (type: string, options?: any) => Promise<any>;
  // Add a function to receive messages from main process
  // It accepts a channel name and a callback function
  onCaptureData: (
    callback: (
      event: IpcRendererEvent,
      data: { success: boolean; dataUrl?: string; message?: string }
    ) => void
  ) => () => void; // Return a cleanup function
  // Add function to quit the app
  quitApp: () => void;
  // Add saveVideo function
  saveVideo: (videoData: ArrayBuffer) => Promise<any>;
}

// Expose specific IPC functions to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  // Function to invoke a capture action in the main process
  // Example type: 'fullscreen', 'region', 'window'
  invokeCapture: (type: string, options?: any) =>
    ipcRenderer.invoke("capture", type, options),

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

  // Expose the saveVideo function
  saveVideo: (videoData: ArrayBuffer) => {
    console.log("preload: Sending save-video invoke");
    return ipcRenderer.invoke("save-video", videoData);
  },

  // We might need more functions later (e.g., for listening to results)
});
