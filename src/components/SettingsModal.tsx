import React, { useState, useEffect } from "react";
// import type { AppSettings } from "../manualSettingsStore"; // Old import
import type { AppSettings, Tool, PenSize } from "../types"; // Corrected import for AppSettings

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings | null; // Prop can be AppSettings or null if not yet loaded
  onSave: (settingsToUpdate: Partial<AppSettings>) => Promise<void>;
  onReset: () => Promise<void>;
}

// No need for local defaults if parent handles reset correctly
// const defaults: AppSettings = { ... };

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings, // <-- Use renamed prop
  onSave,
  onReset,
}) => {
  // Use AppSettings directly, but allow partial for edits
  const [localSettings, setLocalSettings] = useState<Partial<AppSettings>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Initialize local state when the modal opens or settings change
  useEffect(() => {
    if (isOpen && settings) {
      setLocalSettings(settings); // settings is AppSettings | null, localSettings is Partial<AppSettings>
      // This assignment is fine as AppSettings is assignable to Partial<AppSettings>
    } else if (!isOpen) {
      setLocalSettings({}); // Clear local state when closed
    }
  }, [isOpen, settings]);

  if (!isOpen || !settings) {
    return null; // Don't render if not open or settings not loaded
  }

  // Generic input handler
  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = event.target;
    const settingKey = name as keyof AppSettings; // Type assertion

    let processedValue: string | number | boolean = value;

    if (type === "checkbox") {
      processedValue = (event.target as HTMLInputElement).checked;
    } else if (type === "number") {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        processedValue = numValue;
      } else if (value === "") {
        processedValue = "";
      } else {
        processedValue = value;
      }
    }

    setLocalSettings((prev: Partial<AppSettings>) => ({
      // Explicitly type prev
      ...prev,
      [settingKey]: processedValue,
    }));
  };

  // Validate and clamp jpegQuality on blur
  const handleJpegQualityBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    if (name === "jpegQuality") {
      let finalValue: number;
      const numValue = parseInt(value, 10);

      if (value.trim() === "" || isNaN(numValue)) {
        finalValue = settings?.jpegQuality ?? 90;
      } else {
        finalValue = Math.max(1, Math.min(100, numValue));
      }
      setLocalSettings((prev: Partial<AppSettings>) => ({
        ...prev,
        jpegQuality: finalValue,
      })); // Explicitly type prev
    }
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    const changes: Partial<AppSettings> = {};

    // Compare local state to the original settings from props
    for (const key of Object.keys(settings) as Array<keyof AppSettings>) {
      // Ensure jpegQuality is treated as a number after validation
      const localValue =
        key === "jpegQuality"
          ? Number(localSettings.jpegQuality) // Convert validated value to number
          : localSettings[key];

      const originalValue = settings[key];

      // Add to changes if the value is different and exists in localSettings
      if (localValue !== undefined && localValue !== originalValue) {
        // Need to handle potential type mismatch if input wasn't fully validated
        // We trust that handleInputChange and handleJpegQualityBlur managed types correctly
        (changes as any)[key] = localValue;
      }
    }

    if (Object.keys(changes).length > 0) {
      console.log("Saving settings changes:", changes);
      try {
        await onSave(changes);
        onClose(); // Close modal after successful save
      } catch (error) {
        console.error("Failed to save settings:", error);
        // Optionally show an error message to the user here
      }
    } else {
      console.log("No changes detected.");
      onClose(); // Close modal even if no changes
    }
    setIsSaving(false);
  };

  const handleResetClick = async () => {
    setIsResetting(true);
    try {
      await onReset();
      // Parent handles resetting, props will update, useEffect updates local state
    } catch (error) {
      console.error("Failed to reset settings:", error);
    }
    setIsResetting(false);
    // Keep modal open after reset to show defaults
    // Optionally focus first element or show message
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "5px",
    fontWeight: "bold",
  };

  const inputGroupStyle: React.CSSProperties = {
    marginBottom: "15px",
  };

  const inputStyle: React.CSSProperties = {
    display: "block",
    width: "95%",
    padding: "8px",
    marginBottom: "5px",
    border: "1px solid #ccc",
    borderRadius: "4px",
  };

  const checkboxLabelStyle: React.CSSProperties = {
    marginLeft: "5px",
    fontWeight: "normal",
  };

  const colorInputStyle: React.CSSProperties = {
    ...inputStyle,
    padding: "2px",
    height: "30px",
    cursor: "pointer",
    width: "50px",
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000, // Ensure it's on top
  };

  const modalContentStyle: React.CSSProperties = {
    background: "#fff",
    padding: "20px",
    borderRadius: "8px",
    minWidth: "400px",
    maxWidth: "90%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
    color: "#333", // Dark text for readability
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "20px",
    paddingTop: "10px",
    borderTop: "1px solid #eee",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "8px 15px",
    marginLeft: "10px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  };

  const saveButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#007bff",
    color: "white",
  };

  const resetButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#ffc107",
    color: "black",
    marginRight: "auto", // Push reset to the left
  };

  const cancelButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: "#6c757d",
    color: "white",
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2
          style={{
            marginTop: 0,
            marginBottom: "20px",
            borderBottom: "1px solid #eee",
            paddingBottom: "10px",
          }}
        >
          Settings
        </h2>

        {/* Save Format */}
        <div style={inputGroupStyle}>
          <label style={labelStyle} htmlFor="saveFormat">
            Default Save Format
          </label>
          <select
            id="saveFormat"
            name="saveFormat"
            style={inputStyle}
            value={String(localSettings.saveFormat ?? "png")}
            onChange={handleInputChange}
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
        </div>

        {/* JPEG Quality (Conditional) */}
        {localSettings.saveFormat === "jpg" && (
          <div style={inputGroupStyle}>
            <label style={labelStyle} htmlFor="jpegQuality">
              JPEG Quality (1-100)
            </label>
            <input
              type="number"
              id="jpegQuality"
              name="jpegQuality"
              style={inputStyle}
              value={String(localSettings.jpegQuality ?? 90)}
              onChange={handleInputChange}
              onBlur={handleJpegQualityBlur}
              min="1"
              max="100"
              step="1"
            />
          </div>
        )}

        {/* Capture Options */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Capture Options</label>
          <div>
            <input
              type="checkbox"
              id="captureIncludeCursor"
              name="captureIncludeCursor"
              checked={!!localSettings.captureIncludeCursor}
              onChange={handleInputChange}
            />
            <label htmlFor="captureIncludeCursor" style={checkboxLabelStyle}>
              Include Cursor in Screenshots
            </label>
          </div>
          <div style={{ marginTop: "5px" }}>
            <input
              type="checkbox"
              id="captureAutoCopyToClipboard"
              name="captureAutoCopyToClipboard"
              checked={!!localSettings.captureAutoCopyToClipboard}
              onChange={handleInputChange}
            />
            <label
              htmlFor="captureAutoCopyToClipboard"
              style={checkboxLabelStyle}
            >
              Automatically Copy to Clipboard After Capture
            </label>
          </div>
        </div>

        {/* Default Pen */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Pen Tool Defaults</label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ marginRight: "15px" }}>
              <label
                style={{ ...labelStyle, marginBottom: "2px" }}
                htmlFor="defaultPenColor"
              >
                Color
              </label>
              <input
                type="color"
                id="defaultPenColor"
                name="defaultPenColor"
                style={colorInputStyle}
                value={String(localSettings.defaultPenColor ?? "#FF0000")}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label
                style={{ ...labelStyle, marginBottom: "2px" }}
                htmlFor="defaultPenSize"
              >
                Size
              </label>
              <select
                id="defaultPenSize"
                name="defaultPenSize"
                style={inputStyle}
                value={String(localSettings.defaultPenSize ?? "m")}
                onChange={handleInputChange}
              >
                <option value="s">Small</option>
                <option value="m">Medium</option>
                <option value="l">Large</option>
              </select>
            </div>
          </div>
        </div>

        {/* Default Text */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Text Tool Defaults</label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ marginRight: "15px" }}>
              <label
                style={{ ...labelStyle, marginBottom: "2px" }}
                htmlFor="defaultTextColor"
              >
                Color
              </label>
              <input
                type="color"
                id="defaultTextColor"
                name="defaultTextColor"
                style={colorInputStyle}
                value={String(localSettings.defaultTextColor ?? "#FF0000")}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label
                style={{ ...labelStyle, marginBottom: "2px" }}
                htmlFor="defaultTextSize"
              >
                Size
              </label>
              <select
                id="defaultTextSize"
                name="defaultTextSize"
                style={inputStyle}
                value={String(localSettings.defaultTextSize ?? "m")}
                onChange={handleInputChange}
              >
                <option value="s">Small</option>
                <option value="m">Medium</option>
                <option value="l">Large</option>
              </select>
            </div>
          </div>
        </div>

        {/* Default Highlighter */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Highlighter Tool Defaults</label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ marginRight: "15px" }}>
              <label
                style={{ ...labelStyle, marginBottom: "2px" }}
                htmlFor="defaultHighlighterColor"
              >
                Color
              </label>
              <input
                type="color"
                id="defaultHighlighterColor"
                name="defaultHighlighterColor"
                style={colorInputStyle}
                value={String(
                  localSettings.defaultHighlighterColor ?? "#FF0000"
                )}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label
                style={{ ...labelStyle, marginBottom: "2px" }}
                htmlFor="defaultHighlighterSize"
              >
                Size
              </label>
              <select
                id="defaultHighlighterSize"
                name="defaultHighlighterSize"
                style={inputStyle}
                value={String(localSettings.defaultHighlighterSize ?? "m")}
                onChange={handleInputChange}
              >
                <option value="s">Small</option>
                <option value="m">Medium</option>
                <option value="l">Large</option>
              </select>
            </div>
          </div>
        </div>

        {/* Default Step Tool */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Step Tool Defaults</label>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ marginRight: "15px" }}>
              <label
                style={{ ...labelStyle, marginBottom: "2px" }}
                htmlFor="defaultStepColor"
              >
                Color
              </label>
              <input
                type="color"
                id="defaultStepColor"
                name="defaultStepColor"
                style={colorInputStyle}
                value={String(localSettings.defaultStepColor ?? "#FF0000")}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label
                style={{ ...labelStyle, marginBottom: "2px" }}
                htmlFor="defaultStepSize"
              >
                Size
              </label>
              <select
                id="defaultStepSize"
                name="defaultStepSize"
                style={inputStyle}
                value={String(localSettings.defaultStepSize ?? "m")}
                onChange={handleInputChange}
              >
                <option value="s">Small</option>
                <option value="m">Medium</option>
                <option value="l">Large</option>
              </select>
            </div>
          </div>
        </div>

        {/* Default Tool Selection */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Default Tool</label>
          <div style={{ marginBottom: "10px" }}>
            <label
              style={{ ...labelStyle, marginBottom: "2px" }}
              htmlFor="defaultTool"
            >
              Tool to Start With
            </label>
            <select
              id="defaultTool"
              name="defaultTool"
              style={inputStyle}
              value={localSettings.defaultTool ?? "pen"}
              onChange={handleInputChange}
            >
              <option value="pen">Pen (Recommended)</option>
              <option value="arrow">Arrow</option>
              <option value="text">Text</option>
              <option value="highlighter">Highlighter</option>
              <option value="rectangle">Rectangle</option>
              <option value="ellipse">Ellipse</option>
              <option value="step">Step</option>
              <option value="blur">Blur</option>
            </select>
          </div>
        </div>

        {/* Default Blur Tool */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Blur Tool Defaults</label>
          <div style={{ marginBottom: "10px" }}>
            <label
              style={{ ...labelStyle, marginBottom: "2px" }}
              htmlFor="defaultBlurMode"
            >
              Default Mode
            </label>
            <select
              id="defaultBlurMode"
              name="defaultBlurMode"
              style={inputStyle}
              value={localSettings.defaultBlurMode ?? "focus"}
              onChange={handleInputChange}
            >
              <option value="focus">Focus Area</option>
              <option value="spot">Spot Blur</option>
            </select>
          </div>
          <div style={{ marginBottom: "10px" }}>
            <label
              style={{ ...labelStyle, marginBottom: "2px" }}
              htmlFor="defaultBlurStrength"
            >
              Blur Strength ({localSettings.defaultBlurStrength ?? 5})
            </label>
            <input
              type="range"
              id="defaultBlurStrength"
              name="defaultBlurStrength"
              min="1"
              max="20"
              style={inputStyle}
              value={localSettings.defaultBlurStrength ?? 5}
              onChange={handleInputChange}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={buttonContainerStyle}>
          <button
            style={resetButtonStyle}
            onClick={handleResetClick}
            disabled={isSaving || isResetting}
          >
            {isResetting ? "Resetting..." : "Reset to Defaults"}
          </button>
          <button
            style={cancelButtonStyle}
            onClick={onClose}
            disabled={isSaving || isResetting}
          >
            Cancel
          </button>
          <button
            style={saveButtonStyle}
            onClick={handleSaveClick}
            disabled={isSaving || isResetting}
          >
            {isSaving ? "Saving..." : "Save & Close"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
