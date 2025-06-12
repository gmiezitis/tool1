import fs from "fs";
import path from "path";
import { app } from "electron"; // To get user data path
import type { Tool, PenSize, AppSettings, HubMenuSettings } from "./types"; // Import AppSettings, Tool, and PenSize types

// Define the structure of our settings
// export interface AppSettings { // << Remove this local definition
//   saveFormat: "png" | "jpg";
//   jpegQuality: number; // 1-100
//   captureIncludeCursor: boolean;
//   captureAutoCopyToClipboard: boolean;
//   defaultPenColor: string;
//   defaultPenSize: PenSize; // Use imported PenSize
//   defaultTextColor: string;
//   defaultTextSize: PenSize; // Use imported PenSize
//   defaultHighlighterColor: string;
//   defaultHighlighterSize: PenSize;
//   defaultStepColor: string;
//   defaultStepSize: PenSize; // <<< NEW
//   defaultTool: Tool;
//   defaultBlurStrength: number; // Strength of the blur effect
//   defaultBlurMode: "focus" | "spot"; // <<< Already exists, just ensure it's near related settings
// }

// Define default values
const defaultSettings: AppSettings = {
  saveFormat: "png",
  jpegQuality: 95,
  captureIncludeCursor: false,
  captureAutoCopyToClipboard: false,
  defaultPenColor: "#ff0000",
  defaultPenSize: "m",
  defaultTextColor: "#ff0000",
  defaultTextSize: "m",
  defaultHighlighterColor: "#FF0000", // FORCE RED
  defaultHighlighterSize: "m",
  defaultStepColor: "#ff0000",
  defaultStepSize: "m",
  defaultTool: "select",
  defaultBlurStrength: 10,
  defaultBlurMode: "focus",
  hubMenu: {
    availableColors: ["blue", "green", "red", "default"],
    preferredColors: ["blue", "green", "red"],
    menuOpacity: 0.8,
    autoHideDelay: 300,
    enableColorCycling: true,
    maxHexagons: 19,
    showLabels: true,
    hexagonSize: "medium",
    layoutStyle: "circular",
    customApplications: [],
    enableDragAndDrop: true,
  },
};

// Define the path for the settings file
// Use app.getPath('userData') for a standard location
const settingsFilePath = path.join(
  app.getPath("userData"),
  "app-settings.json"
);

// Function to ensure the settings file exists and read it
function readOrCreateSettingsFile(): AppSettings {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const rawData = fs.readFileSync(settingsFilePath, "utf-8");
      const parsedSettings = JSON.parse(rawData);
      // Merge with defaults to ensure all keys are present
      return { ...defaultSettings, ...parsedSettings };
    } else {
      // File doesn't exist, create it with defaults
      fs.writeFileSync(
        settingsFilePath,
        JSON.stringify(defaultSettings, null, 2),
        "utf-8"
      );
      return { ...defaultSettings };
    }
  } catch (error) {
    console.error(
      `Error reading/creating settings file at ${settingsFilePath}:`,
      error
    );
    // Fallback to defaults in case of error
    return { ...defaultSettings };
  }
}

// Function to get all settings
export function getSettings(): AppSettings {
  return readOrCreateSettingsFile();
}

// Function to save settings (partial updates)
export function saveSettings(newSettings: Partial<AppSettings>): void {
  try {
    const currentSettings = readOrCreateSettingsFile(); // Read current settings
    const updatedSettings = { ...currentSettings, ...newSettings }; // Merge changes
    fs.writeFileSync(
      settingsFilePath,
      JSON.stringify(updatedSettings, null, 2),
      "utf-8"
    );
    console.log("Settings saved manually:", updatedSettings);
  } catch (error) {
    console.error(`Error writing settings file at ${settingsFilePath}:`, error);
  }
}

// Function to reset settings to default
export function resetSettings(): AppSettings {
  try {
    fs.writeFileSync(
      settingsFilePath,
      JSON.stringify(defaultSettings, null, 2),
      "utf-8"
    );
    console.log("Settings reset to defaults (manual).");
    return { ...defaultSettings };
  } catch (error) {
    console.error(
      `Error resetting settings file at ${settingsFilePath}:`,
      error
    );
    // Fallback to defaults
    return { ...defaultSettings };
  }
}
