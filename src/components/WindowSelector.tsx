import React, { useEffect, useState, useCallback } from "react";
// Attempt to force TypeScript to recognize global types
import type {} from "../preload.d";
import type { WindowSource } from "../types";

interface WindowSelectorProps {
  sources: WindowSource[];
  onSelect: (windowId: string) => void;
  onCancel: () => void;
}

const WindowSelector: React.FC<WindowSelectorProps> = ({
  sources,
  onSelect,
  onCancel,
}) => {
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);

  const handleSelectWindow = (windowId: string) => {
    console.log(
      `[WindowSelector] Window thumbnail clicked, calling onSelect with ID: ${windowId}`
    );
    onSelect(windowId);
  };

  // Styles for the component
  const styles = {
    container: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px",
      color: "white",
    },
    header: {
      marginBottom: "20px",
      textAlign: "center" as const,
    },
    gridContainer: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
      gap: "15px",
      maxWidth: "1000px",
      maxHeight: "70vh",
      overflowY: "auto" as const,
      padding: "10px",
      backgroundColor: "rgba(30, 30, 30, 0.9)",
      borderRadius: "8px",
    },
    windowItem: {
      border: "2px solid transparent",
      borderRadius: "4px",
      padding: "10px",
      cursor: "pointer",
      backgroundColor: "rgba(60, 60, 60, 0.8)",
      transition: "all 0.2s ease",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
    },
    selectedWindow: {
      border: "2px solid #4a90e2",
      backgroundColor: "rgba(74, 144, 226, 0.3)",
    },
    windowThumbnail: {
      width: "100%",
      height: "150px",
      objectFit: "contain" as const,
      marginBottom: "10px",
      backgroundColor: "black",
    },
    windowName: {
      fontSize: "14px",
      textAlign: "center" as const,
      whiteSpace: "nowrap" as const,
      overflow: "hidden",
      textOverflow: "ellipsis",
      width: "100%",
    },
    buttonContainer: {
      marginTop: "20px",
      display: "flex",
      gap: "10px",
    },
    button: {
      padding: "8px 16px",
      borderRadius: "4px",
      border: "none",
      cursor: "pointer",
      fontSize: "14px",
    },
    captureButton: {
      backgroundColor: "#4a90e2",
      color: "white",
    },
    cancelButton: {
      backgroundColor: "#6c757d",
      color: "white",
    },
    loadingMessage: {
      fontSize: "16px",
      margin: "20px",
    },
    errorMessage: {
      color: "#ff6b6b",
      fontSize: "16px",
      margin: "20px",
    },
  };

  // Filter out problematic window sources
  const problematicNames = ["NVIDIA GeForce Overlay", "Program Manager"];
  const filteredSources = sources.filter(
    (source) => !problematicNames.includes(source.name)
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>Select Window to Capture</h2>
        <p>Click on a window thumbnail to select it, then click "Capture"</p>
      </div>

      {filteredSources.length === 0 ? (
        <div>No windows available for capture</div>
      ) : (
        <div style={styles.gridContainer}>
          {filteredSources.map((source) => (
            <div
              key={source.id}
              style={{
                ...styles.windowItem,
                ...(selectedWindowId === source.id
                  ? styles.selectedWindow
                  : {}),
              }}
              onClick={() => handleSelectWindow(source.id)}
            >
              <img
                src={source.thumbnailDataUrl}
                alt={source.name}
                style={styles.windowThumbnail}
              />
              <div style={styles.windowName} title={source.name}>
                {source.name}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={styles.buttonContainer}>
        <button
          style={{ ...styles.button, ...styles.cancelButton }}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default WindowSelector;
