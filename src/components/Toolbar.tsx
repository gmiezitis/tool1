import React from "react";
// Import shared types and styles
import type { Tool, PenSize, BlurMode } from "../types";
import {
  penSizeValues,
  textSizeValues,
  highlighterSizeValues,
} from "../styles";
// Import DraggableCSSProperties
import type { DraggableCSSProperties } from "../types";

// Props expected by the Toolbar component
interface ToolbarProps {
  // Capture handlers
  onFullscreenCapture: () => void; // Use specific names now
  onRegionCapture: () => void;
  onWindowCapture: () => void;
  // Recording state and handlers
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void; // Add stop recording handler prop
  // Selected tool state and handler
  selectedTool: Tool;
  onToolSelect: (tool: Tool) => void;
  // Blur mode state and handler (if blur tool selected)
  selectedBlurMode: BlurMode; // Rename for consistency
  onBlurModeChange: (mode: BlurMode) => void;
  // Color state and handler (for pen, arrow, shapes, step)
  penColor: string;
  onPenColorChange: (color: string) => void;
  // --- REMOVE Highlighter Color Props (Assuming penColor is used) ---
  // highlighterColor: string;
  // onHighlighterColorChange: (color: string) => void;
  // --- Highlighter Color ---
  highlighterColor: string;
  onHighlighterColorChange: (color: string) => void;
  // --- Step Color ---
  stepColor: string;
  onStepColorChange: (color: string) => void;
  // Pen/Shape size state and handler
  selectedPenSize: PenSize;
  onPenSizeSelect: (size: PenSize) => void; // Rename for consistency
  // Text size state and handler
  selectedTextSize: PenSize;
  onTextSizeSelect: (size: PenSize) => void; // Rename for consistency
  // --- REMOVE sizePreviewStyle prop (calculate internally if needed) ---
  // sizePreviewStyle: React.CSSProperties;
  // Text color state and handler
  textColor: string;
  onTextColorChange: (color: string) => void;
  // Next step number for preview
  nextStepNumber?: number;
  // Action handlers
  onUndo: () => void;
  canUndo: boolean;
  onDelete: () => void;
  canDelete: boolean;
  onCopy: () => void;
  onSave: () => void; // Rename from onSaveAs
  // --- REMOVE canCopyOrSave prop (derive internally or simplify logic in App.tsx) ---
  // canCopyOrSave: boolean;
  // --- REMOVED Zoom props ---
  // zoomLevel: number;
  // onZoomIn: () => void;
  // onZoomOut: () => void;
  // onZoomReset: () => void;
  onOpenSettings: () => void;
  onQuit: () => void; // Add Quit handler prop
  selectedHighlighterSize: PenSize; // <<< NEW
  onHighlighterSizeSelect: (size: PenSize) => void; // <<< NEW
  selectedStepSize: PenSize;
  onStepSizeSelect: (size: PenSize) => void;
  isFullscreen: boolean;
  onClear: () => void; // Added to accept the onClear prop from App.tsx
  // Add blur strength props
  blurStrength?: number; // Optional if only needed for some blur modes
  onBlurStrengthChange?: (strength: number) => void; // Optional
}

// Helper function to create size preview style
const getSizePreviewStyle = (
  size: PenSize,
  color: string,
  type: "pen" | "text" | "step" | "highlighter"
): React.CSSProperties => {
  if (type === "text") {
    const dimension = textSizeValues[size];
    return {
      fontSize: `${Math.min(dimension, 16)}px`,
      color: color,
      fontWeight: "bold",
      padding: "2px 4px",
    };
  } else if (type === "highlighter") {
    const dimension = highlighterSizeValues[size];
    // Show a line sample for highlighter
    return {
      width: "20px",
      height: `${dimension}px`,
      backgroundColor: color,
      display: "inline-block",
      verticalAlign: "middle",
      marginLeft: "5px",
      opacity: 0.6,
      borderRadius: "1px",
    };
  } else {
    const dimension = penSizeValues[size];
    // Show a line sample for pen/step
    return {
      width: "20px",
      height: `${dimension}px`,
      backgroundColor: color,
      display: "inline-block",
      verticalAlign: "middle",
      marginLeft: "5px",
      borderRadius: `${dimension / 2}px`, // Rounded ends like pen stroke
    };
  }
};

const Toolbar: React.FC<ToolbarProps> = (props) => {
  const {
    // Destructure all props defined in the updated interface
    onFullscreenCapture,
    onRegionCapture,
    onWindowCapture,
    isRecording,
    onStartRecording,
    onStopRecording,
    selectedTool,
    onToolSelect,
    selectedBlurMode,
    onBlurModeChange,
    penColor,
    onPenColorChange,
    highlighterColor,
    onHighlighterColorChange,
    stepColor,
    onStepColorChange,
    selectedPenSize,
    onPenSizeSelect,
    selectedTextSize,
    onTextSizeSelect,
    textColor,
    onTextColorChange,
    nextStepNumber,
    onUndo,
    canUndo,
    onDelete,
    canDelete,
    onCopy,
    onSave,
    onOpenSettings,
    onQuit,
    selectedHighlighterSize,
    onHighlighterSizeSelect,
    selectedStepSize,
    onStepSizeSelect,
    isFullscreen,
    onClear,
    // Destructure blur strength props
    blurStrength,
    onBlurStrengthChange,
  } = props;

  // Modern glassmorphism toolbar styling
  const toolbarStyle: DraggableCSSProperties = {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    WebkitAppRegion: "no-drag",
    padding: "12px 16px",
    background:
      "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
    boxShadow: "0 4px 32px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1)",
    alignItems: "center",
    position: "relative",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  };

  // Modern button styling with subtle gradients
  const buttonStyle: DraggableCSSProperties = {
    WebkitAppRegion: "no-drag",
    margin: "0",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: "500",
    border: "1px solid rgba(203, 213, 225, 0.6)",
    borderRadius: "8px",
    cursor: "pointer",
    background:
      "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.8) 100%)",
    color: "#374151",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)",
    backdropFilter: "blur(8px)",
    userSelect: "none",
  };

  // Active button styling with accent colors
  const buttonStyleActive: DraggableCSSProperties = {
    ...buttonStyle,
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    borderColor: "#2563eb",
    color: "#ffffff",
    boxShadow:
      "0 4px 12px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(59, 130, 246, 0.2)",
    transform: "translateY(-1px)",
  };

  // Hover effects (applied via CSS-in-JS)
  const buttonHoverStyle: DraggableCSSProperties = {
    background:
      "linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(248, 250, 252, 0.95) 100%)",
    borderColor: "#3b82f6",
    transform: "translateY(-1px)",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08)",
  };

  // Modern input styling
  const inputStyle: DraggableCSSProperties = {
    WebkitAppRegion: "no-drag",
    marginLeft: "6px",
    border: "1px solid rgba(203, 213, 225, 0.6)",
    borderRadius: "6px",
    padding: "6px",
    width: "36px",
    height: "32px",
    verticalAlign: "middle",
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(8px)",
    cursor: "pointer",
    transition: "all 0.2s ease",
  };

  // Modern separator styling
  const separatorStyle: React.CSSProperties = {
    marginLeft: "12px",
    marginRight: "8px",
    width: "1px",
    height: "24px",
    background:
      "linear-gradient(to bottom, transparent 0%, rgba(203, 213, 225, 0.6) 50%, transparent 100%)",
    alignSelf: "center",
  };

  // Recording button special styling
  const recordingButtonStyle: DraggableCSSProperties = {
    ...buttonStyle,
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    borderColor: "#dc2626",
    color: "#ffffff",
    boxShadow:
      "0 4px 12px rgba(239, 68, 68, 0.3), 0 2px 4px rgba(239, 68, 68, 0.2)",
    animation: "pulse 2s infinite",
  };

  // Determine if copy/save should be enabled
  const canCopyOrSave = true;

  return (
    <>
      {/* Add CSS animations */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
          
          .toolbar-button:hover {
            background: linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(248, 250, 252, 0.95) 100%) !important;
            border-color: #3b82f6 !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08) !important;
          }
          
          .toolbar-button:active {
            transform: translateY(0px) !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12) !important;
          }
          
          .toolbar-input:hover {
            border-color: #3b82f6 !important;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
          }
        `}
      </style>

      <div style={toolbarStyle}>
        {/* --- Capture Group --- */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            className="toolbar-button"
            style={buttonStyle}
            onClick={onFullscreenCapture}
            title="Capture Fullscreen"
          >
            📷 Fullscreen
          </button>
          <button
            className="toolbar-button"
            style={buttonStyle}
            onClick={() => {
              console.log("[Toolbar] Region button clicked");
              onRegionCapture();
            }}
            title="Capture Region"
          >
            ✂️ Region
          </button>
          <button
            className="toolbar-button"
            style={buttonStyle}
            onClick={onWindowCapture}
            title="Capture Window"
          >
            🪟 Window
          </button>
        </div>

        {/* --- Recording Group --- */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {!isRecording ? (
            <button
              className="toolbar-button"
              style={buttonStyle}
              onClick={onStartRecording}
              title="Start Screen Recording"
            >
              🎥 Record
            </button>
          ) : (
            <button
              className="toolbar-button"
              style={recordingButtonStyle}
              onClick={onStopRecording}
              title="Stop Screen Recording"
            >
              ⏹️ Stop
            </button>
          )}
        </div>

        {/* --- Tools Group --- */}
        <span style={separatorStyle}></span>
        <div
          style={{
            display: "flex",
            gap: "4px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {(
            [
              "pen",
              "arrow",
              "rectangle",
              "ellipse",
              "highlighter",
              "text",
              "step",
              "blur",
            ] as Tool[]
          ).map((tool) => (
            <button
              key={tool}
              className="toolbar-button"
              style={selectedTool === tool ? buttonStyleActive : buttonStyle}
              onClick={() => onToolSelect(tool)}
              title={`${tool.charAt(0).toUpperCase() + tool.slice(1)} Tool`}
            >
              {tool === "pen" && "✏️"}
              {tool === "arrow" && "↗️"}
              {tool === "rectangle" && "⬜"}
              {tool === "ellipse" && "⭕"}
              {tool === "highlighter" && "🖍️"}
              {tool === "text" && "📝"}
              {tool === "step" && "1️⃣"}
              {tool === "blur" && "🌫️"}
              <span style={{ marginLeft: "4px" }}>
                {tool.charAt(0).toUpperCase() + tool.slice(1)}
              </span>
            </button>
          ))}
        </div>

        {/* --- Tool Options Group --- */}
        <span style={separatorStyle}></span>

        {/* Color and Size Controls - Consistent for all tools that use them */}
        {["pen", "arrow", "rectangle", "ellipse"].includes(selectedTool) && (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <input
              className="toolbar-input"
              type="color"
              style={inputStyle}
              value={penColor}
              onChange={(e) => onPenColorChange(e.target.value)}
              title="Select Color"
            />
            {(["s", "m", "l"] as PenSize[]).map((size) => (
              <button
                key={size}
                className="toolbar-button"
                style={
                  selectedPenSize === size ? buttonStyleActive : buttonStyle
                }
                onClick={() => onPenSizeSelect(size)}
                title={`Size ${size.toUpperCase()}`}
              >
                {size.toUpperCase()}
                <span style={getSizePreviewStyle(size, penColor, "pen")} />
              </button>
            ))}
          </div>
        )}

        {/* Highlighter - Same style as other tools */}
        {selectedTool === "highlighter" && (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <input
              className="toolbar-input"
              type="color"
              style={inputStyle}
              value={highlighterColor}
              onChange={(e) => onHighlighterColorChange(e.target.value)}
              title="Select Color"
            />
            {(["s", "m", "l"] as PenSize[]).map((size) => (
              <button
                key={`highlighter-${size}`}
                className="toolbar-button"
                style={
                  selectedHighlighterSize === size
                    ? buttonStyleActive
                    : buttonStyle
                }
                onClick={() => onHighlighterSizeSelect(size)}
                title={`Size ${size.toUpperCase()}`}
              >
                {size.toUpperCase()}
                <span
                  style={getSizePreviewStyle(
                    size,
                    highlighterColor,
                    "highlighter"
                  )}
                />
              </button>
            ))}
          </div>
        )}

        {/* Text Tool - Same style as other tools */}
        {selectedTool === "text" && (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <input
              className="toolbar-input"
              type="color"
              style={inputStyle}
              value={textColor}
              onChange={(e) => onTextColorChange(e.target.value)}
              title="Select Color"
            />
            {(["s", "m", "l"] as PenSize[]).map((size) => (
              <button
                key={`text-${size}`}
                className="toolbar-button"
                style={
                  selectedTextSize === size ? buttonStyleActive : buttonStyle
                }
                onClick={() => onTextSizeSelect(size)}
                title={`Size ${size.toUpperCase()}`}
              >
                {size.toUpperCase()}
                <span style={getSizePreviewStyle(size, textColor, "text")} />
              </button>
            ))}
          </div>
        )}

        {/* Step Tool - Same style as other tools */}
        {selectedTool === "step" && (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <input
              className="toolbar-input"
              type="color"
              style={inputStyle}
              value={stepColor}
              onChange={(e) => onStepColorChange(e.target.value)}
              title="Select Color"
            />
            {(["s", "m", "l"] as PenSize[]).map((size) => (
              <button
                key={`step-${size}`}
                className="toolbar-button"
                style={
                  selectedStepSize === size ? buttonStyleActive : buttonStyle
                }
                onClick={() => onStepSizeSelect(size)}
                title={`Size ${size.toUpperCase()}`}
              >
                {size.toUpperCase()}
                <span style={getSizePreviewStyle(size, stepColor, "pen")} />
              </button>
            ))}
            <span
              style={{
                fontSize: "12px",
                marginLeft: "8px",
                color: "#64748b",
                fontWeight: "500",
              }}
            >
              Next: {nextStepNumber ?? 1}
            </span>
          </div>
        )}

        {/* Blur Tool - Keep current implementation but make it consistent */}
        {selectedTool === "blur" && (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <button
              className="toolbar-button"
              style={
                selectedBlurMode === "spot" ? buttonStyleActive : buttonStyle
              }
              onClick={() => onBlurModeChange("spot")}
              title="Spot Blur (Brush)"
            >
              🖌️ Spot
            </button>
            <button
              className="toolbar-button"
              style={
                selectedBlurMode === "focus" ? buttonStyleActive : buttonStyle
              }
              onClick={() => onBlurModeChange("focus")}
              title="Focus Area (Keeps selected area clear, blurs the rest)"
            >
              🎯 Focus
            </button>

            {/* Size controls for spot blur */}
            {selectedBlurMode === "spot" && (
              <>
                {(["s", "m", "l"] as PenSize[]).map((size) => (
                  <button
                    key={`blur-${size}`}
                    className="toolbar-button"
                    style={
                      selectedPenSize === size ? buttonStyleActive : buttonStyle
                    }
                    onClick={() => onPenSizeSelect(size)}
                    title={`Brush Size ${size.toUpperCase()}`}
                  >
                    {size.toUpperCase()}
                    <span style={getSizePreviewStyle(size, "#666", "pen")} />
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {/* --- Actions Group --- */}
        <span style={separatorStyle}></span>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <button
            className="toolbar-button"
            style={{
              ...buttonStyle,
              opacity: canUndo ? 1 : 0.5,
              cursor: canUndo ? "pointer" : "not-allowed",
            }}
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            className="toolbar-button"
            style={{
              ...buttonStyle,
              opacity: canDelete ? 1 : 0.5,
              cursor: canDelete ? "pointer" : "not-allowed",
            }}
            onClick={onDelete}
            disabled={!canDelete}
            title="Delete Selected"
          >
            🗑️ Delete
          </button>
          <button
            className="toolbar-button"
            style={buttonStyle}
            onClick={onClear}
            title="Clear All Annotations"
          >
            🧹 Clear
          </button>
        </div>

        {/* --- Save/Copy/Settings/Quit Group (Pushed to Right) --- */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "6px",
            alignItems: "center",
          }}
        >
          <button
            className="toolbar-button"
            style={{
              ...buttonStyle,
              opacity: canCopyOrSave ? 1 : 0.5,
              cursor: canCopyOrSave ? "pointer" : "not-allowed",
            }}
            onClick={onCopy}
            disabled={!canCopyOrSave}
            title="Copy to Clipboard (Ctrl+C)"
          >
            📋 Copy
          </button>
          <button
            className="toolbar-button"
            style={{
              ...buttonStyle,
              opacity: canCopyOrSave ? 1 : 0.5,
              cursor: canCopyOrSave ? "pointer" : "not-allowed",
            }}
            onClick={onSave}
            title="Save Screenshot (Ctrl+S)"
            disabled={!canCopyOrSave}
          >
            💾 Save
          </button>

          <span style={separatorStyle}></span>

          <button
            className="toolbar-button"
            style={buttonStyle}
            onClick={onOpenSettings}
            title="Settings"
          >
            ⚙️
          </button>
          <button
            className="toolbar-button"
            style={{
              ...buttonStyle,
              background: "linear-gradient(135deg, #f87171 0%, #ef4444 100%)",
              borderColor: "#ef4444",
              color: "#ffffff",
            }}
            onClick={onQuit}
            title="Quit Application"
          >
            ❌ Quit
          </button>
        </div>
      </div>
    </>
  );
};

export default Toolbar;
