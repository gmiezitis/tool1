/// <reference path="./preload.d.ts" />
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  CSSProperties,
} from "react";
// Attempt to force TypeScript to recognize global types
import type {} from "./preload.d";
// Import components
import WindowSelector from "./components/WindowSelector";
import Toolbar from "./components/Toolbar";
import SettingsModal from "./components/SettingsModal";
import ErrorBoundary from "./components/ErrorBoundary";
// Import types
// import type { AppSettings } from "./manualSettingsStore"; // No longer exported from here
import type {
  AppSettings,
  Tool,
  PenSize,
  WindowSource,
  BlurMode /*, other types as needed */,
} from "./types";
import {
  // Tool, // Now imported from ./types
  // PenSize, // Now imported from ./types
  AnnotationObject,
  DraggableCSSProperties,
  TextAnnotation,
  PenAnnotation,
  ArrowAnnotation,
  BlurAnnotation,
  HighlighterAnnotation,
  RectangleAnnotation,
  EllipseAnnotation,
  StepAnnotation,
  // BlurMode, // Now imported from ./types
  // WindowSource, // Now imported from ./types
  FocusRectangleAnnotation,
} from "./types";
// Import styles
import {
  buttonStyle,
  buttonStyleMargin,
  imageStyle,
  quitButtonStyle,
  canvasContainerStyle,
  getCanvasContainerStyle,
  canvasStyle,
  previewCanvasStyle,
  penSizeValues,
  textSizeValues,
  highlighterSizeValues,
} from "./styles";
import { debounce } from "lodash"; // Ensure lodash is imported

// Helper function to create a data URL for an SVG circle cursor
const createCircleCursorUrl = (
  diameter: number,
  fillColor: string,
  strokeColor?: string
): string => {
  const strokeWidth = strokeColor ? 1 : 0;
  // Ensure diameter is at least 1 to avoid negative radius with stroke
  const safeDiameter = Math.max(diameter, strokeWidth * 2 + 1);
  const radius = (safeDiameter - strokeWidth * 2) / 2;
  const effectiveDiameter = safeDiameter;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${effectiveDiameter}" height="${effectiveDiameter}" viewBox="0 0 ${effectiveDiameter} ${effectiveDiameter}">
      <circle cx="${effectiveDiameter / 2}" cy="${
    effectiveDiameter / 2
  }" r="${radius}" fill="${fillColor}" ${
    strokeColor ? `stroke="${strokeColor}" stroke-width="${strokeWidth}"` : ""
  } />
    </svg>
  `.trim();
  return `url('data:image/svg+xml;base64,${btoa(svg)}') ${
    effectiveDiameter / 2
  } ${effectiveDiameter / 2}, auto`;
};

// Helper function to create a simple highlighter cursor with crosshair and preview dot
const createSimpleHighlighterCursorUrl = (
  size: number,
  color: string
): string => {
  const totalSize = Math.max(size + 10, 20); // Ensure minimum size
  const centerX = totalSize / 2;
  const centerY = totalSize / 2;
  const dotRadius = Math.max(size / 4, 2);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">
      <!-- Crosshair lines -->
      <line x1="${centerX}" y1="2" x2="${centerX}" y2="${
    totalSize - 2
  }" stroke="#000" stroke-width="1" opacity="0.8"/>
      <line x1="2" y1="${centerY}" x2="${
    totalSize - 2
  }" y2="${centerY}" stroke="#000" stroke-width="1" opacity="0.8"/>
      <!-- Preview dot -->
      <circle cx="${centerX}" cy="${centerY}" r="${dotRadius}" fill="${color}" opacity="0.7" stroke="#000" stroke-width="1"/>
    </svg>
  `.trim();
  return `url('data:image/svg+xml;base64,${btoa(
    svg
  )}') ${centerX} ${centerY}, auto`;
};

// Define the functional component directly
const App = () => {
  // Define scrollOffset at the very beginning to ensure it's available
  const [scrollOffset, setScrollOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // --- NEW: Dynamic Cursor Style State ---
  const [dynamicCursorStyle, setDynamicCursorStyle] =
    useState<string>("crosshair"); // Default to crosshair or auto

  // --- Settings State ---
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // --- State Initialized with Defaults (will be updated by settings) ---
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [originalCapturedDataUrl, setOriginalCapturedDataUrl] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState<string>("Loading settings...");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null); // Use ref for image element
  const canvasContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container

  // Refs for drag optimization
  const canvasRectRef = useRef<DOMRect | null>(null);
  const canvasScaleRef = useRef<{ x: number; y: number } | null>(null); // <<< REINSTATE definition
  const relativeStartPosRef = useRef<{ x: number; y: number } | null>(null); // Ref for drag START - MAIN RELATIVE COORDS (Used for shapes/arrow/blur focus/text FINALIZATION)
  const previewElementStartPosRef = useRef<{ x: number; y: number } | null>(
    null
  ); // <<< NEW: Ref for PREVIEW drag START - ELEMENT RELATIVE COORDS
  const penLastRelativePosRef = useRef<{ x: number; y: number } | null>(null); // Ref SPECIFICALLY for Pen/Highlight/SpotBlur drawing (using MAIN RELATIVE coords for annotation data)
  // const penLastPreviewElementPosRef = useRef<{ x: number; y: number } | null>(null); // <<< Optional: If drawing pen preview segments directly
  const dragWindowStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Refs for throttling
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Keep for potential future use
  const lastThrottledDrawTimeRef = useRef<number>(0);
  const throttleInterval = 40; // ~25 FPS, less frequent drawing

  // --- Annotation State ---
  const [selectedTool, setSelectedTool] = useState<Tool>("pen"); // Changed from "select" to "pen"
  // Initialize with hardcoded defaults, will be overwritten by useEffect
  const [penColor, setPenColor] = useState<string>("#FF0000");
  const [selectedPenSize, setSelectedPenSize] = useState<PenSize>("m");
  const [penWidth, setPenWidth] = useState<number>(penSizeValues["m"]);
  const [selectedHighlighterSize, setSelectedHighlighterSize] =
    useState<PenSize>("m"); // <<< NEW
  const [highlighterWidth, setHighlighterWidth] = useState<number>(
    highlighterSizeValues["m"]
  ); // <<< NEW: Use highlighter size values
  const [highlighterColor, setHighlighterColor] = useState<string>("#FF0000"); // FORCE RED DEFAULT
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [lastPosition, setLastPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationObject[]>([]);
  const [history, setHistory] = useState<AnnotationObject[][]>([]); // Undo history

  // --- Selection State (disabled but kept for compilation) ---
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);
  const [isDraggingAnnotation, setIsDraggingAnnotation] =
    useState<boolean>(false);
  const [dragStartOffset, setDragStartOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [selectedTextSize, setSelectedTextSize] = useState<PenSize>("m");
  const [textColor, setTextColor] = useState<string>("#FF0000");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentFontSize, setCurrentFontSize] = useState<number>(
    textSizeValues["m"]
  );

  // --- NEW Blur State ---
  const [selectedBlurMode, setSelectedBlurMode] = useState<BlurMode>("spot");
  const [blurStrength, setBlurStrength] = useState<number>(5); // For the actual blur effect
  // const [selectedBlurSize, setSelectedBlurSize] = useState<PenSize>("m"); // <<< REMOVE
  const [blurBrushSize, setBlurBrushSize] = useState<number>(
    penSizeValues["m"]
  ); // Default to medium, will be set if mode is spot

  // --- NEW Step Tool State ---
  const [stepCounter, setStepCounter] = useState<number>(1);
  const [stepColor, setStepColor] = useState<string>("#FF0000"); // Color for step circles/numbers
  const [selectedStepSize, setSelectedStepSize] = useState<PenSize>("m"); // <<< NEW
  const [stepBrushSize, setStepBrushSize] = useState<number>(
    penSizeValues["m"]
  ); // <<< NEW

  // const viewportClickPosRef = useRef<{ x: number; y: number } | null>(null); // <-- REMOVE Ref for text input viewport position

  // --- Window Selector State ---
  const [isWindowSelectorVisible, setIsWindowSelectorVisible] = useState(false);
  const [windowSources, setWindowSources] = useState<WindowSource[]>([]);

  // --- Recording State ---
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  // --- NEW: Editor Fullscreen State (for Toolbar's isFullscreen prop) ---
  const [isEditorFullscreen, setIsEditorFullscreen] = useState<boolean>(false);

  // --- NEW Zoom State ---
  const zoomLevel = 1.0; // <<< FIXED: Set zoom level to 1.0 permanently
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const [lastDragPoint, setLastDragPoint] = useState<{
    x: number;
    y: number;
  } | null>(null); // Changed from useState
  const [isDraggingWindow, setIsDraggingWindow] = useState(false); // << ADDED State for window dragging

  // --->>> NEW: Ref to store the original bounds of the annotation being dragged <<<---
  const draggedAnnotationOriginalBoundsRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const draggedAnnotationSnapshotRef = useRef<AnnotationObject | null>(null); // <<< NEW

  // --->>> NEW: Ref to store the last mouse move coordinates <<<---
  const lastMouseMoveRelativePosRef = useRef<{ x: number; y: number } | null>(
    null
  );
  // --- End NEW ---

  // --- NEW: Image Loaded State ---
  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false);

  // --- CAPTURE HANDLERS ---
  const handleCaptureResult = (dataUrl: string | null, captureType: string) => {
    if (dataUrl) {
      setCapturedDataUrl(dataUrl);
      setOriginalCapturedDataUrl(dataUrl);
      setIsImageLoaded(false); // Set to false until the new image is loaded
      setMessage(`${captureType} capture successful. Processing...`);
      // Potentially reset annotations, history, step counter if it's a new base image
      setAnnotations([]);
      setHistory([]);
      setStepCounter(1);
    } else {
      setMessage(`Failed to capture ${captureType}: No data URL returned.`);
    }
  };

  const handleFullscreenCapture = async () => {
    setMessage("Initiating fullscreen capture...");
    if (window.electronAPI && window.electronAPI.invokeCapture) {
      try {
        const result = await window.electronAPI.invokeCapture("fullscreen");
        console.log(
          "[handleFullscreenCapture] Capture invoked, result:",
          result
        );

        // Handle the result directly if it contains dataUrl
        if (result && result.success && result.dataUrl) {
          setCapturedDataUrl(result.dataUrl);
          setOriginalCapturedDataUrl(result.dataUrl);
          setIsImageLoaded(false); // Will be set to true when image loads
          setMessage("Fullscreen capture successful. Processing...");
          // Reset annotations and history for new capture
          setAnnotations([]);
          setHistory([]);
          setStepCounter(1);
        } else if (result && result.success === false) {
          setMessage(
            `Failed to initiate fullscreen capture: ${
              result.message || "Unknown error"
            }`
          );
        } else {
          setMessage("Fullscreen capture initiated. Please wait...");
        }
      } catch (error) {
        console.error("Error during fullscreen capture:", error);
        setMessage(`Error during fullscreen capture: ${error.message}`);
      }
    } else {
      setMessage("Fullscreen capture API not available.");
      console.error("electronAPI.invokeCapture is not available.");
    }
  };

  const handleRegionCapture = async () => {
    setMessage("Initiating region capture...");
    if (window.electronAPI && window.electronAPI.invokeCapture) {
      try {
        const result = await window.electronAPI.invokeCapture("region");
        console.log("[handleRegionCapture] Capture invoked, result:", result);
        // Note: The actual captured data will come via the capture-data IPC event
        // The result here is just confirmation that the capture was initiated
        if (result && result.success === false) {
          setMessage(
            `Failed to initiate region capture: ${
              result.message || "Unknown error"
            }`
          );
        } else {
          setMessage("Region capture initiated. Please wait...");
        }
      } catch (error) {
        console.error("Error during region capture:", error);
        setMessage(`Error during region capture: ${error.message}`);
      }
    } else {
      setMessage("Region capture API not available.");
      console.error("electronAPI.invokeCapture is not available.");
    }
  };
  // onNewCapture will be used for onWindowCapture prop of Toolbar
  const onNewCapture = async () => {
    if (window.electronAPI && window.electronAPI.getWindowSources) {
      try {
        const sources = await window.electronAPI.getWindowSources();
        setWindowSources(sources);
        setIsWindowSelectorVisible(true); // Show selector
      } catch (error) {
        console.error("Error getting window sources:", error);
        setMessage("Failed to get window sources.");
      }
    } else {
      console.error(
        "electronAPI not available or getWindowSources is not a function"
      );
      setMessage("Error: Electron API for getting sources is not available.");
    }
  };

  // --- NEW Toolbar Handlers ---
  const handleStartRecording = async () => {
    setMessage("Attempting to start recording...");
    if (window.electronAPI && window.electronAPI.startRecording) {
      try {
        // We need a way to select a source or use primary for recording
        // For now, let's assume getScreenSources can provide a primary or let user select
        const sources = await window.electronAPI.getScreenSources();
        // Simplistic: try to find primary screen, or first screen source.
        // In a real app, you'd let the user pick from 'sources'.
        const primaryScreen =
          sources.find((s) => s.isPrimary && s.id.startsWith("screen:")) ||
          sources.find((s) => s.id.startsWith("screen:"));

        if (primaryScreen) {
          const result = await window.electronAPI.startRecording({
            screenId: primaryScreen.id,
          });
          if (result.success) {
            setIsRecording(true);
            setMessage("Recording started.");
          } else {
            setMessage(`Failed to start recording: ${result.message}`);
            console.error("Failed to start recording:", result.message);
          }
        } else {
          setMessage("No suitable screen found to start recording.");
          console.error("No suitable screen found for recording.");
        }
      } catch (error) {
        console.error("Error starting recording:", error);
        setMessage(`Error starting recording: ${error.message}`);
      }
    } else {
      console.error("Recording API (startRecording) not available.");
      setMessage("Recording API not available.");
    }
  };

  const handleStopRecording = async () => {
    setMessage("Attempting to stop recording...");
    if (window.electronAPI && window.electronAPI.stopRecording) {
      try {
        const result = await window.electronAPI.stopRecording();
        setIsRecording(false); // Stop recording state regardless of save success
        if (result.success && result.buffer) {
          setMessage("Recording stopped. Saving video...");
          if (window.electronAPI.saveVideo) {
            const saveResult = await window.electronAPI.saveVideo(
              result.buffer
            );
            if (saveResult.success) {
              setMessage(`Recording saved to ${saveResult.filePath}`);
            } else {
              setMessage(`Failed to save recording: ${saveResult.error}`);
              console.error("Failed to save recording:", saveResult.error);
            }
          } else {
            setMessage(
              "Save video API not available after stopping recording."
            );
            console.error("saveVideo API not available.");
          }
        } else {
          setMessage(
            `Failed to stop recording or no data: ${
              result.message || "Unknown error"
            }`
          );
          console.error("Failed to stop recording or no data:", result.message);
        }
      } catch (error) {
        setIsRecording(false);
        console.error("Error stopping recording:", error);
        setMessage(`Error stopping recording: ${error.message}`);
      }
    } else {
      setIsRecording(false); // Ensure recording state is reset
      console.error("Recording API (stopRecording) not available.");
      setMessage("Recording API not available.");
    }
  };

  const handleCopyImageToClipboard = async () => {
    if (!canvasRef.current) {
      setMessage("Canvas not available to copy from.");
      return;
    }
    // Ensure there's something to copy
    if (!isImageLoaded && annotations.length === 0) {
      setMessage("Nothing to copy. Please capture or create an annotation.");
      return;
    }

    try {
      // Redraw onto a temporary canvas to ensure we get the clean image with annotations
      // without any selection highlights or other UI elements.
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvasRef.current.width;
      tempCanvas.height = canvasRef.current.height;
      const tempCtx = tempCanvas.getContext("2d");

      if (!tempCtx) {
        setMessage("Failed to create temporary canvas for copying.");
        return;
      }

      // Perform a clean redraw on the temporary canvas
      // This assumes redrawCanvas can take a target context or we adapt it.
      // For simplicity, we'll assume redrawCanvas logic needs to be replicated or adapted.
      // Let's directly use canvasRef.current.toBlob for now, acknowledging it includes selection.
      // A more robust solution would redraw cleanly.

      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, "image/png")
      );

      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setMessage("Image copied to clipboard!");
      } else {
        setMessage("Failed to copy image: could not create blob.");
      }
    } catch (error) {
      console.error("Error copying image to clipboard:", error);
      setMessage(`Failed to copy image: ${error.message || "Unknown error"}`);
    }
  };

  const handleQuitApp = () => {
    if (window.electronAPI && window.electronAPI.quitApp) {
      window.electronAPI.quitApp();
    } else {
      console.error("Electron API to quit app is not available.");
      setMessage("Quit App API not available.");
    }
  };
  // --- End NEW Toolbar Handlers ---

  // --- Effect to load captured image and set canvas size ---
  useEffect(() => {
    const img = imageElementRef.current;
    if (capturedDataUrl && img) {
      img.onload = () => {
        if (canvasRef.current) {
          canvasRef.current.width = img.naturalWidth;
          canvasRef.current.height = img.naturalHeight;
        }
        // Also set preview canvas size if it exists
        if (previewCanvasRef.current) {
          previewCanvasRef.current.width = img.naturalWidth;
          previewCanvasRef.current.height = img.naturalHeight;
        }
        setScrollOffset({ x: 0, y: 0 }); // Reset scroll on new image
        setIsImageLoaded(true); // Crucial: Signal that the image is ready for drawing
        setMessage("Image processed and ready for annotation.");
      };
      img.onerror = (e) => {
        console.error("Error loading captured image:", e);
        setMessage(
          "Error loading captured image. It might be corrupted or invalid."
        );
        setIsImageLoaded(false);
      };
      img.src = capturedDataUrl;
    } else if (!capturedDataUrl) {
      // Clear canvas or hide if no image
      setIsImageLoaded(false);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
        }
      }
    }
  }, [capturedDataUrl]); // Dependency: capturedDataUrl

  // --- Simple canvas drawing effect for testing ---
  useEffect(() => {
    if (
      isImageLoaded &&
      capturedDataUrl &&
      canvasRef.current &&
      imageElementRef.current
    ) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = imageElementRef.current;

      if (ctx && img.complete) {
        console.log("[Canvas Test] Drawing image to canvas");

        // Set canvas size to match image
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // Clear and draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        console.log("[Canvas Test] Canvas drawing completed");
      }
    }
  }, [isImageLoaded, capturedDataUrl]); // Removed annotations dependency

  // --- Mouse Event Handlers ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      // Store relative start position for shapes and other tools
      relativeStartPosRef.current = { x, y };

      if (selectedTool === "pen") {
        setIsDrawing(true);
        setLastPosition({ x, y });

        // Start new pen annotation
        const newAnnotation: PenAnnotation = {
          id: `pen_${Date.now()}`,
          type: "pen",
          points: [{ x, y }],
          color: penColor,
          width: penWidth,
          size: selectedPenSize,
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
      } else if (selectedTool === "highlighter") {
        setIsDrawing(true);
        setLastPosition({ x, y });

        // Start new highlighter annotation
        const newAnnotation: HighlighterAnnotation = {
          id: `highlighter_${Date.now()}`,
          type: "highlighter",
          points: [{ x, y }],
          color: highlighterColor, // Use highlighter color state
          width: highlighterWidth,
          size: selectedHighlighterSize,
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
      } else if (selectedTool === "blur" && selectedBlurMode === "spot") {
        setIsDrawing(true);
        setLastPosition({ x, y });

        // Start new spot blur annotation
        const newAnnotation: BlurAnnotation = {
          id: `blur_${Date.now()}`,
          type: "blur",
          mode: "spot",
          points: [{ x, y }],
          brushSize: blurBrushSize,
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
      } else if (selectedTool === "text") {
        // Greenshot-style: Draw text box first, then type
        setIsDrawing(true);
      } else if (selectedTool === "step") {
        // Create step annotation immediately
        const fontSize = textSizeValues[selectedStepSize];
        const radius = fontSize * 0.8;

        const newAnnotation: StepAnnotation = {
          id: `step_${Date.now()}`,
          type: "step",
          cx: x,
          cy: y,
          radius: radius,
          number: stepCounter,
          color: stepColor,
          fontSize: fontSize,
          size: selectedStepSize,
        };

        setAnnotations((prev) => [...prev, newAnnotation]);
        setStepCounter((prev) => prev + 1);
      } else if (selectedTool === "blur" && selectedBlurMode === "focus") {
        // Start drawing focus rectangle
        setIsDrawing(true);
      } else if (["arrow", "rectangle", "ellipse"].includes(selectedTool)) {
        // Start interactive drawing for shapes
        setIsDrawing(true);
      }
    },
    [
      selectedTool,
      penColor,
      penWidth,
      selectedPenSize,
      highlighterWidth,
      selectedHighlighterSize,
      selectedBlurMode,
      blurBrushSize,
      stepCounter,
      stepColor,
      selectedStepSize,
      textSizeValues,
      annotations,
      highlighterColor,
      selectedTextSize,
      textColor,
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current || !isDrawing) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      if (selectedTool === "pen") {
        // Update the last pen annotation with new point
        setAnnotations((prev) => {
          const updated = [...prev];
          const lastAnnotation = updated[updated.length - 1];
          if (lastAnnotation && lastAnnotation.type === "pen") {
            lastAnnotation.points.push({ x, y });
          }
          return updated;
        });
        setLastPosition({ x, y });
      } else if (selectedTool === "highlighter") {
        // Update the last highlighter annotation with new point
        setAnnotations((prev) => {
          const updated = [...prev];
          const lastAnnotation = updated[updated.length - 1];
          if (lastAnnotation && lastAnnotation.type === "highlighter") {
            lastAnnotation.points.push({ x, y });
          }
          return updated;
        });
        setLastPosition({ x, y });
      } else if (selectedTool === "blur" && selectedBlurMode === "spot") {
        // Update the last blur annotation with new point
        setAnnotations((prev) => {
          const updated = [...prev];
          const lastAnnotation = updated[updated.length - 1];
          if (lastAnnotation && lastAnnotation.type === "blur") {
            lastAnnotation.points?.push({ x, y });
          }
          return updated;
        });
        setLastPosition({ x, y });
      } else if (
        selectedTool === "arrow" &&
        isDrawing &&
        relativeStartPosRef.current
      ) {
        // Show real-time preview of arrow being drawn
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Clear and redraw all annotations first
          if (isImageLoaded && capturedDataUrl && imageElementRef.current) {
            const img = imageElementRef.current;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(-scrollOffset.x, -scrollOffset.y);
            ctx.drawImage(img, 0, 0);

            // Draw existing annotations (simplified)
            annotations.forEach((annotation) => {
              if (annotation.type === "pen") {
                if (annotation.points.length < 2) return;
                ctx.beginPath();
                ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
                for (let i = 1; i < annotation.points.length; i++) {
                  ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
                }
                ctx.strokeStyle = annotation.color;
                ctx.lineWidth = annotation.width;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.stroke();
              } else if (annotation.type === "highlighter") {
                if (annotation.points.length < 2) return;
                ctx.save();
                const hexToRgba = (hex: string, alpha: number): string => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                ctx.strokeStyle = hexToRgba(annotation.color, 0.4);
                ctx.lineWidth = annotation.width;
                ctx.lineCap = "butt";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
                for (let i = 1; i < annotation.points.length; i++) {
                  ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
                }
                ctx.stroke();
                ctx.restore();
              } else if (annotation.type === "rectangle") {
                ctx.strokeStyle = annotation.color;
                ctx.lineWidth = annotation.lineWidth;
                ctx.strokeRect(
                  annotation.x,
                  annotation.y,
                  annotation.width,
                  annotation.height
                );
              } else if (annotation.type === "ellipse") {
                ctx.strokeStyle = annotation.color;
                ctx.lineWidth = annotation.lineWidth;
                ctx.beginPath();
                ctx.ellipse(
                  annotation.cx,
                  annotation.cy,
                  annotation.rx,
                  annotation.ry,
                  0,
                  0,
                  2 * Math.PI
                );
                ctx.stroke();
              } else if (annotation.type === "arrow") {
                ctx.strokeStyle = annotation.color;
                ctx.fillStyle = annotation.color;
                ctx.lineWidth = annotation.width;
                const headlen = 8 + annotation.width * 2;
                const dx = annotation.endX - annotation.startX;
                const dy = annotation.endY - annotation.startY;
                const angle = Math.atan2(dy, dx);
                ctx.beginPath();
                ctx.moveTo(annotation.startX, annotation.startY);
                ctx.lineTo(annotation.endX, annotation.endY);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(annotation.endX, annotation.endY);
                ctx.lineTo(
                  annotation.endX - headlen * Math.cos(angle - Math.PI / 6),
                  annotation.endY - headlen * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                  annotation.endX - headlen * Math.cos(angle + Math.PI / 6),
                  annotation.endY - headlen * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fill();
              }
              // Add other annotation types as needed
            });

            // Draw preview arrow
            ctx.strokeStyle = penColor;
            ctx.fillStyle = penColor;
            ctx.lineWidth = penWidth;
            const headlen = 8 + penWidth * 2;
            const dx = x - relativeStartPosRef.current.x;
            const dy = y - relativeStartPosRef.current.y;
            const angle = Math.atan2(dy, dx);
            ctx.beginPath();
            ctx.moveTo(
              relativeStartPosRef.current.x,
              relativeStartPosRef.current.y
            );
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(
              x - headlen * Math.cos(angle - Math.PI / 6),
              y - headlen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              x - headlen * Math.cos(angle + Math.PI / 6),
              y - headlen * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();

            ctx.restore();
          }
        }
      } else if (
        selectedTool === "rectangle" &&
        isDrawing &&
        relativeStartPosRef.current
      ) {
        // Show real-time preview of rectangle being drawn
        const ctx = canvas.getContext("2d");
        if (
          ctx &&
          isImageLoaded &&
          capturedDataUrl &&
          imageElementRef.current
        ) {
          const img = imageElementRef.current;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate(-scrollOffset.x, -scrollOffset.y);
          ctx.drawImage(img, 0, 0);

          // Draw existing annotations (simplified)
          annotations.forEach((annotation) => {
            if (annotation.type === "pen") {
              if (annotation.points.length < 2) return;
              ctx.beginPath();
              ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
              for (let i = 1; i < annotation.points.length; i++) {
                ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
              }
              ctx.strokeStyle = annotation.color;
              ctx.lineWidth = annotation.width;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              ctx.stroke();
            } else if (annotation.type === "highlighter") {
              if (annotation.points.length < 2) return;
              ctx.save();
              const hexToRgba = (hex: string, alpha: number): string => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
              };
              ctx.strokeStyle = hexToRgba(annotation.color, 0.4);
              ctx.lineWidth = annotation.width;
              ctx.lineCap = "butt";
              ctx.lineJoin = "round";
              ctx.beginPath();
              ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
              for (let i = 1; i < annotation.points.length; i++) {
                ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
              }
              ctx.stroke();
              ctx.restore();
            } else if (annotation.type === "rectangle") {
              ctx.strokeStyle = annotation.color;
              ctx.lineWidth = annotation.lineWidth;
              ctx.strokeRect(
                annotation.x,
                annotation.y,
                annotation.width,
                annotation.height
              );
            } else if (annotation.type === "ellipse") {
              ctx.strokeStyle = annotation.color;
              ctx.lineWidth = annotation.lineWidth;
              ctx.beginPath();
              ctx.ellipse(
                annotation.cx,
                annotation.cy,
                annotation.rx,
                annotation.ry,
                0,
                0,
                2 * Math.PI
              );
              ctx.stroke();
            } else if (annotation.type === "arrow") {
              ctx.strokeStyle = annotation.color;
              ctx.fillStyle = annotation.color;
              ctx.lineWidth = annotation.width;
              const headlen = 8 + annotation.width * 2;
              const dx = annotation.endX - annotation.startX;
              const dy = annotation.endY - annotation.startY;
              const angle = Math.atan2(dy, dx);
              ctx.beginPath();
              ctx.moveTo(annotation.startX, annotation.startY);
              ctx.lineTo(annotation.endX, annotation.endY);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(annotation.endX, annotation.endY);
              ctx.lineTo(
                annotation.endX - headlen * Math.cos(angle - Math.PI / 6),
                annotation.endY - headlen * Math.sin(angle - Math.PI / 6)
              );
              ctx.lineTo(
                annotation.endX - headlen * Math.cos(angle + Math.PI / 6),
                annotation.endY - headlen * Math.sin(angle + Math.PI / 6)
              );
              ctx.closePath();
              ctx.fill();
            }
            // Add other annotation types as needed
          });

          // Draw preview rectangle
          const startPos = relativeStartPosRef.current;
          const rectX = Math.min(startPos.x, x);
          const rectY = Math.min(startPos.y, y);
          const rectWidth = Math.abs(x - startPos.x);
          const rectHeight = Math.abs(y - startPos.y);

          ctx.strokeStyle = penColor;
          ctx.lineWidth = penWidth;
          ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
          ctx.restore();
        }
      } else if (
        selectedTool === "ellipse" &&
        isDrawing &&
        relativeStartPosRef.current
      ) {
        // Show real-time preview of ellipse being drawn
        const ctx = canvas.getContext("2d");
        if (
          ctx &&
          isImageLoaded &&
          capturedDataUrl &&
          imageElementRef.current
        ) {
          const img = imageElementRef.current;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate(-scrollOffset.x, -scrollOffset.y);
          ctx.drawImage(img, 0, 0);

          // Draw existing annotations (simplified)
          annotations.forEach((annotation) => {
            if (annotation.type === "pen") {
              if (annotation.points.length < 2) return;
              ctx.beginPath();
              ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
              for (let i = 1; i < annotation.points.length; i++) {
                ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
              }
              ctx.strokeStyle = annotation.color;
              ctx.lineWidth = annotation.width;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              ctx.stroke();
            } else if (annotation.type === "highlighter") {
              if (annotation.points.length < 2) return;
              ctx.save();
              const hexToRgba = (hex: string, alpha: number): string => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
              };
              ctx.strokeStyle = hexToRgba(annotation.color, 0.4);
              ctx.lineWidth = annotation.width;
              ctx.lineCap = "butt";
              ctx.lineJoin = "round";
              ctx.beginPath();
              ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
              for (let i = 1; i < annotation.points.length; i++) {
                ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
              }
              ctx.stroke();
              ctx.restore();
            } else if (annotation.type === "rectangle") {
              ctx.strokeStyle = annotation.color;
              ctx.lineWidth = annotation.lineWidth;
              ctx.strokeRect(
                annotation.x,
                annotation.y,
                annotation.width,
                annotation.height
              );
            } else if (annotation.type === "ellipse") {
              ctx.strokeStyle = annotation.color;
              ctx.lineWidth = annotation.lineWidth;
              ctx.beginPath();
              ctx.ellipse(
                annotation.cx,
                annotation.cy,
                annotation.rx,
                annotation.ry,
                0,
                0,
                2 * Math.PI
              );
              ctx.stroke();
            } else if (annotation.type === "arrow") {
              ctx.strokeStyle = annotation.color;
              ctx.fillStyle = annotation.color;
              ctx.lineWidth = annotation.width;
              const headlen = 8 + annotation.width * 2;
              const dx = annotation.endX - annotation.startX;
              const dy = annotation.endY - annotation.startY;
              const angle = Math.atan2(dy, dx);
              ctx.beginPath();
              ctx.moveTo(annotation.startX, annotation.startY);
              ctx.lineTo(annotation.endX, annotation.endY);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(annotation.endX, annotation.endY);
              ctx.lineTo(
                annotation.endX - headlen * Math.cos(angle - Math.PI / 6),
                annotation.endY - headlen * Math.sin(angle - Math.PI / 6)
              );
              ctx.lineTo(
                annotation.endX - headlen * Math.cos(angle + Math.PI / 6),
                annotation.endY - headlen * Math.sin(angle + Math.PI / 6)
              );
              ctx.closePath();
              ctx.fill();
            }
            // Add other annotation types as needed
          });

          // Draw preview ellipse
          const startPos = relativeStartPosRef.current;
          const centerX = (startPos.x + x) / 2;
          const centerY = (startPos.y + y) / 2;
          const radiusX = Math.abs(x - startPos.x) / 2;
          const radiusY = Math.abs(y - startPos.y) / 2;

          ctx.strokeStyle = penColor;
          ctx.lineWidth = penWidth;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.restore();
        }
      } else if (
        selectedTool === "text" &&
        isDrawing &&
        relativeStartPosRef.current
      ) {
        // 🎯 CLEAN TEXT PREVIEW - No overlapping with other tools
        const ctx = canvas.getContext("2d");
        if (
          ctx &&
          isImageLoaded &&
          capturedDataUrl &&
          imageElementRef.current
        ) {
          const img = imageElementRef.current;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate(-scrollOffset.x, -scrollOffset.y);
          ctx.drawImage(img, 0, 0);

          // Redraw existing annotations (all types)
          annotations.forEach((annotation) => {
            if (annotation.type === "text") {
              drawTextObject(ctx, annotation, false);
            } else if (annotation.type === "pen") {
              if (annotation.points.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
                for (let i = 1; i < annotation.points.length; i++) {
                  ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
                }
                ctx.strokeStyle = annotation.color;
                ctx.lineWidth = annotation.width;
                ctx.stroke();
              }
            }
            // Add other annotation types as needed
          });

          // SINGLE text preview box - no duplicates
          const startPos = relativeStartPosRef.current;
          const rectX = Math.min(startPos.x, x);
          const rectY = Math.min(startPos.y, y);
          const rectWidth = Math.abs(x - startPos.x);
          const rectHeight = Math.abs(y - startPos.y);

          if (rectWidth > 5 && rectHeight > 5) {
            ctx.strokeStyle = "#007ACC"; // Blue color for text box
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
            ctx.setLineDash([]);

            // Add "Text" label inside the box
            ctx.fillStyle = "#007ACC";
            ctx.font = "12px sans-serif";
            ctx.fillText("Text", rectX + 5, rectY + 15);
          }

          ctx.restore();
        }
      } else if (
        selectedTool === "blur" &&
        selectedBlurMode === "focus" &&
        isDrawing &&
        relativeStartPosRef.current
      ) {
        // Show real-time preview of focus area being drawn
        const ctx = canvas.getContext("2d");
        if (
          ctx &&
          isImageLoaded &&
          capturedDataUrl &&
          imageElementRef.current
        ) {
          const img = imageElementRef.current;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate(-scrollOffset.x, -scrollOffset.y);
          ctx.drawImage(img, 0, 0);

          // Draw existing annotations (simplified)
          annotations.forEach((annotation) => {
            if (annotation.type === "pen") {
              if (annotation.points.length < 2) return;
              ctx.beginPath();
              ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
              for (let i = 1; i < annotation.points.length; i++) {
                ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
              }
              ctx.strokeStyle = annotation.color;
              ctx.lineWidth = annotation.width;
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              ctx.stroke();
            } else if (annotation.type === "highlighter") {
              if (annotation.points.length < 2) return;
              ctx.save();
              const hexToRgba = (hex: string, alpha: number): string => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
              };
              ctx.strokeStyle = hexToRgba(annotation.color, 0.4);
              ctx.lineWidth = annotation.width;
              ctx.lineCap = "butt";
              ctx.lineJoin = "round";
              ctx.beginPath();
              ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
              for (let i = 1; i < annotation.points.length; i++) {
                ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
              }
              ctx.stroke();
              ctx.restore();
            } else if (annotation.type === "rectangle") {
              ctx.strokeStyle = annotation.color;
              ctx.lineWidth = annotation.lineWidth;
              ctx.strokeRect(
                annotation.x,
                annotation.y,
                annotation.width,
                annotation.height
              );
            } else if (annotation.type === "ellipse") {
              ctx.strokeStyle = annotation.color;
              ctx.lineWidth = annotation.lineWidth;
              ctx.beginPath();
              ctx.ellipse(
                annotation.cx,
                annotation.cy,
                annotation.rx,
                annotation.ry,
                0,
                0,
                2 * Math.PI
              );
              ctx.stroke();
            } else if (annotation.type === "arrow") {
              ctx.strokeStyle = annotation.color;
              ctx.fillStyle = annotation.color;
              ctx.lineWidth = annotation.width;
              const headlen = 8 + annotation.width * 2;
              const dx = annotation.endX - annotation.startX;
              const dy = annotation.endY - annotation.startY;
              const angle = Math.atan2(dy, dx);
              ctx.beginPath();
              ctx.moveTo(annotation.startX, annotation.startY);
              ctx.lineTo(annotation.endX, annotation.endY);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(annotation.endX, annotation.endY);
              ctx.lineTo(
                annotation.endX - headlen * Math.cos(angle - Math.PI / 6),
                annotation.endY - headlen * Math.sin(angle - Math.PI / 6)
              );
              ctx.lineTo(
                annotation.endX - headlen * Math.cos(angle + Math.PI / 6),
                annotation.endY - headlen * Math.sin(angle + Math.PI / 6)
              );
              ctx.closePath();
              ctx.fill();
            }
            // Add other annotation types as needed
          });

          // Draw preview focus rectangle
          const startPos = relativeStartPosRef.current;
          const rectX = Math.min(startPos.x, x);
          const rectY = Math.min(startPos.y, y);
          const rectWidth = Math.abs(x - startPos.x);
          const rectHeight = Math.abs(y - startPos.y);

          // Draw a bright border to show the focus area
          ctx.strokeStyle = "#00FF00"; // Bright green
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 4]);
          ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
          ctx.setLineDash([]);

          // Add a semi-transparent overlay outside the focus area to preview the blur
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.fillRect(0, 0, canvas.width, rectY); // Top
          ctx.fillRect(0, rectY, rectX, rectHeight); // Left
          ctx.fillRect(
            rectX + rectWidth,
            rectY,
            canvas.width - (rectX + rectWidth),
            rectHeight
          ); // Right
          ctx.fillRect(
            0,
            rectY + rectHeight,
            canvas.width,
            canvas.height - (rectY + rectHeight)
          ); // Bottom

          ctx.restore();
        }
      }
    },
    [
      isDrawing,
      selectedTool,
      selectedBlurMode,
      annotations,
      penColor,
      penWidth,
      textColor,
      scrollOffset,
      isImageLoaded,
      capturedDataUrl,
    ]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      if (selectedTool === "arrow" && relativeStartPosRef.current) {
        // Complete arrow drawing with user-defined start and end points
        const startPos = relativeStartPosRef.current;
        const newAnnotation: ArrowAnnotation = {
          id: `arrow_${Date.now()}`,
          type: "arrow",
          startX: startPos.x,
          startY: startPos.y,
          endX: x,
          endY: y,
          color: penColor,
          width: penWidth,
          size: selectedPenSize,
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
      } else if (selectedTool === "rectangle" && relativeStartPosRef.current) {
        // Complete rectangle drawing with user-defined bounds
        const startPos = relativeStartPosRef.current;
        const rectX = Math.min(startPos.x, x);
        const rectY = Math.min(startPos.y, y);
        const rectWidth = Math.abs(x - startPos.x);
        const rectHeight = Math.abs(y - startPos.y);

        // Only create rectangle if it has meaningful size
        if (rectWidth > 5 && rectHeight > 5) {
          const newAnnotation: RectangleAnnotation = {
            id: `rectangle_${Date.now()}`,
            type: "rectangle",
            x: rectX,
            y: rectY,
            width: rectWidth,
            height: rectHeight,
            color: penColor,
            lineWidth: penWidth,
            size: selectedPenSize,
          };
          setAnnotations((prev) => [...prev, newAnnotation]);
        }
      } else if (selectedTool === "ellipse" && relativeStartPosRef.current) {
        // Complete ellipse drawing with user-defined bounds
        const startPos = relativeStartPosRef.current;
        const centerX = (startPos.x + x) / 2;
        const centerY = (startPos.y + y) / 2;
        const radiusX = Math.abs(x - startPos.x) / 2;
        const radiusY = Math.abs(y - startPos.y) / 2;

        // Only create ellipse if it has meaningful size
        if (radiusX > 5 && radiusY > 5) {
          const newAnnotation: EllipseAnnotation = {
            id: `ellipse_${Date.now()}`,
            type: "ellipse",
            cx: centerX,
            cy: centerY,
            rx: radiusX,
            ry: radiusY,
            color: penColor,
            lineWidth: penWidth,
            size: selectedPenSize,
          };
          setAnnotations((prev) => [...prev, newAnnotation]);
        }
      } else if (selectedTool === "text" && relativeStartPosRef.current) {
        // Greenshot-style: Complete text box drawing and start typing
        const startPos = relativeStartPosRef.current;
        const rectX = Math.min(startPos.x, x);
        const rectY = Math.min(startPos.y, y);
        const rectWidth = Math.abs(x - startPos.x);
        const rectHeight = Math.abs(y - startPos.y);

        // Create text box if user drew meaningful area (like Greenshot)
        if (rectWidth > 30 && rectHeight > 20) {
          const fontSize = textSizeValues[selectedTextSize];

          const newAnnotation: TextAnnotation = {
            id: `text_${Date.now()}`,
            type: "text",
            x: rectX + 5, // Left padding
            y: rectY + fontSize + 5, // Baseline with top padding
            content: "", // Start empty for typing
            color: textColor,
            font: `${fontSize}px sans-serif`,
            size: selectedTextSize,
          };

          setAnnotations((prev) => [...prev, newAnnotation]);

          // Start editing mode immediately to reduce delay
          setSelectedAnnotationId(newAnnotation.id);
          setIsEditing(true);

          // Ensure the main window stays focused during text editing
          if (window.electronAPI && window.electronAPI.focusMainWindow) {
            window.electronAPI.focusMainWindow();
          }

          console.log(
            "Text box created and editing mode started:",
            newAnnotation
          );
        }
      } else if (
        selectedTool === "blur" &&
        selectedBlurMode === "focus" &&
        relativeStartPosRef.current
      ) {
        // Complete focus rectangle drawing
        const startPos = relativeStartPosRef.current;
        const rectX = Math.min(startPos.x, x);
        const rectY = Math.min(startPos.y, y);
        const rectWidth = Math.abs(x - startPos.x);
        const rectHeight = Math.abs(y - startPos.y);

        // Only create focus rectangle if it has meaningful size
        if (rectWidth > 10 && rectHeight > 10) {
          const newAnnotation: FocusRectangleAnnotation = {
            id: `focusRect_${Date.now()}`,
            type: "focusRect",
            x: rectX,
            y: rectY,
            width: rectWidth,
            height: rectHeight,
          };
          setAnnotations((prev) => [...prev, newAnnotation]);
        }

        setIsDrawing(false);
        setLastPosition(null);
      }

      // Always clear the start position ref to prevent stale values
      relativeStartPosRef.current = null;
      setIsDrawing(false);
    },
    [
      isDrawing,
      selectedTool,
      penColor,
      penWidth,
      selectedPenSize,
      scrollOffset,
      highlighterColor,
      textColor,
      selectedTextSize,
    ]
  );

  // --- Effect to listen for capture results from IPC ---
  useEffect(() => {
    let removeListener: (() => void) | null = null;
    let removeGenericListener: (() => void) | null = null;

    if (window.electronAPI && window.electronAPI.onCaptureData) {
      removeListener = window.electronAPI.onCaptureData((event, data) => {
        if (data && data.success && data.dataUrl) {
          handleCaptureResult(data.dataUrl, "capture");
        } else {
          setMessage(`Failed to capture: ${data?.message || "Unknown error"}`);
        }
      });
    }

    // Generic capture handler for backward compatibility
    if (window.electronAPI && window.electronAPI.on) {
      removeGenericListener = window.electronAPI.on(
        "capture-result",
        (data: any) => {
          if (data && data.dataUrl) {
            handleCaptureResult(data.dataUrl, "capture");
          } else if (data && data.error) {
            setMessage(`Capture failed: ${data.error}`);
          }
        }
      );
    }

    return () => {
      if (removeListener) removeListener();
      if (removeGenericListener) removeGenericListener();
    };
  }, [handleCaptureResult]); // Clean dependencies

  // --- Effect to update cursor based on selected tool and pen width ---
  useEffect(() => {
    // All tools now use crosshair cursor for consistency
    setDynamicCursorStyle("crosshair");
  }, [selectedTool]); // Simplified dependencies - all tools get same cursor

  // --- Effect to apply dynamic cursor to canvas container ---
  useEffect(() => {
    const canvasContainer = canvasContainerRef.current;
    if (canvasContainer) {
      canvasContainer.style.cursor = dynamicCursorStyle;
    }
    // Cleanup: Reset cursor when component unmounts or when dynamicCursorStyle changes
    // This is important if other elements outside the canvas might want to set their own cursors.
    return () => {
      if (canvasContainer) {
        // Optionally reset to a specific default or remove the inline style
        // For now, just clearing it to allow parent styles to take over if needed
        // canvasContainer.style.cursor = ""; // Or 'auto' or a specific default
      }
    };
  }, [dynamicCursorStyle]);

  // --- Debounce Handler ---
  const debouncedResizeHandler = debounce((handler: () => void) => {
    handler();
  }, 150); // Debounce resize events by 150ms

  // --- HELPER FUNCTIONS (Order is important for dependencies) ---

  // Helper function to calculate min/max bounds from points array
  const calculatePointsBounds = useCallback(
    (points: { x: number; y: number }[]) => {
      if (!points || points.length === 0) return null;
      let minX = points[0].x,
        maxX = points[0].x;
      let minY = points[0].y,
        maxY = points[0].y;
      points.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });
      return { minX, maxX, minY, maxY };
    },
    []
  );

  const isPointInsideRect = (
    point: { x: number; y: number },
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean => {
    return (
      point.x >= x &&
      point.x <= x + width &&
      point.y >= y &&
      point.y <= y + height
    );
  };

  const isPointNearLine = (
    point: { x: number; y: number },
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    threshold: number
  ): boolean => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
      // Line is a point
      return Math.hypot(point.x - x1, point.y - y1) <= threshold;
    }
    const t = ((point.x - x1) * dx + (point.y - y1) * dy) / (dx * dx + dy * dy);
    let closestX, closestY;
    if (t < 0) {
      closestX = x1;
      closestY = y1;
    } else if (t > 1) {
      closestX = x2;
      closestY = y2;
    } else {
      closestX = x1 + t * dx;
      closestY = y1 + t * dy;
    }
    return Math.hypot(point.x - closestX, point.y - closestY) <= threshold;
  };

  const isPointNearPolyline = (
    point: { x: number; y: number },
    points: { x: number; y: number }[],
    threshold: number
  ): boolean => {
    if (points.length < 2) return false;
    for (let i = 0; i < points.length - 1; i++) {
      if (
        isPointNearLine(
          point,
          points[i].x,
          points[i].y,
          points[i + 1].x,
          points[i + 1].y,
          threshold
        )
      ) {
        return true;
      }
    }
    return false;
  };

  const getRectBounds = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): { x: number; y: number; width: number; height: number } => {
    return {
      x: Math.min(p1.x, p2.x),
      y: Math.min(p1.y, p2.y),
      width: Math.abs(p1.x - p2.x),
      height: Math.abs(p1.y - p2.y),
    };
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => {
    const headlen = 8 + ctx.lineWidth * 2;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headlen * Math.cos(angle - Math.PI / 6),
      toY - headlen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headlen * Math.cos(angle + Math.PI / 6),
      toY - headlen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  };

  // Calculate relative coords from viewport coords
  const getRelativeCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      // Get bounding rect for the CONTAINER element
      const container = canvasContainerRef.current;
      if (!container) {
        console.warn("getRelativeCoords: Missing container ref");
        return null;
      }
      const rect = container.getBoundingClientRect(); // Use container's rect

      // Calculate coordinates relative to the TOP-LEFT of the VIRTUAL canvas space
      const relativeX = clientX - rect.left + scrollOffset.x;
      const relativeY = clientY - rect.top + scrollOffset.y;

      return { x: relativeX, y: relativeY };
    },
    [scrollOffset] // Dependencies are correct
  );

  // --- Effect to update blurBrushSize (for SPOT BLUR CURSOR) ---
  useEffect(() => {
    if (selectedTool === "blur" && selectedBlurMode === "spot") {
      setBlurBrushSize(penSizeValues[selectedPenSize]); // Use selected pen size instead of fixed medium
    }
  }, [selectedTool, selectedBlurMode, selectedPenSize]); // Add selectedPenSize dependency

  // Ensure getTextBounds is defined here if getAnnotationBounds uses it
  const getTextBounds = useCallback(
    (
      annotation: TextAnnotation,
      ctx: CanvasRenderingContext2D | null
    ): { x: number; y: number; width: number; height: number } => {
      if (!ctx) {
        const approxCharWidth =
          annotation.size === "s" ? 8 : annotation.size === "m" ? 10 : 14;
        const approxLineHeight =
          annotation.size === "s" ? 14 : annotation.size === "m" ? 18 : 28;
        const lines = annotation.content.split("\n");
        const maxLineWidth = Math.max(
          ...lines.map((line) => line.length * approxCharWidth)
        );
        return {
          x: annotation.x,
          y: annotation.y - approxLineHeight * 0.8,
          width: maxLineWidth,
          height: lines.length * approxLineHeight,
        };
      }
      ctx.save();
      ctx.font = annotation.font;
      const lines = annotation.content.split("\n");
      const metrics = lines.map((line) => ctx.measureText(line));
      const maxWidth = Math.max(...metrics.map((m) => m.width));
      const firstMetric = metrics[0];
      const fontHeight =
        (firstMetric.actualBoundingBoxAscent ??
          firstMetric.fontBoundingBoxAscent ??
          parseInt(ctx.font, 10)) +
        (firstMetric.actualBoundingBoxDescent ??
          firstMetric.fontBoundingBoxDescent ??
          0);
      const totalHeight = fontHeight * lines.length;
      ctx.restore();
      return {
        x: annotation.x,
        y:
          annotation.y -
          (firstMetric.actualBoundingBoxAscent ?? fontHeight * 0.8),
        width: maxWidth,
        height: totalHeight,
      };
    },
    []
  );

  // --- GET ANNOTATION BOUNDS (Ensure compatibility with FocusRectangleAnnotation and simplified BlurAnnotation) ---
  const getAnnotationBounds = useCallback(
    (
      annotation: AnnotationObject,
      ctx: CanvasRenderingContext2D | null
    ): { x: number; y: number; width: number; height: number } | null => {
      switch (annotation.type) {
        case "pen":
        case "highlighter":
          if (!annotation.points || annotation.points.length === 0) return null;
          const penBounds = calculatePointsBounds(annotation.points);
          if (!penBounds) return null;
          const width = annotation.width;
          const halfWidth = width / 2;
          return {
            x: penBounds.minX - halfWidth,
            y: penBounds.minY - halfWidth,
            width: penBounds.maxX - penBounds.minX + width,
            height: penBounds.maxY - penBounds.minY + width,
          };
        case "arrow":
          const arrowHalfWidth = annotation.width / 2;
          return {
            x: Math.min(annotation.startX, annotation.endX) - arrowHalfWidth,
            y: Math.min(annotation.startY, annotation.endY) - arrowHalfWidth,
            width:
              Math.abs(annotation.startX - annotation.endX) + annotation.width,
            height:
              Math.abs(annotation.startY - annotation.endY) + annotation.width,
          };
        case "text":
          return getTextBounds(annotation, ctx);
        case "rectangle":
          const rectHalfWidth = annotation.lineWidth / 2;
          return {
            x: annotation.x - rectHalfWidth,
            y: annotation.y - rectHalfWidth,
            width: annotation.width + annotation.lineWidth,
            height: annotation.height + annotation.lineWidth,
          };
        case "ellipse":
          const ellipseHalfWidth = annotation.lineWidth / 2;
          return {
            x: annotation.cx - annotation.rx - ellipseHalfWidth,
            y: annotation.cy - annotation.ry - ellipseHalfWidth,
            width: (annotation.rx + ellipseHalfWidth) * 2,
            height: (annotation.ry + ellipseHalfWidth) * 2,
          };
        case "step":
          return {
            x: annotation.cx - annotation.radius,
            y: annotation.cy - annotation.radius,
            width: annotation.radius * 2,
            height: annotation.radius * 2,
          };
        case "blur": // SPOT BLUR ONLY
          if (
            annotation.mode === "spot" &&
            annotation.points &&
            annotation.points.length > 0
          ) {
            const blurBounds = calculatePointsBounds(annotation.points);
            if (!blurBounds) return null;
            const spotBrushSize = annotation.brushSize ?? 10;
            const halfSpotBrush = spotBrushSize / 2;
            return {
              x: blurBounds.minX - halfSpotBrush,
              y: blurBounds.minY - halfSpotBrush,
              width: blurBounds.maxX - blurBounds.minX + spotBrushSize,
              height: blurBounds.maxY - blurBounds.minY + spotBrushSize,
            };
          }
          return null;
        case "focusRect":
          return {
            x: annotation.x,
            y: annotation.y,
            width: annotation.width,
            height: annotation.height,
          };
        default:
          return null;
      }
    },
    [calculatePointsBounds, getTextBounds]
  );

  // --- IS POINT INSIDE ANNOTATION (Update for new types) ---
  const isPointInsideAnnotation = useCallback(
    (
      point: { x: number; y: number },
      annotation: AnnotationObject,
      ctx: CanvasRenderingContext2D | null,
      threshold: number = 5
    ): boolean => {
      const effectiveThreshold = threshold;
      switch (annotation.type) {
        case "pen":
        case "highlighter":
          return isPointNearPolyline(
            point,
            annotation.points,
            Math.max(effectiveThreshold, annotation.width / 2)
          );
        case "arrow":
          return isPointNearLine(
            point,
            annotation.startX,
            annotation.startY,
            annotation.endX,
            annotation.endY,
            Math.max(effectiveThreshold, annotation.width / 2)
          );
        case "text":
          const textBounds = getTextBounds(annotation, ctx); // This call should now be valid
          if (!textBounds) return false; // Guard if getTextBounds could return null (it should not based on current def)
          return isPointInsideRect(
            point,
            textBounds.x,
            textBounds.y,
            textBounds.width,
            textBounds.height
          );
        case "rectangle":
          const { x, y, width, height, lineWidth } = annotation;
          if (
            point.x >= x &&
            point.x <= x + width &&
            point.y >= y &&
            point.y <= y + height
          )
            return true;
          const halfRectWidth = Math.max(effectiveThreshold, lineWidth / 2);
          return (
            (((point.y >= y - halfRectWidth && point.y <= y + halfRectWidth) ||
              (point.y >= y + height - halfRectWidth &&
                point.y <= y + height + halfRectWidth)) &&
              point.x >= x - halfRectWidth &&
              point.x <= x + width + halfRectWidth) ||
            (((point.x >= x - halfRectWidth && point.x <= x + halfRectWidth) ||
              (point.x >= x + width - halfRectWidth &&
                point.x <= x + width + halfRectWidth)) &&
              point.y >= y - halfRectWidth &&
              point.y <= y + height + halfRectWidth)
          );
        case "ellipse":
          const { cx, cy, rx, ry, lineWidth: ellipseLineWidth } = annotation;
          const dx = point.x - cx;
          const dy = point.y - cy;
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) return true;
          const halfEllipseWidth = Math.max(
            effectiveThreshold,
            ellipseLineWidth / 2
          );
          const innerRx = Math.max(0, rx - halfEllipseWidth);
          const innerRy = Math.max(0, ry - halfEllipseWidth);
          const outerRx = rx + halfEllipseWidth;
          const outerRy = ry + halfEllipseWidth;
          const distSqOuter =
            (dx * dx) / (outerRx * outerRx) + (dy * dy) / (outerRy * outerRy);
          const distSqInner =
            innerRx <= 0 || innerRy <= 0
              ? Infinity
              : (dx * dx) / (innerRx * innerRx) +
                (dy * dy) / (innerRy * innerRy);
          return distSqOuter <= 1 && distSqInner >= 1;
        case "step":
          const distSq =
            (point.x - annotation.cx) ** 2 + (point.y - annotation.cy) ** 2;
          return distSq <= (annotation.radius + effectiveThreshold) ** 2;
        case "blur": // SPOT BLUR ONLY
          if (annotation.mode === "spot" && annotation.points) {
            const brushSize = annotation.brushSize ?? 10;
            return isPointNearPolyline(
              point,
              annotation.points,
              Math.max(effectiveThreshold, brushSize / 2)
            );
          }
          return false;
        case "focusRect": // Hit testing for FocusRectangleAnnotation
          return isPointInsideRect(
            point,
            annotation.x,
            annotation.y,
            annotation.width,
            annotation.height
          );
        default:
          // Ensure all cases are handled or add a type assertion for exhaustive check if needed
          const _exhaustiveCheck: never = annotation; // This will error if a type isn't handled
          return false;
      }
    },
    [getTextBounds, isPointNearPolyline, isPointNearLine, isPointInsideRect]
  );

  // --- Drawing Functions (Ensure defined before use in effects/handlers) ---

  // Draws text, with placeholder and blinking cursor for editing
  const drawTextObject = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      annotation: TextAnnotation,
      isSelected?: boolean
    ) => {
      const isCurrentlyEditing =
        isEditing && selectedAnnotationId === annotation.id;

      // Simple text editing indicator - no box outline to avoid conflicts
      // Removed box outline drawing to eliminate auto-resize conflicts

      // Draw text content or placeholder
      ctx.font = annotation.font;
      if (annotation.content) {
        ctx.fillStyle = annotation.color;
        ctx.fillText(annotation.content, annotation.x, annotation.y);
      } else if (isCurrentlyEditing) {
        ctx.fillStyle = "rgba(128, 128, 128, 0.7)";
        ctx.fillText("Type here...", annotation.x, annotation.y);
      }

      // Draw blinking cursor if editing
      if (isCurrentlyEditing) {
        // Optimized cursor visibility timing to match the faster blink interval (500ms)
        const cursorVisible = Math.floor(Date.now() / 500) % 2 === 0;
        if (cursorVisible) {
          const textWidth = ctx.measureText(annotation.content || "").width;
          const cursorX = annotation.x + textWidth;
          const fontSize = parseInt(annotation.font, 10);

          ctx.strokeStyle = annotation.color;
          ctx.lineWidth = 1; // Thinner cursor line for better performance
          ctx.beginPath();
          ctx.moveTo(cursorX, annotation.y - fontSize + 5);
          ctx.lineTo(cursorX, annotation.y + 5);
          ctx.stroke();
        }
      }
    },
    [selectedAnnotationId, isEditing] // Dependencies for text editing
  );

  // Draw a complete pen annotation object (on main canvas)
  const drawPenObject = useCallback(
    (
      context: CanvasRenderingContext2D,
      annotation: PenAnnotation,
      isSelected?: boolean
    ) => {
      const isEditing = false; // Removed selection functionality

      // Simple text editing indicator - no box outline to avoid conflicts
      if (isEditing) {
        console.log(
          "Text editing mode - skipping pen drawing to avoid conflicts"
        );
        return;
      }

      if (annotation.points.length < 2) return;

      context.save();
      context.strokeStyle = annotation.color;
      context.lineWidth = annotation.width;
      context.lineCap = "round";
      context.lineJoin = "round";

      context.beginPath();
      context.moveTo(annotation.points[0].x, annotation.points[0].y);
      for (let i = 1; i < annotation.points.length; i++) {
        context.lineTo(annotation.points[i].x, annotation.points[i].y);
      }
      context.stroke();
      context.restore();
    },
    [] // No dependencies - removed selection
  );

  // Draw arrow annotation object
  const drawArrowObject = useCallback(
    (ctx: CanvasRenderingContext2D, annotation: ArrowAnnotation) => {
      ctx.strokeStyle = annotation.color;
      ctx.lineWidth = annotation.width;
      ctx.fillStyle = annotation.color;
      drawArrow(
        ctx,
        annotation.startX,
        annotation.startY,
        annotation.endX,
        annotation.endY
      );
    },
    [drawArrow]
  );

  // --- NEW: Memoized Blurred Image Canvas --- //
  // Store the blurred version of the original image to avoid re-blurring on every redraw
  const blurredImageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastUsedBlurStrengthForCachedImage = useRef<number | null>(null); // Track blur strength for cache invalidation

  // Effect to generate the blurred canvas AFTER the original image is loaded or blurStrength changes
  useEffect(() => {
    if (
      originalCapturedDataUrl &&
      isImageLoaded &&
      imageElementRef.current &&
      appSettings
    ) {
      const img = imageElementRef.current;
      const currentBlurStrength = blurStrength; // Use blurStrength state directly

      // Regenerate if blurred image doesn't exist or if blur strength changed
      if (
        !blurredImageCanvasRef.current ||
        lastUsedBlurStrengthForCachedImage.current !== currentBlurStrength
      ) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.naturalWidth;
        tempCanvas.height = img.naturalHeight;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.filter = `blur(${currentBlurStrength}px)`;
          tempCtx.drawImage(img, 0, 0);
          tempCtx.filter = "none";
          blurredImageCanvasRef.current = tempCanvas;
          lastUsedBlurStrengthForCachedImage.current = currentBlurStrength;
        } else {
          console.error("Failed to get 2D context for blurred canvas.");
          blurredImageCanvasRef.current = null;
          lastUsedBlurStrengthForCachedImage.current = null;
        }
      }
    } else {
      blurredImageCanvasRef.current = null;
      lastUsedBlurStrengthForCachedImage.current = null;
    }
  }, [originalCapturedDataUrl, isImageLoaded, appSettings, blurStrength]); // Depend on blurStrength state

  // --- REVISED applyFocusAreaBlur --- //
  // This function now ONLY draws the effect onto the ALREADY TRANSFORMED main context (`ctx`)
  // using a pre-blurred image canvas.
  const applyFocusAreaBlur = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      area: { x: number; y: number; width: number; height: number },
      blurredImageCanvas: HTMLCanvasElement | null,
      img: HTMLImageElement
    ) => {
      if (!blurredImageCanvas || !img) {
        console.warn(
          "Blurred image canvas or original image is not available."
        );
        return;
      }

      try {
        // Step 1: Draw the pre-blurred image onto the main context.
        ctx.drawImage(
          blurredImageCanvas,
          0,
          0,
          blurredImageCanvas.width,
          blurredImageCanvas.height,
          0,
          0,
          blurredImageCanvas.width,
          blurredImageCanvas.height
        );

        // Step 2: Clip to the focus area and draw the original image inside.
        ctx.save();
        ctx.beginPath();
        ctx.rect(area.x, area.y, area.width, area.height);
        ctx.clip();

        // Draw the *original* image, respecting the current transform and clip
        ctx.drawImage(img, 0, 0);
        ctx.restore();

        // Step 3: Draw a border around the focus area.
        ctx.strokeStyle = "rgba(0, 255, 0, 0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(area.x, area.y, area.width, area.height);
      } catch (e) {
        console.error("Error applying focus area blur:", e);
      }
    },
    []
  );
  // --- End REVISED --- //

  // After applyFocusAreaBlur, add a new function for applying spot blur without clearing canvas
  const applySpotBlur = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      points: { x: number; y: number }[],
      brushSize: number,
      img: HTMLImageElement
    ) => {
      if (!points || points.length === 0) return;

      try {
        // Create a canvas for the blur result
        const blurCanvas = document.createElement("canvas");
        blurCanvas.width = canvas.width;
        blurCanvas.height = canvas.height;
        const blurCtx = blurCanvas.getContext("2d");
        if (!blurCtx) return;

        // Apply same transform as main context
        blurCtx.translate(-scrollOffset.x, -scrollOffset.y);

        // Apply blur effect to the entire image
        blurCtx.filter = "blur(10px)";
        blurCtx.drawImage(img, 0, 0);
        blurCtx.filter = "none";

        // Reset transform for drawing to the main context
        blurCtx.resetTransform();

        // For each point, create a clipping path and draw from the blur canvas
        points.forEach((point: { x: number; y: number }) => {
          ctx.save();

          // Create clipping path for this point - adjust radius for zoom
          ctx.beginPath();
          const scaledRadius = brushSize;
          ctx.arc(point.x, point.y, scaledRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          // Save current transform
          const currentTransform = ctx.getTransform();
          // Reset transform temporarily to draw from the blur canvas
          ctx.resetTransform();
          // Draw the blurred version in the clipped area
          ctx.drawImage(blurCanvas, 0, 0);
          // Restore the previous transform
          ctx.setTransform(currentTransform);

          // Restore context
          ctx.restore();
        });
      } catch (e) {
        console.error("Error applying spot blur:", e);
      }
    },
    [scrollOffset]
  );

  // Draw blur object (Revised)
  const drawBlurObject = useCallback(
    (ctx: CanvasRenderingContext2D, annotation: BlurAnnotation) => {
      if (
        !canvasRef.current ||
        !imageElementRef.current ||
        annotation.mode !== "spot"
      ) {
        return;
      }
      const canvas = canvasRef.current;
      const img = imageElementRef.current;
      if (annotation.points && annotation.points.length > 0) {
        applySpotBlur(
          ctx,
          canvas,
          annotation.points,
          annotation.brushSize || 10,
          img
        );
      }
    },
    [applySpotBlur]
  );

  // Draw Highlighter object
  const drawHighlighterObject = useCallback(
    (ctx: CanvasRenderingContext2D, annotation: HighlighterAnnotation) => {
      if (annotation.points.length < 2) return;

      ctx.save();
      const hexToRgba = (hex: string, alpha: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      const highlighterAlpha = 0.4;
      ctx.strokeStyle = hexToRgba(annotation.color, highlighterAlpha);
      ctx.lineWidth = annotation.width;
      ctx.lineCap = "butt";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
      for (let i = 1; i < annotation.points.length; i++) {
        ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    },
    []
  );

  // Draw Rectangle object
  const drawRectangleObject = useCallback(
    (ctx: CanvasRenderingContext2D, annotation: RectangleAnnotation) => {
      ctx.strokeStyle = annotation.color;
      ctx.lineWidth = annotation.lineWidth;
      ctx.strokeRect(
        annotation.x,
        annotation.y,
        annotation.width,
        annotation.height
      );
    },
    []
  );

  // Draw Ellipse object
  const drawEllipseObject = useCallback(
    (ctx: CanvasRenderingContext2D, annotation: EllipseAnnotation) => {
      ctx.strokeStyle = annotation.color;
      ctx.lineWidth = annotation.lineWidth;
      ctx.beginPath();
      ctx.ellipse(
        annotation.cx,
        annotation.cy,
        annotation.rx,
        annotation.ry,
        0, // rotation
        0, // startAngle
        2 * Math.PI // endAngle
      );
      ctx.stroke();
    },
    []
  );

  // Draw Step object
  const drawStepObject = useCallback(
    (ctx: CanvasRenderingContext2D, annotation: StepAnnotation) => {
      // Draw Circle
      ctx.fillStyle = annotation.color;
      ctx.beginPath();
      ctx.arc(annotation.cx, annotation.cy, annotation.radius, 0, 2 * Math.PI);
      ctx.fill();

      // Draw Number
      ctx.fillStyle = "#FFFFFF"; // White text usually contrasts well
      ctx.font = `${annotation.fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(annotation.number.toString(), annotation.cx, annotation.cy);
    },
    []
  );

  // --- Main Redraw Function (REVISED FOR NEW FOCUS LOGIC) ---
  const redrawCanvas = useCallback(
    (annotationsToDraw: AnnotationObject[], includeImage = true) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      const imgElement = imageElementRef.current;

      if (!canvas || !context || !isImageLoaded) {
        return;
      }

      context.save();
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.translate(-scrollOffset.x, -scrollOffset.y);
      // context.scale(zoomLevel, zoomLevel); // Zoom is fixed at 1.0

      const focusRects = annotationsToDraw.filter(
        (a): a is FocusRectangleAnnotation => a.type === "focusRect"
      );

      if (includeImage && imgElement) {
        if (focusRects.length > 0 && blurredImageCanvasRef.current) {
          context.drawImage(blurredImageCanvasRef.current, 0, 0); // Draw fully blurred

          context.save(); // Save before clipping to focus areas
          focusRects.forEach((rect, index) => {
            if (index === 0) context.beginPath();
            context.rect(rect.x, rect.y, rect.width, rect.height);
          });
          if (focusRects.length > 0) context.clip();

          context.drawImage(imgElement, 0, 0); // Draw original in clipped areas
          context.restore(); // Restore from clipping
        } else {
          context.drawImage(imgElement, 0, 0); // Draw original image normally
        }
      }

      // --- Filter and Draw Annotations ---
      const annotationsToRenderStep1 = annotationsToDraw.filter((ann) => {
        if (ann.type === "focusRect") return false; // Don't draw focus rects themselves
        if (ann.type === "blur" && ann.mode !== "spot") return false; // Only spot blurs if it's a BlurAnnotation

        if (focusRects.length > 0) {
          const annBounds = getAnnotationBounds(ann, context);
          if (!annBounds) return false;

          return focusRects.some(
            (focusRect) =>
              annBounds.x >= focusRect.x &&
              annBounds.x + annBounds.width <= focusRect.x + focusRect.width &&
              annBounds.y >= focusRect.y &&
              annBounds.y + annBounds.height <= focusRect.y + focusRect.height
          );
        }
        return true; // No focus rects, draw all other (non-focusRect, non-non-spot-blur) annotations
      });

      // Separate spot blurs to draw them last
      const spotBlurAnnotations = annotationsToRenderStep1.filter(
        (a): a is BlurAnnotation => a.type === "blur" && a.mode === "spot"
      );
      const otherAnnotationsToRender = annotationsToRenderStep1.filter(
        (a) => !(a.type === "blur" && a.mode === "spot")
      );

      // Draw non-blur annotations first
      otherAnnotationsToRender.forEach((annotation) => {
        switch (annotation.type) {
          case "pen":
            drawPenObject(context, annotation);
            break;
          case "text":
            const isSelected = selectedAnnotationId === annotation.id;
            drawTextObject(context, annotation, isSelected);
            break;
          case "arrow":
            drawArrowObject(context, annotation);
            break;
          case "highlighter":
            drawHighlighterObject(context, annotation);
            break;
          case "rectangle":
            drawRectangleObject(context, annotation);
            break;
          case "ellipse":
            drawEllipseObject(context, annotation);
            break;
          case "step":
            drawStepObject(context, annotation);
            break;
          // focusRects and other blur modes already filtered out
        }
      });

      // Then draw spot blurs on top
      spotBlurAnnotations.forEach((annotation) => {
        drawBlurObject(context, annotation); // drawBlurObject now only handles spot
      });

      // Draw selection highlight (if any selected annotation is visible)
      // BUT NOT for text annotations in editing mode - they handle their own visual feedback
      const selectedAnnotation =
        otherAnnotationsToRender.find(
          // Check amongst non-blur annotations
          (a) => a.id === selectedAnnotationId
        ) ||
        spotBlurAnnotations.find(
          // Or amongst spot blur annotations
          (a) => a.id === selectedAnnotationId
        );

      if (selectedAnnotation && selectedAnnotation.type !== "text") {
        // Skip selection highlight for text annotations to avoid conflicting with text editing
        const bounds = getAnnotationBounds(selectedAnnotation, context);
        if (bounds) {
          context.strokeStyle = "rgba(0, 100, 255, 0.7)";
          context.lineWidth = 2;
          context.setLineDash([4, 4]);
          context.strokeRect(
            bounds.x - 3,
            bounds.y - 3,
            bounds.width + 6,
            bounds.height + 6
          );
          context.setLineDash([]);
        }
      }
      context.restore(); // Restore from translate/scale
    },
    [
      isImageLoaded,
      selectedAnnotationId,
      scrollOffset,
      blurStrength,
      drawPenObject,
      drawTextObject,
      drawArrowObject,
      drawHighlighterObject,
      drawRectangleObject,
      drawEllipseObject,
      drawStepObject,
      drawBlurObject,
      getAnnotationBounds, // Ensure this is compatible with new types
    ]
  );

  // --- Effect to redraw canvas when annotations change (added after redrawCanvas is defined) ---
  useEffect(() => {
    if (
      isImageLoaded &&
      capturedDataUrl &&
      canvasRef.current &&
      imageElementRef.current
    ) {
      redrawCanvas(annotations);
    }
  }, [annotations, isImageLoaded, capturedDataUrl]); // Removed redrawCanvas from dependencies

  // --- Selection Logic Implementation --- (After helper functions are defined)
  const handleSelectToolClick = useCallback(
    (point: { x: number; y: number }) => {
      if (selectedTool !== "select" || !canvasRef.current) return false;

      const ctx = canvasRef.current.getContext("2d");
      const clickedAnnotation = annotations
        .slice()
        .reverse()
        .filter((ann) => ann.type !== "focusRect")
        .find((ann) => isPointInsideAnnotation(point, ann, ctx));

      if (clickedAnnotation) {
        setSelectedAnnotationId(clickedAnnotation.id);
        setIsDraggingAnnotation(true);
        // Calculate offset for dragging
        const bounds = getAnnotationBounds(clickedAnnotation, ctx);
        if (bounds) {
          setDragStartOffset({
            x: point.x - bounds.x,
            y: point.y - bounds.y,
          });
        }
        return true;
      } else {
        setSelectedAnnotationId(null);
        return false;
      }
    },
    [
      selectedTool,
      annotations,
      isPointInsideAnnotation,
      getAnnotationBounds,
      setIsDraggingAnnotation,
      setSelectedAnnotationId,
      setDragStartOffset,
    ]
  );

  // --- Effect to load settings initially
  useEffect(() => {
    const loadInitialSettings = async () => {
      if (window.electronAPI && window.electronAPI.getSettings) {
        try {
          const fetchedSettings = await window.electronAPI.getSettings();
          setAppSettings(fetchedSettings);
          // Apply fetched settings to relevant states
          setPenColor(fetchedSettings.defaultPenColor);
          setSelectedPenSize(fetchedSettings.defaultPenSize);
          setSelectedTool(fetchedSettings.defaultTool); // Apply default tool
          setTextColor(fetchedSettings.defaultTextColor);
          setSelectedTextSize(fetchedSettings.defaultTextSize);
          // FORCE RED: Always set highlighter to red regardless of saved settings
          console.log(
            "Loaded highlighter color from settings:",
            fetchedSettings.defaultHighlighterColor
          );
          setHighlighterColor("#FF0000");
          console.log("Forced highlighter color to:", "#FF0000");
          setSelectedHighlighterSize(fetchedSettings.defaultHighlighterSize);
          setStepColor(fetchedSettings.defaultStepColor);
          setSelectedStepSize(fetchedSettings.defaultStepSize);
          setBlurStrength(fetchedSettings.defaultBlurStrength);
          setSelectedBlurMode(fetchedSettings.defaultBlurMode);
          setMessage("Settings loaded.");
        } catch (error) {
          console.error("Failed to load settings:", error);
          setMessage("Failed to load settings. Using defaults.");
          // Consider setting appSettings to default values here if desired
        }
      }
    };
    loadInitialSettings();
  }, []);

  const handleResetSettings = async () => {
    if (window.electronAPI && window.electronAPI.resetSettings) {
      try {
        const resetSettings = await window.electronAPI.resetSettings();
        setAppSettings(resetSettings);
        // Apply reset settings to relevant states
        setPenColor(resetSettings.defaultPenColor);
        setSelectedPenSize(resetSettings.defaultPenSize);
        setSelectedTool(resetSettings.defaultTool); // Apply default tool
        setTextColor(resetSettings.defaultTextColor);
        setSelectedTextSize(resetSettings.defaultTextSize);
        // FORCE RED: Always set highlighter to red regardless of reset settings
        setHighlighterColor("#FF0000");
        setSelectedHighlighterSize(resetSettings.defaultHighlighterSize);
        setStepColor(resetSettings.defaultStepColor);
        setSelectedStepSize(resetSettings.defaultStepSize);
        setBlurStrength(resetSettings.defaultBlurStrength);
        setSelectedBlurMode(resetSettings.defaultBlurMode);
        console.log("Settings reset and applied.");
      } catch (error) {
        console.error("Failed to reset settings:", error);
      }
    }
  };

  // Update pen width based on size
  useEffect(() => {
    setPenWidth(penSizeValues[selectedPenSize]);
  }, [selectedPenSize]);

  // Update highlighter width based on size
  useEffect(() => {
    setHighlighterWidth(highlighterSizeValues[selectedHighlighterSize]);
  }, [selectedHighlighterSize]);

  // --- Effect for keyboard handling (text editing) ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      console.log(
        "Key pressed:",
        event.key,
        "selectedTool:",
        selectedTool,
        "selectedAnnotationId:",
        selectedAnnotationId
      );

      if (
        isEditing &&
        selectedAnnotationId &&
        annotations.some(
          (ann) => ann.id === selectedAnnotationId && ann.type === "text"
        )
      ) {
        console.log("Text editing mode active - processing key:", event.key);
        event.preventDefault();

        if (event.key === "Backspace") {
          setAnnotations((prev) =>
            prev.map((ann) =>
              ann.id === selectedAnnotationId && ann.type === "text"
                ? { ...ann, content: ann.content.slice(0, -1) }
                : ann
            )
          );
        } else if (event.key === "Enter" || event.key === "Escape") {
          console.log("Enter/Escape pressed - finishing text editing");

          // Immediately prevent any other handlers from processing this event
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          // Update state immediately without delay
          setIsEditing(false);
          setSelectedAnnotationId(null);

          // Force immediate redraw to clear cursor
          if (canvasRef.current) {
            redrawCanvas(annotations);
          }

          return false; // Additional prevention of event bubbling
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          setAnnotations((prev) =>
            prev.map((ann) =>
              ann.id === selectedAnnotationId && ann.type === "text"
                ? { ...ann, content: ann.content + event.key }
                : ann
            )
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedAnnotationId, isEditing, annotations]);

  // --- OPTIMIZED cursor blinking for text ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // Only blink if text is being edited
    if (selectedAnnotationId && isEditing) {
      intervalId = setInterval(() => {
        // Only redraw if we're still actively editing and have focus
        if (
          isEditing &&
          selectedAnnotationId &&
          canvasRef.current &&
          document.hasFocus()
        ) {
          // Force a simple redraw without changing state
          redrawCanvas(annotations);
        }
      }, 500); // Faster blinking but more efficient
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [selectedAnnotationId, isEditing, annotations, redrawCanvas]); // Remove annotations from dependencies

  return (
    <div className="App">
      {/* Message and SettingsModal can stay for basic UI feedback */}
      {message && <p>{message}</p>}
      {isSettingsModalOpen && (
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={appSettings}
          onSave={async (partialNewSettings) => {
            setAppSettings((prevSettings: AppSettings | null) => {
              if (!prevSettings) {
                console.warn(
                  "Previous settings were null. Applying partial settings. Ensure all defaults are handled if this is an initial setup."
                );
                return { ...(partialNewSettings as AppSettings) };
              }
              return { ...prevSettings, ...partialNewSettings };
            });

            console.log(
              "Partial settings to save to backend:",
              partialNewSettings
            );
            await window.electronAPI.saveSettings(partialNewSettings);
          }}
          onReset={async () => {
            try {
              await window.electronAPI.resetSettings();
              const defaultSettings = await window.electronAPI.getSettings();
              setAppSettings(defaultSettings);
              console.log("Settings reset to default:", defaultSettings);
            } catch (error) {
              console.error("Failed to reset settings:", error);
            }
          }}
        />
      )}

      {/* Fixed positioned toolbar container */}
      <div
        style={{
          position: "fixed",
          top: "0",
          left: "0",
          right: "0",
          zIndex: 1000,
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #ddd",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <Toolbar
          selectedTool={selectedTool}
          onToolSelect={setSelectedTool}
          penColor={penColor}
          onPenColorChange={setPenColor}
          selectedPenSize={selectedPenSize}
          onPenSizeSelect={setSelectedPenSize}
          onUndo={() => {
            if (history.length > 0) {
              const previousAnnotations = history[history.length - 1];
              setAnnotations(previousAnnotations);
              setHistory(history.slice(0, -1));
            }
          }}
          onClear={() => {
            setHistory([...history, annotations]); // Save current state before clearing
            setAnnotations([]);
            setStepCounter(1); // Reset step counter on clear
          }}
          onSave={() => {
            // Save current canvas content
            if (canvasRef.current && appSettings) {
              const format =
                appSettings.saveFormat === "jpg" ? "image/jpeg" : "image/png";
              const quality =
                appSettings.saveFormat === "jpg"
                  ? appSettings.jpegQuality / 100
                  : undefined;

              const dataUrl = canvasRef.current.toDataURL(format, quality);

              if (window.electronAPI && window.electronAPI.saveImageAs) {
                window.electronAPI
                  .saveImageAs(dataUrl)
                  .then((result) => {
                    if (result.success) {
                      setMessage(`Image saved to: ${result.filePath}`);
                    } else {
                      console.error("Failed to save image:", result.error);
                    }
                  })
                  .catch((err) => {
                    console.error("Error calling saveImageAs:", err);
                  });
              } else {
                console.error("saveImageAs API not available");
              }
            }
          }}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onFullscreenCapture={handleFullscreenCapture}
          onRegionCapture={handleRegionCapture}
          onWindowCapture={onNewCapture}
          selectedBlurMode={selectedBlurMode}
          onBlurModeChange={setSelectedBlurMode}
          blurStrength={blurStrength}
          onBlurStrengthChange={setBlurStrength}
          stepColor={stepColor}
          onStepColorChange={setStepColor}
          selectedStepSize={selectedStepSize}
          onStepSizeSelect={setSelectedStepSize}
          textColor={textColor}
          onTextColorChange={setTextColor}
          selectedTextSize={selectedTextSize}
          onTextSizeSelect={setSelectedTextSize}
          selectedHighlighterSize={selectedHighlighterSize}
          onHighlighterSizeSelect={setSelectedHighlighterSize}
          highlighterColor={highlighterColor}
          onHighlighterColorChange={(color) => {
            console.log("Highlighter color change requested:", color);
            setHighlighterColor(color);
          }}
          isRecording={isRecording}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          canUndo={history.length > 0}
          onDelete={() => {}}
          canDelete={false}
          onCopy={handleCopyImageToClipboard}
          onQuit={handleQuitApp}
          isFullscreen={isEditorFullscreen}
        />
      </div>

      {/* Centered Canvas Display */}
      {isImageLoaded && capturedDataUrl ? (
        <div
          ref={canvasContainerRef}
          style={{
            position: "fixed",
            top: "60px", // Leave space for toolbar
            left: "0",
            right: "0",
            bottom: "0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#f0f0f0",
            overflow: "auto", // Allow scrolling if image is larger than viewport
            cursor: dynamicCursorStyle, // Apply cursor to container
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={(e: React.MouseEvent<HTMLCanvasElement>) => {
              // Double-click functionality disabled (selection removed)
              console.log(
                "Double-click detected but selection functionality is disabled"
              );
            }}
            style={{
              border: "1px solid #ccc",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain", // Ensure proper scaling
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: "fixed",
            top: "60px",
            left: "0",
            right: "0",
            bottom: "0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#f8f8f8",
            color: "#666",
            fontSize: "18px",
          }}
        >
          Take a screenshot to get started
        </div>
      )}

      {/* WindowSelector Modal */}
      {isWindowSelectorVisible && (
        <WindowSelector
          sources={windowSources}
          onSelect={async (selectedSourceId: string) => {
            console.log(`[App.tsx] Window selected: ${selectedSourceId}`);
            setIsWindowSelectorVisible(false); // Hide selector immediately
            setMessage("Capturing selected window...");

            if (window.electronAPI && window.electronAPI.captureWindow) {
              try {
                const result = await window.electronAPI.captureWindow(
                  selectedSourceId
                );
                console.log("[App.tsx] Window capture result:", result);

                if (result && result.success && result.dataUrl) {
                  setCapturedDataUrl(result.dataUrl);
                  setOriginalCapturedDataUrl(result.dataUrl);
                  setIsImageLoaded(false); // Will be set to true when image loads
                  setMessage("Window capture successful. Processing...");
                  // Reset annotations and history for new capture
                  setAnnotations([]);
                  setHistory([]);
                  setStepCounter(1);
                } else {
                  setMessage(
                    `Window capture failed: ${
                      result?.message || "Unknown error"
                    }`
                  );
                }
              } catch (error) {
                console.error("Error during window capture:", error);
                setMessage(`Error during window capture: ${error.message}`);
              }
            } else {
              setMessage("Window capture API not available.");
              console.error("electronAPI.captureWindow is not available.");
            }
          }}
          onCancel={() => setIsWindowSelectorVisible(false)}
        />
      )}

      {/* Hidden image element for loading */}
      <img ref={imageElementRef} style={{ display: "none" }} alt="" />
    </div>
  );
};

export default App;
