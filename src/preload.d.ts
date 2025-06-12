import { IpcRendererEvent } from "electron"; // Import IpcRendererEvent
import type {
  PenSize,
  Tool,
  WindowSource as AppWindowSource,
  CapturerSourceWithPrimary,
} from "../types"; // Import PenSize, Tool, and WindowSource

// Define the type for the API exposed by preload.ts
export interface IElectronAPI {
  invokeCapture: (type: string, options?: any) => Promise<any>;
  // Update signature to match implementation
  onCaptureData: (
    callback: (
      event: IpcRendererEvent,
      data: { success: boolean; dataUrl?: string; message?: string }
    ) => void
  ) => () => void;
  // Add quitApp signature
  quitApp: () => void;
  // --- NEW Video Recording Signatures ---
  getScreenSources: () => Promise<CapturerSourceWithPrimary[]>; // Get available sources
  startRecording: (options: {
    screenId: string;
  }) => Promise<{ success: boolean; message?: string }>;
  stopRecording: () => Promise<{
    success: boolean;
    buffer?: ArrayBuffer;
    message?: string;
  }>;
  saveVideo: (
    buffer: ArrayBuffer
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>; // Send video buffer for saving
  onSaveComplete: (
    callback: (
      event: IpcRendererEvent,
      result: { success: boolean; filePath?: string; error?: string }
    ) => void
  ) => () => void; // Listen for save result
  // Window visibility control
  hideMainWindow: () => void;
  showMainWindow: () => void;
  // --- END NEW ---
  // --- Add Save As ---
  saveImageAs: (
    imageDataUrl: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  // --- End Add ---
  // --- Add Window Capture ---
  getWindowSources: () => Promise<AppWindowSource[]>;
  captureWindow: (windowId: string) => Promise<{
    success: boolean;
    dataUrl?: string;
    message?: string;
    error?: string;
  }>;
  // --- End Add ---
  // --- NEW Settings API Signatures ---
  getSettings: () => Promise<AppSettings>;
  saveSettings: (
    newSettings: Partial<AppSettings>
  ) => Promise<{ success: boolean }>;
  resetSettings: () => Promise<AppSettings>;
  // Generic listener function (added)
  on: (
    channel: string,
    listener: (
      event: import("electron").IpcRendererEvent,
      ...args: any[]
    ) => void
  ) => () => void;
  // --- END NEW ---
  // Add other exposed functions here as needed
  moveWindow: (deltaX: number, deltaY: number) => void;
  focusMainWindow: () => void;
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

// Window source type for window capture - aliased import if name conflict
// interface WindowSource { // This is already defined in ../types, imported as AppWindowSource
//   id: string;
//   name: string;
//   thumbnailDataUrl: string;
//   appIcon?: string;
// }

declare global {
  interface Window {
    electronAPI: IElectronAPI;
    captureAPI: ICaptureAPI;
  }
}

// Export an empty object to satisfy the module requirement
export {};
