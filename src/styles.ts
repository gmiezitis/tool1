import type { CSSProperties } from "react";
import type { DraggableCSSProperties, PenSize } from "./types";

// Cast style objects to any where non-standard CSS is used
export const buttonStyle: any = { WebkitAppRegion: "no-drag" };
export const buttonStyleMargin: any = {
  WebkitAppRegion: "no-drag",
  marginLeft: "5px",
};
export const imageStyle: any = {
  maxWidth: "100%",
  maxHeight: "150px",
  border: "1px solid #ccc",
  WebkitAppRegion: "no-drag",
};
export const quitButtonStyle: any = {
  WebkitAppRegion: "no-drag",
  marginLeft: "auto",
  display: "block",
}; // Style for quit button

// Explicit non-drag style for canvas container
export const canvasContainerStyle: DraggableCSSProperties = {
  flexGrow: 1,
  overflow: "auto",
  position: "relative",
  WebkitAppRegion: "no-drag", // Mark canvas area as non-draggable
};

// Base style for zoomable canvas container
const canvasContainerStyleBase: DraggableCSSProperties = {
  flexGrow: 1,
  overflow: "auto", // Enable scrollbars when content overflows
  position: "relative",
  WebkitAppRegion: "no-drag", // Mark canvas area as non-draggable
  transformOrigin: "top left", // Zoom relative to top-left corner
  display: "flex", // Add this: enable flexbox
  justifyContent: "center", // Add this: center horizontally
  alignItems: "center", // Add this: center vertically
  minHeight: "100%", // Add this: ensure it takes full height
  minWidth: "100%", // Add this: ensure it takes full width
};

// Function to get dynamic container style based on zoom
export const getCanvasContainerStyle = (
  zoom: number
): DraggableCSSProperties => ({
  ...canvasContainerStyleBase,
  // transform: `scale(${zoom})`, // Removed transform here because the canvas is already resized by zoom; this avoids double scaling.
});

export const canvasStyle: CSSProperties = {
  display: "block",
  position: "absolute",
  top: 0,
  left: 0,
  maxWidth: "none",
  maxHeight: "none",
}; // Basic canvas style

export const previewCanvasStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  pointerEvents: "none", // Let mouse events pass through to the main canvas underneath
};

export const penSizeValues: Record<PenSize, number> = { s: 2, m: 5, l: 10 }; // Map size names to pixel values for PEN
export const textSizeValues: Record<PenSize, number> = { s: 12, m: 16, l: 24 }; // Map size names to pixel values for TEXT
export const highlighterSizeValues: Record<PenSize, number> = {
  s: 8,
  m: 16,
  l: 24,
}; // Map size names to pixel values for HIGHLIGHTER - larger sizes
