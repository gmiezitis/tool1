import { IpcRendererEvent } from "electron"; // Import IpcRendererEvent

// Define the type for the API exposed by preload.ts
export interface IElectronAPI {
  invokeCapture: (
    captureType: string
  ) => Promise<{ success: boolean; message?: string; dataUrl?: string }>;
  // Update signature to match implementation
  onCaptureData: (callback: (event: any, data: any) => void) => () => void;
  // Add quitApp signature
  quitApp: () => void;
  // Add saveVideo definition
  saveVideo: (
    videoData: ArrayBuffer
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  // Add other exposed functions here as needed
}

// Define the type for the API exposed by capturePreload.ts
export interface ICaptureAPI {
  sendSelectionResult: (result: {
    cancelled: boolean;
    bounds?: { x: number; y: number; width: number; height: number };
  }) => void;
  // Add signature for the data listener
  onScreenshotData: (
    callback: (event: IpcRendererEvent, dataUrl: string) => void
  ) => () => void;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
    captureAPI: ICaptureAPI;
  }
}
