import React, { useEffect, useState, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";

// Placeholder UI component for the capture window
const CaptureUI: React.FC = () => {
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(
    null
  );
  const selectionDivRef = useRef<HTMLDivElement>(null);

  // Function to send result and close window
  const sendResult = useCallback(
    (
      cancelled: boolean,
      bounds?: { x: number; y: number; width: number; height: number }
    ) => {
      window.captureAPI.sendSelectionResult({ cancelled, bounds });
      // Window will be closed by main process based on the message
    },
    []
  );

  // Calculate selection bounds
  const getSelectionBounds = useCallback(() => {
    if (!startPoint || !endPoint) return null;
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(startPoint.x - endPoint.x);
    const height = Math.abs(startPoint.y - endPoint.y);
    return { x, y, width, height };
  }, [startPoint, endPoint]);

  // --- Event Handlers ---
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // Prevent dragging background image if applicable
    event.preventDefault();
    setIsSelecting(true);
    setStartPoint({ x: event.clientX, y: event.clientY });
    setEndPoint({ x: event.clientX, y: event.clientY }); // Reset endpoint
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;
    setEndPoint({ x: event.clientX, y: event.clientY });
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting) return;
    setIsSelecting(false);
    const bounds = getSelectionBounds();
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      // Adjust for device scale factor if needed (more complex, skip for now)
      sendResult(false, bounds);
    } else {
      // If selection is too small or invalid, treat as cancel
      sendResult(true);
    }
  };

  // Handle Esc key press for cancellation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        sendResult(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sendResult]); // Ensure sendResult is stable or included

  // --- Receive Screenshot Data via IPC ---
  useEffect(() => {
    const handleData = (event: any, dataUrl: string) => {
      console.log("Received screenshot data via IPC.");
      setScreenshotUrl(dataUrl);
    };
    // Register listener using the API exposed by preload
    const cleanup = window.captureAPI.onScreenshotData(handleData);

    // Cleanup listener on component unmount
    return cleanup;
  }, []); // Run only once on mount

  // --- Update Selection Div Style ---
  useEffect(() => {
    if (isSelecting && selectionDivRef.current && startPoint && endPoint) {
      const bounds = getSelectionBounds();
      if (bounds) {
        selectionDivRef.current.style.left = `${bounds.x}px`;
        selectionDivRef.current.style.top = `${bounds.y}px`;
        selectionDivRef.current.style.width = `${bounds.width}px`;
        selectionDivRef.current.style.height = `${bounds.height}px`;
        selectionDivRef.current.style.display = "block";
      }
    } else if (selectionDivRef.current) {
      selectionDivRef.current.style.display = "none";
    }
  }, [isSelecting, startPoint, endPoint, getSelectionBounds]); // Added getSelectionBounds to dependencies

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundImage: screenshotUrl ? `url(${screenshotUrl})` : "none",
        backgroundSize: "cover",
        cursor: "crosshair",
        position: "relative",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Selection Rectangle */}
      <div
        ref={selectionDivRef}
        style={{
          position: "absolute",
          border: "2px dashed white",
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          display: "none",
          pointerEvents: "none",
        }}
      />

      {/* Loading indicator (optional) */}
      {!screenshotUrl && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <p style={{ color: "white", fontSize: "20px" }}>Loading...</p>
        </div>
      )}
    </div>
  );
};

// Find the root element
const rootElement = document.getElementById("capture-root");

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <CaptureUI />
    </React.StrictMode>
  );
} else {
  console.error("Capture root element not found!");
}
