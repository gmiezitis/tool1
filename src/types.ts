// import type { AppSettings } from "./manualSettingsStore"; // Remove this line

// --- NEW: Add all type definitions here ---

// Define tool types
export type Tool =
  | "pen"
  | "arrow"
  | "text"
  | "blur"
  | "highlighter"
  | "rectangle"
  | "ellipse"
  | "step"
  | "select"
  | "move"
  | "none"
  | "text-dragging"
  | "blur-dragging";

// Define size types
export type PenSize = "s" | "m" | "l";
export type BlurMode = "spot" | "focus";

// Base annotation interface
export interface BaseAnnotation {
  id: string; // Unique ID for selection, modification, deletion
}

// Text annotation interface
export interface TextAnnotation extends BaseAnnotation {
  type: "text";
  x: number; // Scaled canvas coordinate (text position)
  y: number; // Scaled canvas coordinate (text baseline)
  content: string;
  color: string;
  font: string; // Includes size and font family
  size: PenSize; // Store the abstract size ('s', 'm', 'l')
  // Optional box bounds for text area
  boxX?: number; // Box top-left x
  boxY?: number; // Box top-left y
  boxWidth?: number; // Box width
  boxHeight?: number; // Box height
}

// Pen annotation interface
export interface PenAnnotation extends BaseAnnotation {
  type: "pen";
  points: { x: number; y: number }[]; // Array of points in the stroke
  color: string;
  width: number;
  size: PenSize; // Store abstract size too
}

// Arrow annotation interface
export interface ArrowAnnotation extends BaseAnnotation {
  type: "arrow";
  startX: number; // Scaled coordinate
  startY: number; // Scaled coordinate
  endX: number; // Scaled coordinate
  endY: number; // Scaled coordinate
  color: string;
  width: number;
  size: PenSize; // Store abstract size
}

// Blur annotation interface
export interface BlurAnnotation extends BaseAnnotation {
  type: "blur";
  mode: "spot";
  points?: { x: number; y: number }[];
  brushSize?: number;
}

// Highlighter annotation interface
export interface HighlighterAnnotation extends BaseAnnotation {
  type: "highlighter";
  points: { x: number; y: number }[]; // Array of points in the stroke
  color: string; // Base color (e.g., yellow)
  width: number; // Thickness
  size: PenSize; // Store abstract size too
}

// Rectangle annotation interface
export interface RectangleAnnotation extends BaseAnnotation {
  type: "rectangle";
  x: number; // Scaled top-left x
  y: number; // Scaled top-left y
  width: number; // Scaled width
  height: number; // Scaled height
  color: string; // Stroke color
  lineWidth: number; // Stroke width
  size: PenSize; // Store abstract size
}

// Ellipse annotation interface
export interface EllipseAnnotation extends BaseAnnotation {
  type: "ellipse";
  cx: number; // Scaled center x
  cy: number; // Scaled center y
  rx: number; // Scaled radius x
  ry: number; // Scaled radius y
  color: string; // Stroke color
  lineWidth: number; // Stroke width
  size: PenSize; // Store abstract size
}

// Step annotation interface
export interface StepAnnotation extends BaseAnnotation {
  type: "step";
  cx: number; // Scaled center x
  cy: number; // Scaled center y
  radius: number; // Scaled radius (derived from font size)
  number: number; // The step number
  color: string; // Color for circle and text
  fontSize: number; // Font size used for number and radius calculation
  size: PenSize; // Store abstract size used ('s', 'm', 'l')
}

// --- NEW: Focus Rectangle Annotation ---
export interface FocusRectangleAnnotation extends BaseAnnotation {
  type: "focusRect";
  x: number; // Scaled top-left x
  y: number; // Scaled top-left y
  width: number; // Scaled width
  height: number; // Scaled height
  // No color or line width, as these are invisible areas
}

// Union type for all annotations
export type AnnotationObject =
  | TextAnnotation
  | PenAnnotation
  | ArrowAnnotation
  | BlurAnnotation
  | HighlighterAnnotation
  | RectangleAnnotation
  | EllipseAnnotation
  | StepAnnotation
  | FocusRectangleAnnotation;

// Custom CSS properties interface
import type { CSSProperties } from "react";

export interface DraggableCSSProperties extends CSSProperties {
  WebkitAppRegion?: "drag" | "no-drag";
}

// --- HubMenu Settings ---
export type HexagonColor = "blue" | "green" | "red" | "default";

// --- NEW: External Application Types ---
export interface ExternalApplication {
  id: string;
  name: string;
  executablePath: string;
  arguments?: string[];
  workingDirectory?: string;
  icon?: string; // Path to icon file or base64 data
  color?: HexagonColor;
  isCustom: boolean; // Whether this was added by user vs detected
}

export interface HubMenuSettings {
  availableColors: HexagonColor[];
  preferredColors: HexagonColor[];
  menuOpacity: number; // 0-1
  autoHideDelay: number; // milliseconds
  enableColorCycling: boolean;
  maxHexagons: number;
  showLabels: boolean;
  hexagonSize: "small" | "medium" | "large";
  layoutStyle: "circular" | "grid"; // New option for layout style
  // Add support for external applications
  customApplications: ExternalApplication[];
  enableDragAndDrop: boolean;
}

// --- AppSettings Definition (Moved from manualSettingsStore.ts) ---
export interface AppSettings {
  saveFormat: "png" | "jpg";
  jpegQuality: number; // 1-100
  captureIncludeCursor: boolean;
  captureAutoCopyToClipboard: boolean;
  defaultPenColor: string;
  defaultPenSize: PenSize; // Uses PenSize from this file
  defaultTextColor: string;
  defaultTextSize: PenSize; // Uses PenSize from this file
  defaultHighlighterColor: string;
  defaultHighlighterSize: PenSize; // Uses PenSize from this file
  defaultStepColor: string;
  defaultStepSize: PenSize; // Uses PenSize from this file
  defaultTool: Tool; // Uses Tool from this file
  defaultBlurStrength: number; // Strength of the blur effect
  defaultBlurMode: "focus" | "spot"; // Uses BlurMode from this file (ensure BlurMode includes these)
  // Add hub menu settings
  hubMenu: HubMenuSettings;
}

// --- NEW: WindowSource type (moved from preload.ts) ---
export interface WindowSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  appIcon?: string;
}

// --- NEW: CapturerSourceWithPrimary for getScreenSources ---
// We need to import DesktopCapturerSource from Electron, or redefine its known properties
// For simplicity if direct import isn't feasible in this context, list common properties:
export interface CapturerSourceWithPrimary {
  id: string;
  name: string;
  thumbnail: Electron.NativeImage; // Or string if it's a data URL post-IPC
  display_id?: string;
  appIcon?: Electron.NativeImage; // Or string
  // Add other properties from Electron.DesktopCapturerSource if needed
  isPrimary: boolean; // The custom property
}
// --- End of type definitions ---
