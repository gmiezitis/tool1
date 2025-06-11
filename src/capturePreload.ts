import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("captureAPI", {
  // Send selection results (coordinates or cancellation) to the main process
  sendSelectionResult: (result: {
    cancelled: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
  }) => {
    ipcRenderer.send("capture-result", result);
  },
  // Function to register a callback for receiving screenshot data
  onScreenshotData: (
    callback: (event: IpcRendererEvent, dataUrl: string) => void
  ) => {
    const listener = (event: IpcRendererEvent, dataUrl: string) =>
      callback(event, dataUrl);
    ipcRenderer.on("screenshot-data", listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("screenshot-data", listener);
    };
  },
});
