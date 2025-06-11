import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  CSSProperties,
} from "react";
// Attempt to force TypeScript to recognize global types
import type {} from "./preload.d";

// Define tool types
type Tool =
  | "pen"
  | "arrow"
  | "text"
  | "blur"
  | "none"
  | "text-dragging"
  | "blur-dragging"
  | "select";
// Define size types
type PenSize = "s" | "m" | "l";
type BlurMode = "spot" | "invert"; // New type for blur mode

// --- NEW: Annotation Object Types ---
interface BaseAnnotation {
  id: string; // Unique ID for selection, modification, deletion
  // Potentially add layer order, visibility etc. later
}

interface TextAnnotation extends BaseAnnotation {
  type: "text";
  x: number; // Scaled canvas coordinate
  y: number; // Scaled canvas coordinate
  // width/height might be calculated dynamically or stored if needed for bounds checking
  content: string;
  color: string;
  font: string; // Includes size and font family
  size: PenSize; // Store the abstract size ('s', 'm', 'l')
}

// --- NEW: Pen Annotation Type ---
interface PenAnnotation extends BaseAnnotation {
  type: "pen";
  points: { x: number; y: number }[]; // Array of points in the stroke
  color: string;
  width: number;
  size: PenSize; // Store abstract size too
}

// --- NEW: Arrow Annotation Type ---
interface ArrowAnnotation extends BaseAnnotation {
  type: "arrow";
  startX: number; // Scaled coordinate
  startY: number; // Scaled coordinate
  endX: number; // Scaled coordinate
  endY: number; // Scaled coordinate
  color: string;
  width: number;
  size: PenSize; // Store abstract size
}

// --- NEW: Blur Annotation Type ---
interface BlurAnnotation extends BaseAnnotation {
  type: "blur";
  mode: "invert" | "spot"; // Specify the blur mode
  // For 'invert' mode:
  x?: number; // Optional: Scaled coordinate for bounds
  y?: number; // Optional: Scaled coordinate for bounds
  width?: number; // Optional: Scaled width for bounds
  height?: number; // Optional: Scaled height for bounds
  // For 'spot' mode:
  points?: { x: number; y: number }[]; // Optional: Array of points in the stroke
  brushSize?: number; // Store the size used for pixelation/spot
  // Potential future properties: intensity
}

// Combine all possible annotation types (MODIFIED)
type AnnotationObject =
  | TextAnnotation
  | PenAnnotation
  | ArrowAnnotation
  | BlurAnnotation;

// Custom style type for draggable regions
interface DraggableCSSProperties extends CSSProperties {
  WebkitAppRegion?: "drag" | "no-drag";
}

// Cast style objects to any where non-standard CSS is used
const buttonStyle: any = { WebkitAppRegion: "no-drag" };
const buttonStyleMargin: any = {
  WebkitAppRegion: "no-drag",
  marginLeft: "5px",
};
const imageStyle: any = {
  maxWidth: "100%",
  maxHeight: "150px",
  border: "1px solid #ccc",
  WebkitAppRegion: "no-drag",
};
const quitButtonStyle: any = {
  WebkitAppRegion: "no-drag",
  marginLeft: "auto",
  display: "block",
}; // Style for quit button

// Explicit non-drag style for canvas container
const canvasContainerStyle: DraggableCSSProperties = {
  flexGrow: 1,
  overflow: "auto",
  position: "relative",
  WebkitAppRegion: "no-drag", // Mark canvas area as non-draggable
};
const canvasStyle: React.CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: "100%",
}; // Basic canvas style

const previewCanvasStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  pointerEvents: "none", // Let mouse events pass through to the main canvas underneath
};

const penSizeValues: Record<PenSize, number> = { s: 2, m: 5, l: 10 }; // Map size names to pixel values for PEN
const textSizeValues: Record<PenSize, number> = { s: 12, m: 16, l: 24 }; // Map size names to pixel values for TEXT

// Define the functional component directly
const App: React.FC = () => {
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [originalCapturedDataUrl, setOriginalCapturedDataUrl] = useState<
    string | null
  >(null); // Store original
  const [message, setMessage] = useState<string>("Click a button to capture.");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null); // Use ref for image element
  const canvasContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container

  // Refs for drag optimization
  const canvasRectRef = useRef<DOMRect | null>(null);
  const canvasScaleRef = useRef<{ x: number; y: number } | null>(null);
  const relativeStartPosRef = useRef<{ x: number; y: number } | null>(null); // Ref for PREVIEW drag START (Arrow/Blur/Text)
  const penLastRelativePosRef = useRef<{ x: number; y: number } | null>(null); // NEW: Ref SPECIFICALLY for Pen PREVIEW segment drawing

  // Refs for throttling
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Keep for potential future use
  const lastThrottledDrawTimeRef = useRef<number>(0);
  const throttleInterval = 40; // ~25 FPS, less frequent drawing

  // --- Annotation State ---
  const [selectedTool, setSelectedTool] = useState<Tool>("none");
  const [penColor, setPenColor] = useState<string>("#FF0000");
  const [penWidth, setPenWidth] = useState<number>(penSizeValues.m); // Default to medium width
  const [selectedPenSize, setSelectedPenSize] = useState<PenSize>("m"); // Separate state for pen size
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [lastPosition, setLastPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // -- Text Tool State --
  const [isPlacingText, setIsPlacingText] = useState<boolean>(false);
  const [textPosition, setTextPosition] = useState<{
    x: number;
    y: number;
  } | null>(null); // Stores RELATIVE position for textarea
  const [textAreaSize, setTextAreaSize] = useState<{
    width: number;
    height: number;
  } | null>(null); // Stores RELATIVE size for textarea
  const [finalTextDrawPosition, setFinalTextDrawPosition] = useState<{
    x: number;
    y: number;
  } | null>(null); // Stores SCALED position for drawing
  const [currentTextValue, setCurrentTextValue] = useState<string>("");
  const [selectedTextSize, setSelectedTextSize] = useState<PenSize>("m"); // State for text size
  const [textFont, setTextFont] = useState<string>(
    `${textSizeValues.m}px sans-serif`
  ); // Dynamic font based on selectedTextSize
  const [blurMode, setBlurMode] = useState<BlurMode>("spot"); // Default to spot blur

  // --- NEW: State for current pen stroke ---
  const [currentPenStrokePoints, setCurrentPenStrokePoints] = useState<
    { x: number; y: number }[]
  >([]);

  // --- NEW: State for current spot blur stroke ---
  const [currentSpotBlurPoints, setCurrentSpotBlurPoints] = useState<
    { x: number; y: number }[]
  >([]);

  // --- NEW: Annotation Objects State ---
  const [annotationObjects, setAnnotationObjects] = useState<
    AnnotationObject[]
  >([]);

  // --- NEW: Selection State ---
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);
  const [isDraggingSelection, setIsDraggingSelection] =
    useState<boolean>(false); // State for dragging

  // --- Ref for Dragging Selection ---
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null); // Store start pos for drag delta

  // --- History State (MODIFIED) ---
  // Stores snapshots of the annotationObjects array
  const [history, setHistory] = useState<AnnotationObject[][]>([]);
  const maxHistory = 10; // Max undo steps

  // --- NEW: Recording State ---
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null); // Ref to store the stream for stopping

  // --- NEW: Draw Text Annotation Object ---
  const drawTextObject = (
    ctx: CanvasRenderingContext2D,
    annotation: TextAnnotation
  ) => {
    ctx.fillStyle = annotation.color;
    ctx.font = annotation.font;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const lines = annotation.content.split("\n");
    const fontSizeMatch = annotation.font.match(/(\d+)px/);
    const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1], 10) : 16; // Default size if parse fails
    const lineHeight = fontSize * 1.2;

    lines.forEach((line, index) => {
      ctx.fillText(line, annotation.x, annotation.y + index * lineHeight);
    });
  };

  // --- Pen Drawing Logic (modified - now for preview only) ---
  const drawPenLineSegmentPreview = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) => {
    const canvas = previewCanvasRef.current; // Draw on PREVIEW canvas
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  // --- NEW: Draw Pen Annotation Object (for main render) ---
  const drawPenObject = (
    ctx: CanvasRenderingContext2D,
    annotation: PenAnnotation
  ) => {
    if (annotation.points.length < 2) return; // Need at least two points

    ctx.strokeStyle = annotation.color;
    ctx.lineWidth = annotation.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
    for (let i = 1; i < annotation.points.length; i++) {
      ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
    }
    ctx.stroke();
  };

  // --- NEW: Draw Arrow Annotation Object ---
  const drawArrowObject = (
    ctx: CanvasRenderingContext2D,
    annotation: ArrowAnnotation
  ) => {
    // Set context properties from the annotation object
    ctx.strokeStyle = annotation.color;
    ctx.fillStyle = annotation.color; // Arrow head fill
    ctx.lineWidth = annotation.width;

    // Call the existing helper with coordinates from the annotation
    drawArrow(
      ctx,
      annotation.startX,
      annotation.startY,
      annotation.endX,
      annotation.endY
    );
  };

  // --- Blur Drawing Logic (Spot Blur - Pixelation) (MODIFIED) ---
  const drawBlurSpot = (x: number, y: number, brushSize: number) => {
    // Added brushSize parameter
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Use the passed brushSize directly
    const size = Math.max(6, Math.floor(brushSize)); // Ensure minimum size, maybe floor it

    const startX = Math.max(0, Math.floor(x - size / 2));
    const startY = Math.max(0, Math.floor(y - size / 2));
    const pixelWidth = Math.min(size, canvas.width - startX);
    const pixelHeight = Math.min(size, canvas.height - startY);

    if (pixelWidth <= 0 || pixelHeight <= 0) return;

    try {
      const imageData = ctx.getImageData(
        startX,
        startY,
        pixelWidth,
        pixelHeight
      );
      const pixels = imageData.data;
      let r = 0,
        g = 0,
        b = 0;
      const numPixels = pixels.length / 4;

      for (let i = 0; i < pixels.length; i += 4) {
        r += pixels[i];
        g += pixels[i + 1];
        b += pixels[i + 2];
      }
      r = Math.floor(r / numPixels);
      g = Math.floor(g / numPixels);
      b = Math.floor(b / numPixels);

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(startX, startY, pixelWidth, pixelHeight);
    } catch (error) {
      console.error("Error during pixelation:", error);
    }
  };

  // --- Draw Blur Annotation Object (MODIFIED for Spot) ---
  const drawBlurObject = (
    ctx: CanvasRenderingContext2D,
    annotation: BlurAnnotation
  ) => {
    if (annotation.mode === "invert") {
      // ... existing invert blur logic using offscreen canvas ...
      const sourceImage = imageElementRef.current;
      const mainCanvas = canvasRef.current;
      if (
        !sourceImage ||
        !mainCanvas ||
        !annotation.x ||
        !annotation.y ||
        !annotation.width ||
        !annotation.height ||
        annotation.width <= 0 ||
        annotation.height <= 0
      ) {
        console.warn(
          "Blur (invert) draw skipped: missing data or zero dimensions."
        );
        return;
      }
      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = sourceImage.naturalWidth;
      offscreenCanvas.height = sourceImage.naturalHeight;
      const offscreenCtx = offscreenCanvas.getContext("2d");
      if (!offscreenCtx) {
        console.error("Could not create offscreen context for blur.");
        return;
      }
      try {
        offscreenCtx.drawImage(sourceImage, 0, 0);
        offscreenCtx.filter = "blur(5px)";
        offscreenCtx.drawImage(sourceImage, 0, 0);
        offscreenCtx.filter = "none";
        ctx.drawImage(
          offscreenCanvas,
          0,
          0,
          mainCanvas.width,
          mainCanvas.height
        );
        ctx.drawImage(
          sourceImage,
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height,
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height
        );
      } catch (error) {
        console.error("Error during blur object drawing:", error);
        ctx.save();
        ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height
        );
        ctx.fillStyle = "rgba(255, 0, 0, 0.1)";
        ctx.fillRect(
          annotation.x,
          annotation.y,
          annotation.width,
          annotation.height
        );
        ctx.restore();
      }
    } else if (annotation.mode === "spot") {
      // --- Spot Mode (Apply effect from points - FIXED) ---
      if (
        annotation.points &&
        annotation.points.length > 0 &&
        annotation.brushSize
      ) {
        // Check brushSize exists
        // console.log(`Drawing BlurAnnotation (spot) with ${annotation.points.length} points.`); // Keep console lean
        // Iterate through the stored SCALED points and apply the effect
        annotation.points.forEach((point) => {
          // Call drawBlurSpot, passing the stored brushSize directly
          drawBlurSpot(point.x, point.y, annotation.brushSize); // Use annotation.brushSize
        });
      } else {
        // Draw placeholder if points/brushSize are missing
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 255, 0.2)";
        const placeholderX = annotation.x ?? annotation.points?.[0]?.x ?? 0; // Use optional chaining
        const placeholderY = annotation.y ?? annotation.points?.[0]?.y ?? 0;
        const placeholderWidth = annotation.width ?? 10;
        const placeholderHeight = annotation.height ?? 10;
        ctx.beginPath();
        ctx.arc(
          placeholderX + placeholderWidth / 2,
          placeholderY + placeholderHeight / 2,
          10,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }
    }
  };

  // --- Render All Annotations (MODIFIED for Draw Order & Selection Highlight) ---
  const renderAllAnnotations = useCallback(() => {
    if (!canvasRef.current || !imageElementRef.current) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageElementRef.current, 0, 0);

    // Helper function to draw selection highlight
    const drawSelectionHighlight = (annotation: AnnotationObject) => {
      ctx.save();
      ctx.strokeStyle = "rgba(0, 150, 255, 0.8)"; // Blue highlight color
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      let bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
      } | null = null;

      switch (annotation.type) {
        case "text":
          bounds = getTextBounds(annotation, ctx);
          break;
        case "arrow":
          // Calculate bounds encompassing start and end points
          bounds = getRectBounds(
            { x: annotation.startX, y: annotation.startY },
            { x: annotation.endX, y: annotation.endY }
          );
          // Add padding for line width
          bounds.x -= annotation.width / 2 + 2;
          bounds.y -= annotation.width / 2 + 2;
          bounds.width += annotation.width + 4;
          bounds.height += annotation.width + 4;
          break;
        case "pen":
        case "blur": // Spot blur uses points
          if (annotation.points && annotation.points.length > 0) {
            let minX = annotation.points[0].x,
              minY = annotation.points[0].y;
            let maxX = annotation.points[0].x,
              maxY = annotation.points[0].y;
            annotation.points.forEach((p) => {
              minX = Math.min(minX, p.x);
              minY = Math.min(minY, p.y);
              maxX = Math.max(maxX, p.x);
              maxY = Math.max(maxY, p.y);
            });
            const padding =
              (annotation.type === "pen"
                ? annotation.width
                : annotation.brushSize ?? 10) /
                2 +
              2;
            bounds = {
              x: minX - padding,
              y: minY - padding,
              width: maxX - minX + 2 * padding,
              height: maxY - minY + 2 * padding,
            };
          }
          break;
        case "blur": // Invert blur uses rect
          if (
            annotation.mode === "invert" &&
            annotation.x &&
            annotation.y &&
            annotation.width &&
            annotation.height
          ) {
            bounds = {
              x: annotation.x,
              y: annotation.y,
              width: annotation.width,
              height: annotation.height,
            };
          }
          break;
      }

      if (bounds) {
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }

      ctx.restore();
    };

    // --- Loop 1: Draw NON-BLUR Annotations ---
    annotationObjects.forEach((annotation) => {
      if (annotation.type !== "blur") {
        ctx.save();
        switch (annotation.type) {
          case "text":
            drawTextObject(ctx, annotation);
            break;
          case "pen":
            drawPenObject(ctx, annotation);
            break;
          case "arrow":
            drawArrowObject(ctx, annotation);
            break;
        }
        ctx.restore();
        // Draw highlight if selected
        if (annotation.id === selectedAnnotationId) {
          drawSelectionHighlight(annotation);
        }
      }
    });

    // --- Loop 2: Draw BLUR Annotations ---
    annotationObjects.forEach((annotation) => {
      if (annotation.type === "blur") {
        ctx.save();
        drawBlurObject(ctx, annotation);
        ctx.restore();
        // Draw highlight if selected
        if (annotation.id === selectedAnnotationId) {
          drawSelectionHighlight(annotation);
        }
      }
    });
  }, [annotationObjects, selectedAnnotationId]); // Add selectedAnnotationId dependency

  // --- Update useEffect hooks and handlers to use renderAllAnnotations ---

  // 1. Initial Render on Image Load
  useEffect(() => {
    if (capturedDataUrl) {
      const img = new Image();
      img.onload = () => {
        console.log("Original image loaded, storing element.");
        setOriginalCapturedDataUrl(capturedDataUrl); // Store the original source URL
        imageElementRef.current = img; // Store the loaded image element

        // Now draw the initial image on the main canvas
        if (canvasRef.current && previewCanvasRef.current) {
          const mainCanvas = canvasRef.current;
          const previewCanvas = previewCanvasRef.current;
          // Set canvas sizes
          mainCanvas.width = img.width;
          mainCanvas.height = img.height;
          previewCanvas.width = img.width;
          previewCanvas.height = img.height;
          // --- REMOVED old drawing logic ---
          // const mainCtx = mainCanvas.getContext("2d");
          // mainCtx?.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
          // mainCtx?.drawImage(img, 0, 0);
          // const previewCtx = previewCanvas.getContext("2d");
          // previewCtx?.clearRect(0,0,previewCanvas.width,previewCanvas.height);

          // --- History Initialization (Keep) ---
          setAnnotationObjects([]); // Clear current annotations
          setHistory([[]]); // Start history with an empty annotation array
          console.log("Initial annotation history saved (empty array).");

          // --- REPLACE initial draw with renderAll (will be called by useEffect below) ---
          // renderAllAnnotations(); // Render is now handled by the useEffect below
          console.log("Image loaded, state set. Render will occur via effect.");
          // ---
        }
        setMessage("Capture successful! Ready to annotate.");
      };
      img.onerror = () => {
        console.error("Error loading initial image");
        setMessage("Error loading captured image.");
      };
      img.src = capturedDataUrl;
    } else {
      // Clear everything if capturedDataUrl is null
      setOriginalCapturedDataUrl(null);
      imageElementRef.current = null;
      // Clear canvases
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      if (previewCanvasRef.current) {
        const ctx = previewCanvasRef.current.getContext("2d");
        ctx?.clearRect(
          0,
          0,
          previewCanvasRef.current.width,
          previewCanvasRef.current.height
        );
      }
      setAnnotationObjects([]); // Clear annotations state
      setHistory([]); // Clear history if no image
    }
    // Trigger initial render MANUALLY after setup.
  }, [capturedDataUrl]);

  // Re-render whenever annotationObjects changes OR image element is ready
  useEffect(() => {
    if (imageElementRef.current) {
      // Only render if base image is loaded
      console.log(
        "Annotation objects, selection, or image changed, triggering re-render."
      );
      renderAllAnnotations();
    }
  }, [annotationObjects, selectedAnnotationId, renderAllAnnotations]); // Add selectedAnnotationId dependency

  // 2. Render after finalizing Text
  const finalizeText = () => {
    const textToDraw = currentTextValue.trim();
    if (!textInputRef.current || !finalTextDrawPosition || !textToDraw) {
      setIsPlacingText(false);
      setTextPosition(null);
      setTextAreaSize(null);
      setFinalTextDrawPosition(null);
      setCurrentTextValue("");
      return;
    }

    // --- NEW: Create Text Annotation Object ---
    const newTextObject: TextAnnotation = {
      id: `text-${Date.now()}-${Math.random()}`, // Simple unique ID
      type: "text",
      x: finalTextDrawPosition.x,
      y: finalTextDrawPosition.y,
      content: textToDraw,
      color: penColor,
      font: textFont,
      size: selectedTextSize,
    };

    // Update annotation objects state (triggers re-render via useEffect)
    const updatedAnnotations = [...annotationObjects, newTextObject];
    setAnnotationObjects(updatedAnnotations);

    // --- NEW: Update History ---
    setHistory((prevHistory) => {
      const newHistory = [...prevHistory, updatedAnnotations];
      if (newHistory.length > maxHistory + 1) {
        return newHistory.slice(newHistory.length - (maxHistory + 1));
      }
      return newHistory;
    });

    // --- REMOVE direct drawing, renderAll is handled by useEffect ---
    // console.log(
    //   `Drawing text "${textToDraw.replace("\n", "\\n")}" at SCALED`,
    //   finalTextDrawPosition,
    //   `with font ${textFont}`
    // );

    console.log(
      `Created TextAnnotation object for "${textToDraw.replace(
        "\n",
        "\\n"
      )}" at`,
      finalTextDrawPosition,
      `with font ${textFont}`
    );

    // Reset state
    setIsPlacingText(false);
    setTextPosition(null);
    setTextAreaSize(null);
    setFinalTextDrawPosition(null); // Clear scaled position
    setCurrentTextValue("");
  };

  // 3. Render after Undo
  const handleUndo = () => {
    console.log("Attempting Undo");
    if (history.length > 1) {
      setHistory((prevHistory) => {
        const newHistory = prevHistory.slice(0, -1);
        const previousAnnotationState = newHistory[newHistory.length - 1];
        // Restore the annotation objects state (this will trigger re-render via useEffect)
        setAnnotationObjects(previousAnnotationState);

        // --- REMOVE direct canvas clearing/drawing ---
        // if (canvasRef.current && imageElementRef.current) {
        //   const ctx = canvasRef.current.getContext("2d");
        //   ctx?.clearRect(
        //     0,
        //     0,
        //     canvasRef.current.width,
        //     canvasRef.current.height
        //   );
        //   ctx?.drawImage(imageElementRef.current, 0, 0);
        //   console.log(
        //     "Canvas cleared and base image redrawn for undo. Annotations need full rerender."
        //   );
        // }
        console.log(
          "Undo: Restored annotation state. Re-render will be triggered."
        );
        // ---
        return newHistory; // Return the updated history stack
      });
    } else {
      console.log("Cannot undo further.");
    }
  };

  // --- Capture Initiation ---
  const handleCapture = async (type: string) => {
    setMessage(`Initiating ${type} capture...`);
    setCapturedDataUrl(null); // Clear previous image/canvas (triggers effect above)
    try {
      const result = await window.electronAPI.invokeCapture(type);
      console.log("Capture initiation result:", result);
      // Update message based on initiation
      setMessage(result.message || `Capture type ${type} initiated.`);
      // For fullscreen, set data URL immediately to trigger image load effect
      if (type === "fullscreen" && result.success && result.dataUrl) {
        setCapturedDataUrl(result.dataUrl);
      } // Region capture data comes via onCaptureData listener
      setSelectedTool("none");
      setIsDrawing(false);
    } catch (error) {
      console.error("IPC Error:", error);
      setMessage(`Capture error: ${error.message}`);
    }
  };

  // --- Listener for Final Capture Data (Region) ---
  useEffect(() => {
    // This just sets capturedDataUrl, triggering the image loading effect above
    const handleCaptureData = (
      event: any,
      data: { success: boolean; dataUrl?: string; message?: string }
    ) => {
      console.log("Received capture-data:", data);
      if (data.success && data.dataUrl) {
        setCapturedDataUrl(data.dataUrl); // Set data URL to trigger image load
      } else {
        setMessage(
          `Capture failed: ${data.message || "Unknown error after processing"}`
        );
        setCapturedDataUrl(null);
      }
    };
    const cleanup = window.electronAPI.onCaptureData(handleCaptureData);
    return cleanup;
  }, []);

  // --- Refine applyModernInvertBlur ---
  const applyModernInvertBlur = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    inputBounds: { x: number; y: number; width: number; height: number },
    sourceImage: HTMLImageElement
  ) => {
    if (!sourceImage || inputBounds.width <= 0 || inputBounds.height <= 0)
      return;
    console.log("Applying modern inverted BLUR effect to bounds:", inputBounds);

    // --- Clamp and Floor Bounds for Precision ---
    const x = Math.max(0, Math.floor(inputBounds.x));
    const y = Math.max(0, Math.floor(inputBounds.y));
    const width = Math.max(
      0,
      Math.min(Math.floor(inputBounds.width), sourceImage.width - x)
    );
    const height = Math.max(
      0,
      Math.min(Math.floor(inputBounds.height), sourceImage.height - y)
    );
    const bounds = { x, y, width, height };

    if (bounds.width <= 0 || bounds.height <= 0) {
      console.warn(
        "Calculated bounds have zero or negative dimension after clamping."
      );
      return;
    }

    ctx.save();
    // 1. Draw original image
    if (canvas === canvasRef.current)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

    // 2. Apply blur filter
    ctx.filter = "blur(5px)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";

    // 3. Draw the clear section with green tint
    ctx.fillStyle = "rgba(0, 255, 0, 0.2)"; // Semi-transparent green
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // 4. Draw original image section on top
    ctx.drawImage(
      sourceImage,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height
    );

    ctx.restore();
    console.log(
      "Modern inverted blur effect applied with clamped bounds:",
      bounds
    );
  };

  // --- Tool Selection Handler ---
  const handleToolSelect = (tool: Tool) => {
    if (
      tool === "text-dragging" ||
      tool === "blur-dragging" ||
      tool === "select"
    )
      return; // Ignore internal states AND select for now
    if (isPlacingText) finalizeText();
    setIsDrawing(false);
    if (tool !== "text") {
      setIsPlacingText(false);
    }
    setSelectedTool(tool);
    console.log("Selected tool:", tool);
    // Reset blur mode if selecting a non-blur tool? Optional.
    // if (tool !== 'blur') setBlurMode('spot');
  };

  // --- Size Selection Handlers ---
  const handlePenSizeSelect = (size: PenSize) => {
    setSelectedPenSize(size);
    setPenWidth(penSizeValues[size]);
    console.log("Selected pen size:", size, "->", penSizeValues[size], "px");
  };

  const handleTextSizeSelect = (size: PenSize) => {
    setSelectedTextSize(size);
    // Font state updates via useEffect
    console.log("Selected text size:", size, "->", textSizeValues[size], "px");
  };

  // --- Coordinate Calculation (Alternative Method: Fractional) ---
  const getCanvasCoordinates = (
    event: React.MouseEvent<HTMLCanvasElement>,
    rect: DOMRect | null,
    scale: { x: number; y: number } | null, // Still needed to know if scaling exists
    container: HTMLDivElement | null,
    canvasEl: HTMLCanvasElement | null // Pass the canvas element itself
  ): { x: number; y: number } | null => {
    if (!rect || !scale || !container || !canvasEl) {
      // Check canvasEl too
      console.warn(
        "Rect, scale, container, or canvas element not available for coordinate calculation"
      );
      return null;
    }
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    // 1. Position relative to element bounds (considering scroll)
    const relativeX = event.clientX - rect.left + scrollLeft;
    const relativeY = event.clientY - rect.top + scrollTop;

    // 2. Position as fraction of element dimensions (use rect width/height)
    // Avoid division by zero if rect has no size
    const fractionX = rect.width > 0 ? relativeX / rect.width : 0;
    const fractionY = rect.height > 0 ? relativeY / rect.height : 0;

    // 3. Apply fraction to intrinsic canvas size
    let coords = {
      x: fractionX * canvasEl.width,
      y: fractionY * canvasEl.height,
    };

    // Clamp coordinates to be within the canvas intrinsic bounds (0 to width/height)
    coords.x = Math.max(0, Math.min(coords.x, canvasEl.width));
    coords.y = Math.max(0, Math.min(coords.y, canvasEl.height));

    return coords;
  };

  // --- Pen Drawing Logic ---
  // const drawPenLine = (x1: number, y1: number, x2: number, y2: number) => {
  //   const canvas = canvasRef.current;
  //   if (!canvas) return;
  //   const ctx = canvas.getContext("2d");
  //   if (!ctx) return;
  //   ...
  // };

  // --- Arrow Drawing Logic (Standard Shape + Scaled Head) ---
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => {
    const dx = toX - fromX;
    const dy = toY - fromY;
    // Handle zero-length arrows gracefully
    if (dx === 0 && dy === 0) return;

    const angle = Math.atan2(dy, dx);
    const arrowColor = penColor;
    const currentLineWidth = ctx.lineWidth; // Get width from context (set before calling)

    // Calculate head length based on line width (e.g., 3 times the width, min 8, max 20)
    const headLength = Math.min(Math.max(currentLineWidth * 3, 8), 20);

    ctx.save();
    ctx.strokeStyle = arrowColor;
    ctx.fillStyle = arrowColor; // Head fill color
    // lineWidth is already set on the context before calling drawArrow
    ctx.lineCap = "round";

    // Draw line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill(); // Fill the arrowhead
    ctx.restore();
  };

  // Helper to calculate rectangle bounds from two points
  const getRectBounds = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) => {
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const width = Math.abs(p1.x - p2.x);
    const height = Math.abs(p1.y - p2.y);
    return { x, y, width, height };
  };

  // --- NEW: Hit Detection Helper Functions ---
  // Generic check for point inside a rectangle
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

  // Check if point is near a line segment
  const isPointNearLine = (
    point: { x: number; y: number },
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    threshold: number
  ): boolean => {
    const { x, y } = point;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy; // Length squared

    if (lenSq === 0) {
      // Handle zero-length line (check distance to the single point)
      const distSq = (x - x1) * (x - x1) + (y - y1) * (y - y1);
      return distSq <= threshold * threshold;
    }

    // Project point onto the line segment
    let t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // Clamp t to [0, 1] to stay on the segment

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    // Calculate distance squared from point to the closest point on the segment
    const distSq =
      (x - closestX) * (x - closestX) + (y - closestY) * (y - closestY);

    return distSq <= threshold * threshold;
  };

  // Check if point is near any segment of a polyline
  const isPointNearPolyline = (
    point: { x: number; y: number },
    points: { x: number; y: number }[],
    threshold: number
  ): boolean => {
    if (points.length < 2) return false; // Need at least two points for a line
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

  // Calculate approximate bounding box for text (needs improvement for multi-line)
  const getTextBounds = (
    annotation: TextAnnotation,
    ctx: CanvasRenderingContext2D | null // Pass context for measurements
  ): { x: number; y: number; width: number; height: number } => {
    if (!ctx) {
      // Estimate if context not available (less accurate)
      const lines = annotation.content.split("\n");
      const approxCharWidth = 8; // Very rough estimate
      const maxWidth =
        Math.max(...lines.map((line) => line.length)) * approxCharWidth;
      const fontSizeMatch = annotation.font.match(/(\d+)px/);
      const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1], 10) : 16;
      const lineHeight = fontSize * 1.2;
      const height = lines.length * lineHeight;
      return { x: annotation.x, y: annotation.y, width: maxWidth, height };
    }

    ctx.save();
    ctx.font = annotation.font;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const lines = annotation.content.split("\n");
    const fontSizeMatch = annotation.font.match(/(\d+)px/);
    const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1], 10) : 16;
    const lineHeight = fontSize * 1.2;
    let maxWidth = 0;
    lines.forEach((line) => {
      const metrics = ctx.measureText(line);
      maxWidth = Math.max(maxWidth, metrics.width);
    });
    const totalHeight = lines.length * lineHeight;
    ctx.restore();
    return {
      x: annotation.x,
      y: annotation.y,
      width: maxWidth,
      height: totalHeight,
    };
  };

  // Main hit detection function
  const isPointInsideAnnotation = (
    point: { x: number; y: number },
    annotation: AnnotationObject,
    ctx: CanvasRenderingContext2D | null,
    threshold: number = 5 // Default threshold for line checks
  ): boolean => {
    switch (annotation.type) {
      case "text":
        const bounds = getTextBounds(annotation, ctx);
        return isPointInsideRect(
          point,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height
        );
      case "pen":
        // Increase threshold based on pen width
        const penThreshold = Math.max(threshold, annotation.width / 2 + 2);
        return isPointNearPolyline(point, annotation.points, penThreshold);
      case "arrow":
        // Increase threshold based on arrow width
        const arrowThreshold = Math.max(threshold, annotation.width / 2 + 2);
        return isPointNearLine(
          point,
          annotation.startX,
          annotation.startY,
          annotation.endX,
          annotation.endY,
          arrowThreshold
        );
      case "blur":
        if (annotation.mode === "invert") {
          if (
            annotation.x &&
            annotation.y &&
            annotation.width &&
            annotation.height
          ) {
            return isPointInsideRect(
              point,
              annotation.x,
              annotation.y,
              annotation.width,
              annotation.height
            );
          } else {
            return false; // Cannot check bounds if properties missing
          }
        } else if (annotation.mode === "spot") {
          // Increase threshold based on brush size
          const spotThreshold = Math.max(
            threshold,
            (annotation.brushSize ?? 10) / 2 + 2
          );
          return annotation.points
            ? isPointNearPolyline(point, annotation.points, spotThreshold)
            : false;
        }
        return false; // Should not happen
      default:
        return false;
    }
  };

  // --- Mouse Event Handlers (Updated Call to getCanvasCoordinates) ---
  const handleCanvasMouseDown = (
    event: React.MouseEvent<HTMLCanvasElement>
  ) => {
    console.log(`Mouse Down - Tool: ${selectedTool}`);

    // --- Get Canvas, Container, and Scaled Click Position (Needed early for Select) ---
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    if (!canvas || !container) return;

    let rect: DOMRect | null = null;
    let scale: { x: number; y: number } | null = null;
    try {
      rect = canvas.getBoundingClientRect();
      scale = {
        x: canvas.width / rect.width,
        y: canvas.height / rect.height,
      };
      // Cache rect/scale ONLY if NOT using the select tool immediately
      // Select tool just needs them temporarily for the click check
      // Other tools cache them for mouseMove/mouseUp
    } catch (e) {
      console.error("Error getting bounding client rect:", e);
      return; // Cannot proceed without rect/scale
    }

    const clickPos = getCanvasCoordinates(
      event,
      rect,
      scale,
      container,
      canvas
    );
    if (!clickPos) {
      console.warn("Could not get click coordinates.");
      return; // Cannot proceed without click position
    }

    // --- NEW: Select Tool Hit Detection ---
    if (selectedTool === "select") {
      let hitDetected = false;
      const ctx = canvas.getContext("2d"); // Get context for text measurement

      for (let i = annotationObjects.length - 1; i >= 0; i--) {
        const annotation = annotationObjects[i];
        const isHit = isPointInsideAnnotation(clickPos, annotation, ctx); // Use the helper
        if (isHit) {
          console.log(`Hit detected on annotation: ${annotation.id}`);
          setSelectedAnnotationId(annotation.id);
          setIsDraggingSelection(true); // Start dragging
          dragStartPosRef.current = clickPos; // Store drag start position
          hitDetected = true;
          break;
        }
      }
      if (!hitDetected) {
        console.log("Click on empty space, deselecting.");
        setSelectedAnnotationId(null);
      }
      return; // *** IMPORTANT: Return here to prevent other tool logic ***
    }

    // Cache rect/scale for use in mouseMove/Up for drawing tools
    canvasRectRef.current = rect;
    canvasScaleRef.current = scale;

    // Calculate RELATIVE start position (needed for drag previews)
    let initialRelativePos: { x: number; y: number } | null = null;
    try {
      const scrollLeft = container.scrollLeft;
      const scrollTop = container.scrollTop;
      const relativeX = event.clientX - rect.left + scrollLeft;
      const relativeY = event.clientY - rect.top + scrollTop;
      initialRelativePos = { x: relativeX, y: relativeY };
      relativeStartPosRef.current = initialRelativePos;
    } catch (e) {
      console.error("Error calculating relative position:", e);
      relativeStartPosRef.current = null;
      return;
    }

    // Use the SCALED click position calculated earlier as the start position
    const startPos = clickPos;

    // Original logic for initiating text/blur dragging states
    if (selectedTool === "text") {
      if (!isPlacingText) {
        setSelectedTool("text-dragging");
      } else {
        if (
          textInputRef.current &&
          !textInputRef.current.contains(event.target as Node)
        ) {
          console.log(
            "Clicked outside text input while placing text, finalizing."
          );
          finalizeText();
          return;
        }
      }
    } else if (selectedTool === "blur" && blurMode === "invert") {
      setSelectedTool("blur-dragging"); // Switch to dragging state
    }
    // Keep isPlacingText check from reverted code
    else if (
      isPlacingText &&
      textInputRef.current &&
      !textInputRef.current.contains(event.target as Node)
    ) {
      console.log("Clicked outside text input while placing text, finalizing.");
      finalizeText();
      return;
    }

    setIsDrawing(true);
    setLastPosition(startPos); // Store SCALED start (used by multiple tools on mouseUp)

    // --- Pen Tool Start ---
    if (selectedTool === "pen") {
      setCurrentPenStrokePoints([startPos]); // Start stroke with SCALED point
      penLastRelativePosRef.current = initialRelativePos; // Use DEDICATED ref for RELATIVE pen preview start
    }
    // --- Spot Blur Start ---
    else if (selectedTool === "blur" && blurMode === "spot") {
      setCurrentSpotBlurPoints([startPos]); // Start new stroke with SCALED point
    }
    // --- Pen Tool End ---
  };

  // --- Update handleCanvasMouseMove (Apply Relative Coords for Arrow/Text Preview) ---
  const handleCanvasMouseMove = (
    event: React.MouseEvent<HTMLCanvasElement>
  ) => {
    // --- Handle Selection Dragging FIRST ---
    if (
      isDraggingSelection &&
      selectedAnnotationId &&
      dragStartPosRef.current
    ) {
      const canvas = canvasRef.current;
      const container = canvasContainerRef.current;
      const rect = canvasRectRef.current; // Use cached rect if available
      const scale = canvasScaleRef.current; // Use cached scale if available

      if (!canvas || !container || !rect || !scale) {
        console.warn("Drag Move: Missing refs, cannot calculate position.");
        return; // Cannot proceed without refs
      }

      const currentPos = getCanvasCoordinates(
        event,
        rect,
        scale,
        container,
        canvas
      );
      if (!currentPos) {
        console.warn("Drag Move: Could not calculate current position.");
        return;
      }

      const dx = currentPos.x - dragStartPosRef.current.x;
      const dy = currentPos.y - dragStartPosRef.current.y;

      // Find and update the selected annotation
      setAnnotationObjects((prevAnnotations) =>
        prevAnnotations.map((anno) => {
          if (anno.id === selectedAnnotationId) {
            // Create a *new* moved object
            const movedAnno = { ...anno }; // Shallow copy first
            switch (movedAnno.type) {
              case "text":
                movedAnno.x += dx;
                movedAnno.y += dy;
                break;
              case "arrow":
                movedAnno.startX += dx;
                movedAnno.startY += dy;
                movedAnno.endX += dx;
                movedAnno.endY += dy;
                break;
              case "blur":
                if (movedAnno.mode === "invert" && movedAnno.x && movedAnno.y) {
                  movedAnno.x += dx;
                  movedAnno.y += dy;
                  // Width/height remain the same
                } else if (movedAnno.mode === "spot" && movedAnno.points) {
                  // Need deep copy for points array
                  movedAnno.points = movedAnno.points.map((p) => ({
                    x: p.x + dx,
                    y: p.y + dy,
                  }));
                }
                break;
              case "pen":
                // Need deep copy for points array
                movedAnno.points = movedAnno.points.map((p) => ({
                  x: p.x + dx,
                  y: p.y + dy,
                }));
                break;
            }
            return movedAnno;
          }
          return anno; // Return unchanged annotations
        })
      );

      // Update drag start position for the next move calculation
      dragStartPosRef.current = currentPos;

      return; // Prevent other mouse move logic
    }
    // --- End Selection Dragging ---

    if (!isDrawing) return;
    // --- Get Refs and Calculate Positions ---
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    const rect = canvasRectRef.current;
    const scale = canvasScaleRef.current;
    if (!canvas || !container || !rect || !scale) return; // Ensure refs are valid

    // SCALED position (for pen points, spot blur draw)
    const currentPos = getCanvasCoordinates(
      event,
      rect,
      scale,
      container,
      canvas
    );
    if (!currentPos) return; // Ensure scaled pos calculated

    // RELATIVE position (for previews)
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    const currentRelativeX = event.clientX - rect.left + scrollLeft;
    const currentRelativeY = event.clientY - rect.top + scrollTop;
    const currentRelativePos = { x: currentRelativeX, y: currentRelativeY };

    // Check required start positions based on tool
    const dragStartRelativePos = relativeStartPosRef.current; // For Arrow/Blur/Text drag
    const penPreviousRelativePos = penLastRelativePosRef.current; // Specifically for Pen preview

    // Check if necessary position refs are available for the current tool
    if (
      (selectedTool === "arrow" ||
        selectedTool === "text-dragging" ||
        selectedTool === "blur-dragging") &&
      !dragStartRelativePos
    ) {
      // console.warn("MouseMove: Missing relativeStartPosRef for drag tool");
      return; // Need drag start relative pos
    }
    if (selectedTool === "pen" && !penPreviousRelativePos) {
      // console.warn("MouseMove: Missing penLastRelativePosRef for pen tool preview");
      return; // Need previous relative for pen preview segment
    }
    if (
      (selectedTool === "pen" ||
        (selectedTool === "blur" && blurMode === "spot")) &&
      !lastPosition
    ) {
      // console.warn("MouseMove: Missing lastPosition for pen/spot tool");
      return; // Need scaled last pos for pen/spot logic
    }

    // --- Tool-specific drawing/preview ---
    const previewCanvas = previewCanvasRef.current;
    const previewCtx = previewCanvas?.getContext("2d", {
      willReadFrequently: true,
    }); // Add willReadFrequently for spot preview

    if (selectedTool === "pen") {
      // --- Pen Tool Move ---
      // Add SCALED point to the list for the final object
      setCurrentPenStrokePoints((prevPoints) => [...prevPoints, currentPos]);
      // Draw PREVIEW segment using RELATIVE points (using the DEDICATED pen ref)
      if (penPreviousRelativePos) {
        // Check if the dedicated ref has a value
        drawPenLineSegmentPreview(
          penPreviousRelativePos.x,
          penPreviousRelativePos.y,
          currentRelativePos.x,
          currentRelativePos.y
        );
      }
      // Update last positions for next iteration
      setLastPosition(currentPos); // Update SCALED position
      penLastRelativePosRef.current = currentRelativePos; // Update DEDICATED RELATIVE ref
      // --- Pen Tool End ---
    } else if (
      selectedTool === "arrow" &&
      previewCtx &&
      previewCanvas &&
      dragStartRelativePos
    ) {
      // Arrow PREVIEW uses relativeStartPosRef (dragStartRelativePos) and currentRelativePos (Correct)
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      previewCtx.lineWidth = penWidth;
      previewCtx.strokeStyle = penColor;
      previewCtx.fillStyle = penColor;
      drawArrow(
        previewCtx,
        dragStartRelativePos.x,
        dragStartRelativePos.y,
        currentRelativePos.x, // Use calculated current relative pos
        currentRelativePos.y
      );
    } else if (
      selectedTool === "text-dragging" &&
      previewCtx &&
      previewCanvas &&
      dragStartRelativePos
    ) {
      // Text PREVIEW uses relativeStartPosRef (dragStartRelativePos) and currentRelativePos (Correct)
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      const bounds = getRectBounds(dragStartRelativePos, currentRelativePos);
      previewCtx.strokeStyle = "rgba(0, 255, 0, 1)"; // Bold Green
      previewCtx.lineWidth = 2;
      previewCtx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    } else if (selectedTool === "blur" && blurMode === "spot" && lastPosition) {
      // --- Spot Blur Move (MODIFIED) ---
      const now = Date.now();
      if (now - lastThrottledDrawTimeRef.current > throttleInterval) {
        // Add SCALED point to the list for the final object
        setCurrentSpotBlurPoints((prevPoints) => [...prevPoints, currentPos]);

        // Draw PREVIEW on preview canvas
        if (previewCtx) {
          // Draw a simple circle preview using RELATIVE coordinates
          previewCtx.fillStyle = "rgba(0, 0, 255, 0.3)";
          previewCtx.beginPath();
          const previewBrushSize = Math.max(6, penWidth * 3);
          previewCtx.arc(
            currentRelativePos.x,
            currentRelativePos.y,
            previewBrushSize / 2,
            0,
            Math.PI * 2
          );
          previewCtx.fill();
        }

        lastThrottledDrawTimeRef.current = now;
        setLastPosition(currentPos); // Update scaled position
      }
    } else if (
      selectedTool === "blur-dragging" &&
      previewCtx &&
      previewCanvas &&
      dragStartRelativePos
    ) {
      // Highlight Blur PREVIEW uses relativeStartPosRef (dragStartRelativePos) and currentRelativePos (Correct)
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      const bounds = getRectBounds(dragStartRelativePos, currentRelativePos);
      previewCtx.setLineDash([4, 4]);
      previewCtx.strokeStyle = "rgba(0, 255, 0, 0.9)";
      previewCtx.lineWidth = 1;
      previewCtx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      previewCtx.setLineDash([]);
    }
  };

  const handleCanvasMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Capture state before resetting
    const wasDrawing = isDrawing;
    const toolUsed = selectedTool;
    const initialScaledPos = lastPosition; // Capture the scaled start position stored in lastPosition
    const initialRelativePos = relativeStartPosRef.current; // Capture relative start for drag tools
    const wasDraggingSelection = isDraggingSelection; // Capture drag state

    setIsDrawing(false); // Stop drawing state immediately

    // --- Handle End of Selection Drag FIRST ---
    if (wasDraggingSelection) {
      console.log("Mouse Up: Finalizing selection drag.");
      setIsDraggingSelection(false); // End dragging state
      dragStartPosRef.current = null; // Clear drag start position

      // Save history AFTER the move is complete (state updated in mouseMove)
      console.log("Saving history after drag move.");
      setHistory((prevHistory) => {
        // Use the current annotationObjects state, which reflects the completed drag
        const currentAnnotationState = [...annotationObjects];
        const newHistory = [...prevHistory, currentAnnotationState];
        if (newHistory.length > maxHistory + 1) {
          return newHistory.slice(newHistory.length - (maxHistory + 1));
        }
        return newHistory;
      });

      // We might want to keep the item selected after dragging, so don't nullify selectedAnnotationId here.
      // Clean up canvas refs later in the general cleanup section
      return; // Prevent other mouseUp logic (like creating new shapes)
    }
    // --- End Selection Drag Finalization ---

    // --- Get cached refs ---
    const currentRect = canvasRectRef.current;
    const currentScale = canvasScaleRef.current;
    const currentContainer = canvasContainerRef.current;

    // --- Exit if refs missing or not drawing (unless finalizing text) ---
    if (
      !canvasRef.current ||
      !currentRect ||
      !currentScale ||
      !currentContainer
    ) {
      console.warn("MouseUp: Missing refs, cleanup only.");
      // Perform cleanup even if exiting early
      setLastPosition(null);
      relativeStartPosRef.current = null;
      penLastRelativePosRef.current = null;
      canvasRectRef.current = null;
      canvasScaleRef.current = null;
      lastThrottledDrawTimeRef.current = 0;
      if (toolUsed === "pen") setCurrentPenStrokePoints([]); // Clear pen points if click ends pen tool
      return;
    }
    if (!wasDrawing) {
      // Handle clicks without drawing (e.g. finalize text)
      if (
        toolUsed === "text" &&
        isPlacingText &&
        textInputRef.current &&
        !textInputRef.current.contains(event.target as Node)
      ) {
        finalizeText();
      }
      // Perform cleanup if only clicking
      canvasRectRef.current = null;
      canvasScaleRef.current = null;
      lastThrottledDrawTimeRef.current = 0;
      if (toolUsed === "pen") setCurrentPenStrokePoints([]);
      return;
    }

    // --- Calculate final positions ---
    const finalRelativePos = getRelativeCoordinates(
      event,
      currentRect,
      currentContainer
    );
    const finalScaledPos = getCanvasCoordinates(
      event,
      currentRect,
      currentScale,
      currentContainer,
      canvasRef.current
    );

    if (!finalRelativePos || !finalScaledPos) {
      console.warn(
        "MouseUp: Could not calculate final positions, cleanup only."
      );
      // Perform cleanup even if positions failed
      setLastPosition(null);
      relativeStartPosRef.current = null;
      penLastRelativePosRef.current = null;
      canvasRectRef.current = null;
      canvasScaleRef.current = null;
      lastThrottledDrawTimeRef.current = 0;
      setCurrentPenStrokePoints([]); // Ensure points are cleared
      return;
    }

    // --- Tool-specific finalization ---
    let actionTaken = false; // Flag for history

    if (toolUsed === "pen") {
      // --- Pen Tool End ---
      if (currentPenStrokePoints.length > 1) {
        // Use the collected SCALED points
        const newPenStroke: PenAnnotation = {
          id: `pen-${Date.now()}-${Math.random()}`, // Fix linter error by providing properties
          type: "pen",
          points: [...currentPenStrokePoints], // Create copy
          color: penColor,
          width: penWidth,
          size: selectedPenSize,
        };
        setAnnotationObjects((prev) => [...prev, newPenStroke]);
        actionTaken = true;
      }
      setCurrentPenStrokePoints([]); // Clear SCALED points list
      penLastRelativePosRef.current = null; // Clear DEDICATED pen relative ref
      // --- Pen Tool End ---
    } else if (toolUsed === "arrow" && initialRelativePos && initialScaledPos) {
      // --- Arrow Finalize (MODIFIED) ---
      // Instead, create the annotation object
      const newArrow: ArrowAnnotation = {
        id: `arrow-${Date.now()}-${Math.random()}`,
        type: "arrow",
        startX: initialScaledPos.x, // Use SCALED start from mouseDown
        startY: initialScaledPos.y,
        endX: finalScaledPos.x, // Use SCALED end from mouseUp
        endY: finalScaledPos.y,
        color: penColor,
        width: penWidth,
        size: selectedPenSize, // Store the selected size ('s', 'm', 'l')
      };

      // Update state (will trigger rerender via useEffect)
      setAnnotationObjects((prev) => [...prev, newArrow]);
      actionTaken = true; // Mark action for history
      console.log("Created ArrowAnnotation.");

      relativeStartPosRef.current = null; // Clear the general relative start ref
      // --- Arrow Finalize End ---
    } else if (
      toolUsed === "text-dragging" &&
      initialRelativePos &&
      initialScaledPos
    ) {
      // Use initial values
      // --- Text Drag Finalize ---
      const relativeBounds = getRectBounds(
        initialRelativePos,
        finalRelativePos
      );
      const scaledBounds = getRectBounds(initialScaledPos, finalScaledPos); // Use SCALED start/end

      const textX = Math.max(0, relativeBounds.x);
      const textY = Math.max(0, relativeBounds.y);
      const minWidth = 30;
      const minHeight = textSizeValues[selectedTextSize] * 1.2 + 4;
      const finalWidth = Math.max(relativeBounds.width, minWidth);
      const finalHeight = Math.max(relativeBounds.height, minHeight);
      const drawX = Math.max(0, scaledBounds.x);
      const drawY = Math.max(0, scaledBounds.y);

      setTextPosition({ x: textX, y: textY });
      setTextAreaSize({ width: finalWidth, height: finalHeight });
      setFinalTextDrawPosition({ x: drawX, y: drawY });
      setCurrentTextValue("");
      setIsPlacingText(true);
      setSelectedTool("text");
      setTimeout(() => textInputRef.current?.focus(), 0);
      relativeStartPosRef.current = null; // Clear the general relative start ref
      // --- Text Drag Finalize End ---
    } else if (
      (toolUsed === "blur-dragging" || toolUsed === "blur") &&
      initialRelativePos
    ) {
      if (blurMode === "invert") {
        // --- Invert Blur Finalize (Object creation - this part was applied correctly) ---
        if (imageElementRef.current && initialScaledPos && finalScaledPos) {
          const bounds = getRectBounds(initialScaledPos, finalScaledPos);
          if (bounds.width > 0 && bounds.height > 0) {
            const newBlur: BlurAnnotation = {
              id: `blur-${Date.now()}-${Math.random()}`,
              type: "blur",
              mode: "invert",
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
            };
            setAnnotationObjects((prev) => [...prev, newBlur]);
            actionTaken = true;
            console.log("Created BlurAnnotation (invert).");
          } else {
            console.warn("Blur (invert) skipped: zero width/height bounds.");
          }
        } else {
          console.warn(
            "Blur (invert) skipped: missing image or scaled positions."
          );
        }
      } else if (blurMode === "spot") {
        // --- Spot Blur Finalize (RE-APPLYING THIS BLOCK) ---
        if (currentSpotBlurPoints.length > 0) {
          // Check if any points were actually added
          const brushSize = Math.max(6, penWidth * 3); // Calculate brush size used
          const newSpotBlur: BlurAnnotation = {
            id: `blur-${Date.now()}-${Math.random()}`,
            type: "blur",
            mode: "spot",
            points: [...currentSpotBlurPoints], // Store collected SCALED points
            brushSize: brushSize,
            // x, y, width, height are not used for spot mode path
          };
          setAnnotationObjects((prev) => [...prev, newSpotBlur]);
          actionTaken = true;
          console.log(
            `Created BlurAnnotation (spot) with ${currentSpotBlurPoints.length} points.`
          );
        }
        setCurrentSpotBlurPoints([]); // Clear the points list
        // --- Spot Blur Finalize End ---
      }

      if (toolUsed === "blur-dragging") {
        setSelectedTool("blur");
      } // Revert state
      relativeStartPosRef.current = null; // Clear relative start ref
    }

    // --- Clear Preview Canvas ---
    if (previewCanvasRef.current) {
      const previewCtx = previewCanvasRef.current.getContext("2d");
      previewCtx?.clearRect(
        0,
        0,
        previewCanvasRef.current.width,
        previewCanvasRef.current.height
      );
    }

    // --- Save History ---
    if (actionTaken) {
      console.log(`Saving history after ${toolUsed} action.`);
      setHistory((prevHistory) => {
        // Use a *copy* of the state as it is NOW (before potential subsequent updates)
        const currentAnnotationState = [...annotationObjects];
        const newHistory = [...prevHistory, currentAnnotationState];
        if (newHistory.length > maxHistory + 1) {
          return newHistory.slice(newHistory.length - (maxHistory + 1));
        }
        return newHistory;
      });
    }

    // --- General Cleanup ---
    setLastPosition(null); // Clear SCALED position state
    // relativeStartPosRef and penLastRelativePosRef cleared in specific tool logic above
    canvasRectRef.current = null; // Clear cached rect
    canvasScaleRef.current = null; // Clear cached scale
    lastThrottledDrawTimeRef.current = 0; // Reset throttle timer
  };

  // Helper to get RELATIVE coordinates (needed for text-dragging finalize)
  const getRelativeCoordinates = (
    event: React.MouseEvent<HTMLCanvasElement>,
    rect: DOMRect | null,
    container: HTMLDivElement | null
  ): { x: number; y: number } | null => {
    if (!rect || !container) return null;
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;
    const relativeX = event.clientX - rect.left + scrollLeft;
    const relativeY = event.clientY - rect.top + scrollTop;
    return { x: relativeX, y: relativeY };
  };

  // --- Update handleCanvasMouseLeave ---
  const handleCanvasMouseLeave = (
    event: React.MouseEvent<HTMLCanvasElement>
  ) => {
    if (isDrawing) {
      // ... Clear preview logic ...
      // ... Revert dragging states ...
      // Cleanup
      setIsDrawing(false);
      setLastPosition(null);
      relativeStartPosRef.current = null;
      lastThrottledDrawTimeRef.current = 0;
      canvasRectRef.current = null;
      canvasScaleRef.current = null;
      setFinalTextDrawPosition(null); // *** Clear scaled draw pos on leave ***
      console.log("Cleared Rect & Scale refs on leave");
    }
  };

  const handleQuit = () => {
    window.electronAPI.quitApp();
  };

  // Style function for the text area (Transparent Background)
  const getTextAreaStyle = (): DraggableCSSProperties | undefined => {
    if (!isPlacingText || !textPosition || !textAreaSize) return undefined;

    const container = canvasContainerRef.current;
    if (!container) return undefined;

    console.log(
      "getTextAreaStyle using position:",
      textPosition,
      "size:",
      textAreaSize,
      "font:",
      textFont
    );

    return {
      position: "absolute",
      left: `${textPosition.x}px`,
      top: `${textPosition.y}px`,
      width: `${textAreaSize.width}px`,
      height: `${textAreaSize.height}px`,
      border: "none", // Remove border
      padding: "2px",
      backgroundColor: "transparent", // Make background transparent
      color: penColor,
      font: textFont,
      zIndex: 10,
      WebkitAppRegion: "no-drag",
      resize: "none",
      overflow: "hidden",
      boxSizing: "border-box",
      outline: "none", // Remove focus outline
    };
  };

  // --- Update Text Font based on Size Selection ---
  useEffect(() => {
    setTextFont(`${textSizeValues[selectedTextSize]}px sans-serif`);
  }, [selectedTextSize]);

  // --- NEW: Screen Recording Handlers ---
  const handleStartRecording = async () => {
    // Clear previous captures or recordings first
    setCapturedDataUrl(null);
    setAnnotationObjects([]);
    setHistory([[]]);
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }

    setMessage("Requesting screen access...");
    try {
      // --- Diagnostics ---
      console.log("Checking navigator.mediaDevices...");
      if (navigator.mediaDevices) {
        console.log("navigator.mediaDevices found.");
        console.log("navigator.mediaDevices.getDisplayMedia exists:", typeof navigator.mediaDevices.getDisplayMedia === "function");
        console.log("navigator.mediaDevices.getUserMedia exists:", typeof navigator.mediaDevices.getUserMedia === "function");

        // Test getUserMedia (requesting audio/mic)
        try {
          console.log("Attempting getUserMedia (mic test)...");
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log("getUserMedia (mic test) successful!");
          micStream.getTracks().forEach(track => track.stop()); // Stop the test stream immediately
        } catch (gumError) {
          console.error("getUserMedia (mic test) failed:", gumError);
          setMessage(`Mic access test failed: ${gumError.message}`);
          // Don't necessarily stop here, still attempt getDisplayMedia
        }
      } else {
        console.error("navigator.mediaDevices is NOT found!");
        setMessage("Error: MediaDevices API not available.");
        return; // Cannot proceed
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Simplest video request
        // video: { cursor: "always" } as MediaTrackConstraints, // Temporarily disable cursor constraint
        // audio: true, // Temporarily disable audio request
      });

      mediaStreamRef.current = stream; // Store stream to stop tracks later
      recordedChunksRef.current = []; // Reset chunks

      // Define options - try common codecs, browser might fall back
      const mimeTypes = [
        "video/webm; codecs=vp9",
        "video/webm; codecs=vp8",
        "video/webm",
        "video/mp4", // Less likely to be supported directly by MediaRecorder
      ];
      const supportedMimeType = mimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      console.log("Using mimeType:", supportedMimeType);
      const options = supportedMimeType
        ? { mimeType: supportedMimeType }
        : undefined;

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        console.log("Recording stopped, processing data...");
        const blobMimeType = supportedMimeType || "video/webm"; // Use the type we recorded with or default
        const blob = new Blob(recordedChunksRef.current, {
          type: blobMimeType,
        });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setMessage("Recording finished. Video available below.");
        // Clean up refs
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        mediaStreamRef.current = null; // Stream should be stopped already by track.onended or handleStopRecording
      };

      // Handle stream ending unexpectedly (e.g., user clicks browser's stop sharing button)
      stream.getVideoTracks()[0].onended = () => {
        console.log("Video stream ended by user or system.");
        // Check recorder state before trying to stop again
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording"
        ) {
          handleStopRecording(); // Trigger our stop logic
        }
      };

      recorder.start();
      setIsRecording(true);
      setMessage("Recording started! Click 'Stop Recording' to finish.");
    } catch (error) {
      console.error("Error starting screen recording:", error);
      // Check for AbortError or NotAllowedError (user cancelled/denied screen selection)
      if (error.name === "NotAllowedError" || error.name === "AbortError") {
        setMessage("Screen recording request cancelled or denied.");
      } else {
        setMessage(`Error starting recording: ${error.message}`);
      }
      setIsRecording(false);
      // Clean up potentially partially set refs
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    }
  };

  const handleStopRecording = () => {
    console.log("Stopping recording manually...");
    // Check state before stopping
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop(); // This triggers the onstop handler eventually
    }
    // Stop the stream tracks regardless, in case stop() didn't trigger onended or recorder failed
    if (mediaStreamRef.current) {
      console.log("Stopping media stream tracks...");
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null; // Clear ref after stopping
    }
    setIsRecording(false); // Update UI immediately
    // Message update happens in recorder.onstop
  };

  const handleSaveRecording = async () => {
    if (!recordedVideoUrl) {
      setMessage("No video to save.");
      return;
    }

    setMessage("Preparing video for saving...");
    try {
      // 1. Fetch the Blob data from the Object URL
      const response = await fetch(recordedVideoUrl);
      const blob = await response.blob();

      // 2. Convert Blob to ArrayBuffer (needed for Buffer conversion)
      const arrayBuffer = await blob.arrayBuffer();

      // 3. Convert ArrayBuffer to Node.js Buffer (suitable for saving)
      //    We send the ArrayBuffer directly via IPC, main process converts to Buffer
      console.log(
        `Sending video data (${arrayBuffer.byteLength} bytes) to main process...`
      );

      // 4. Invoke IPC handler in main process
      const result = await window.electronAPI.saveVideo(arrayBuffer);

      if (result.success) {
        setMessage(`Video saved successfully to: ${result.filePath}`);
      } else {
        setMessage(`Failed to save video: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error saving video:", error);
      setMessage(`Error saving video: ${error.message}`);
    }
  };
  // --- End Screen Recording Handlers ---

  // --- Component Return ---
  return (
    <div
      style={
        {
          padding: "10px",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          borderRadius: "5px",
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 20px)",
          WebkitAppRegion: "drag",
        } as DraggableCSSProperties
      }
    >
      {" "}
      {/* Flex column layout */}
      {/* Top section with capture buttons */}
      <div
        style={
          {
            marginBottom: "10px",
            display: "flex",
            gap: "5px",
            flexWrap: "wrap",
            WebkitAppRegion: "no-drag", // Mark button bar non-draggable
          } as DraggableCSSProperties
        }
      >
        {" "}
        {/* Allow wrapping */}
        <button style={buttonStyle} onClick={() => handleCapture("fullscreen")}>
          Fullscreen
        </button>
        <button
          style={buttonStyleMargin}
          onClick={() => handleCapture("region")}
        >
          Region
        </button>
        {/* Placeholder for Annotation Tools */}
        <span style={{ marginLeft: "15px" }}>Tools:</span>
        <button
          style={{
            ...buttonStyle,
            backgroundColor: selectedTool === "pen" ? "lightblue" : undefined,
          }}
          onClick={() => handleToolSelect("pen")}
        >
          Pen
        </button>
        <button
          style={{
            ...buttonStyle,
            backgroundColor: selectedTool === "arrow" ? "lightblue" : undefined,
          }}
          onClick={() => handleToolSelect("arrow")}
        >
          Arrow
        </button>
        {/* Add Text button */}
        <button
          style={{
            ...buttonStyle,
            backgroundColor: selectedTool === "text" ? "lightblue" : undefined,
          }}
          onClick={() => handleToolSelect("text")}
        >
          Text
        </button>
        {/* Add Blur button */}
        <button
          style={{
            ...buttonStyle,
            backgroundColor: selectedTool === "blur" ? "lightblue" : undefined,
          }}
          onClick={() => handleToolSelect("blur")}
        >
          Blur
        </button>
        {/* --- NEW: Select Tool Button --- */}
        <button
          style={{
            ...buttonStyle,
            backgroundColor:
              selectedTool === "select" ? "lightblue" : undefined,
          }}
          onClick={() => handleToolSelect("select")}
          title="Select/Move Annotation (WIP)"
        >
          Select
        </button>
        {/* --- NEW: Record Screen Buttons (Conditional) --- */}
        {!isRecording ? (
          <button
            style={buttonStyleMargin}
            onClick={() => handleStartRecording()} // We will define this function next
            title="Record Screen (Video)"
            disabled={!!capturedDataUrl || !!recordedVideoUrl} // Disable if image captured or video recorded
          >
            Record Screen
          </button>
        ) : (
          <button
            style={{
              ...buttonStyleMargin,
              backgroundColor: "red",
              color: "white",
            }}
            onClick={handleStopRecording} // We will define this function next
            title="Stop Recording"
          >
            Stop Recording
          </button>
        )}
        {/* --- End Record Screen Buttons --- */}
        {/* --- BLUR MODE SUB-BUTTONS (Conditional) --- */}
        {selectedTool === "blur" && (
          <>
            <button
              style={{
                ...buttonStyleMargin,
                backgroundColor: blurMode === "spot" ? "lightgreen" : undefined,
              }}
              onClick={() => setBlurMode("spot")}
              title="Spot Blur (Paint)"
            >
              Spot
            </button>
            <button
              style={{
                ...buttonStyle,
                backgroundColor:
                  blurMode === "invert" ? "lightgreen" : undefined,
              }}
              onClick={() => setBlurMode("invert")}
              title="Invert Blur (Highlight Area)"
            >
              Highlight
            </button>
          </>
        )}
        {/* --- End Blur Mode --- */}
        {/* Add color picker later */}
        <input
          type="color"
          value={penColor}
          onChange={(e) => setPenColor(e.target.value)}
          style={{ WebkitAppRegion: "no-drag" } as any} // Basic color picker
          title="Select Pen Color"
        />
        {/* Pen Size Buttons */}
        {selectedTool === "pen" && (
          <span style={{ marginLeft: "10px", marginRight: "5px" }}>
            Pen Size:
          </span>
        )}
        {selectedTool === "pen" &&
          (["s", "m", "l"] as PenSize[]).map((size) => (
            <button
              key={`pen-${size}`}
              style={{
                ...buttonStyle,
                minWidth: "30px",
                backgroundColor:
                  selectedPenSize === size ? "lightblue" : undefined,
              }}
              onClick={() => handlePenSizeSelect(size)}
              title={`Pen Size ${size.toUpperCase()} (${
                penSizeValues[size]
              }px)`}
            >
              {size.toUpperCase()}
            </button>
          ))}
        {/* Arrow Size Buttons */}
        {selectedTool === "arrow" && (
          <span style={{ marginLeft: "10px", marginRight: "5px" }}>
            Arrow Size:
          </span>
        )}
        {selectedTool === "arrow" &&
          (["s", "m", "l"] as PenSize[]).map((size) => (
            <button
              key={`arrow-${size}`}
              style={{
                ...buttonStyle,
                minWidth: "30px",
                backgroundColor:
                  selectedPenSize === size ? "lightblue" : undefined,
              }}
              onClick={() => handlePenSizeSelect(size)}
              title={`Arrow Size ${size.toUpperCase()} (${
                penSizeValues[size]
              }px)`}
            >
              {size.toUpperCase()}
            </button>
          ))}
        {/* Text Size Buttons */}
        {selectedTool === "text" && (
          <span style={{ marginLeft: "10px", marginRight: "5px" }}>
            Text Size:
          </span>
        )}
        {selectedTool === "text" &&
          (["s", "m", "l"] as PenSize[]).map((size) => (
            <button
              key={`text-${size}`}
              style={{
                ...buttonStyle,
                minWidth: "30px",
                backgroundColor:
                  selectedTextSize === size ? "lightblue" : undefined,
              }}
              onClick={() => handleTextSizeSelect(size)}
              title={`Text Size ${size.toUpperCase()} (${
                textSizeValues[size]
              }px)`}
            >
              {size.toUpperCase()}
            </button>
          ))}
        {/* Add Undo Button */}
        <button
          style={buttonStyleMargin}
          onClick={handleUndo}
          disabled={history.length <= 1} // Disable if only base image exists
          title="Undo Last Annotation"
        >
          Undo
        </button>
      </div>
      {/* Message Area - should be non-draggable */}
      <p
        style={
          {
            flexShrink: 0,
            WebkitAppRegion: "no-drag",
          } as DraggableCSSProperties
        }
      >
        {message}
      </p>
      {/* --- NEW: Video Preview Area (Conditional) --- */}
      {recordedVideoUrl && (
        <div style={{ flexGrow: 1, border: "1px solid green", padding: "5px" }}>
          <video
            src={recordedVideoUrl}
            controls
            style={{ width: "100%", maxHeight: "400px" }}
          />
          <button
            style={buttonStyleMargin}
            onClick={() => {
              setRecordedVideoUrl(null); // Clear video
              URL.revokeObjectURL(recordedVideoUrl); // Release memory
              setMessage("Recording cleared.");
            }}
          >
            Clear Recording
          </button>
          <button
            style={buttonStyleMargin}
            onClick={handleSaveRecording} // Add handler here
          >
            Save Recording
          </button>
          {/* TODO: Add button to maybe capture first frame for annotation? */}
        </div>
      )}
      {/* Canvas Display Area - Hide if video is showing */}
      {!recordedVideoUrl && (
        <div ref={canvasContainerRef} style={canvasContainerStyle}>
          {/* Main Canvas */}
          <canvas
            ref={canvasRef}
            style={canvasStyle}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
          />
          {/* Preview Canvas */}
          <canvas ref={previewCanvasRef} style={previewCanvasStyle} />

          {/* Text Area MOVED INSIDE canvas container div */}
          {isPlacingText && textPosition && (
            <textarea
              ref={textInputRef}
              value={currentTextValue}
              onChange={(e) => {
                setCurrentTextValue(e.target.value);
              }}
              onBlur={finalizeText}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  finalizeText();
                  e.preventDefault();
                }
              }}
              style={getTextAreaStyle()}
            />
          )}
        </div>
      )}
      {/* Quit Button remains outside canvas container */}
      <button style={quitButtonStyle} onClick={handleQuit}>
        Quit
      </button>
    </div>
  );
};

export default App;
