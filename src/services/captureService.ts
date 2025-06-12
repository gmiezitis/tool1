import { BrowserWindow, desktopCapturer, screen, nativeImage } from "electron";
import fs from "fs";
import path from "path";

// Type for capture options
export interface CaptureOptions {
  captureType?: "fullscreen" | "region" | "window";
  windowId?: string;
}

// Type for capture result
export interface CaptureResult {
  success: boolean;
  dataUrl?: string;
  message?: string;
  error?: Error;
}

/**
 * Captures the full screen of the primary display
 */
export async function captureFullScreen(): Promise<CaptureResult> {
  try {
    console.log("Handling fullscreen capture...");

    // Get primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor;

    // Add small delay to ensure UI is ready
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Get screen sources
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: width * scaleFactor,
        height: height * scaleFactor,
      },
    });

    // Find the source corresponding to the primary display
    const primarySource = sources.find(
      (source) => source.display_id?.toString() === primaryDisplay.id.toString()
    );

    if (!primarySource) {
      throw new Error("Primary display source not found.");
    }

    console.log(
      "Fullscreen source thumbnail dimensions:",
      primarySource.thumbnail.getSize()
    );

    // Get the image data as a Data URL
    const dataUrl = primarySource.thumbnail.toDataURL();

    console.log("Fullscreen capture successful.");
    return { success: true, dataUrl };
  } catch (error) {
    console.error("Fullscreen capture failed:", error);
    return {
      success: false,
      message: error.message || "An unknown capture error occurred",
      error,
    };
  }
}

/**
 * Gets a list of all capturable windows for selection
 */
export async function getWindowSources() {
  try {
    console.log("Getting window sources for capture...");

    // Add small delay to ensure UI is ready
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Get window sources
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 300, height: 300 },
    });

    console.log(`Found ${sources.length} window sources.`);
    sources.forEach((source) => {
      console.log(
        `  - ${source.name} (ID: ${source.id}) thumbnail dimensions:`,
        source.thumbnail.getSize()
      );
    });

    // Filter out the main application window
    const filteredSources = sources.filter(
      (source) => source.name !== "productivity-tool"
    );

    // Map the filtered sources to a more friendly format
    return filteredSources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnailDataUrl: source.thumbnail.toDataURL(),
      appIcon: source.appIcon?.toDataURL(),
    }));
  } catch (error) {
    console.error("Error getting window sources:", error);
    throw error;
  }
}

/**
 * Captures a specific window by ID
 */
export async function captureWindow(windowId: string): Promise<CaptureResult> {
  try {
    console.log(`Capturing window with ID: ${windowId}`);

    // Add small delay to ensure UI is ready
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Request larger thumbnails for the actual capture
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 2000, height: 2000 },
    });

    // Find the requested window
    const targetWindow = sources.find((source) => source.id === windowId);

    if (!targetWindow) {
      throw new Error(`Window with ID ${windowId} not found`);
    }

    console.log(
      `Target window (${targetWindow.name}) thumbnail dimensions:`,
      targetWindow.thumbnail.getSize()
    );

    // Create data URL from the thumbnail
    const dataUrl = targetWindow.thumbnail.toDataURL();

    return {
      success: true,
      dataUrl,
    };
  } catch (error) {
    console.error("Window capture failed:", error);
    return {
      success: false,
      message: error.message || "Failed to capture window",
      error,
    };
  }
}

/**
 * Saves an image to disk based on format
 */
export async function saveImageAs(
  imageDataUrl: string,
  filePath: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    if (!imageDataUrl) {
      throw new Error("Image data is empty");
    }

    // Create native image from data URL
    const image = nativeImage.createFromDataURL(imageDataUrl);

    // Determine format and save
    let imageDataBuffer: Buffer;
    const fileExtension = path.extname(filePath).toLowerCase();

    if (fileExtension === ".jpg" || fileExtension === ".jpeg") {
      // Save as JPEG (quality 90)
      imageDataBuffer = image.toJPEG(90);
      console.log("Saving as JPEG.");
    } else {
      // Default to PNG
      imageDataBuffer = image.toPNG();
      console.log("Saving as PNG.");
    }

    await fs.promises.writeFile(filePath, imageDataBuffer);
    console.log("Image saved successfully.");

    return { success: true, filePath };
  } catch (error) {
    console.error("Error saving image:", error);
    return {
      success: false,
      error: error.message || "Failed to save image",
    };
  }
}
