import React, { useCallback, useState } from "react";
import type { ExternalApplication } from "../types";

interface AppDropZoneProps {
  onAppDropped: (appData: ExternalApplication, targetSlotId?: string) => void;
  children: React.ReactNode;
  className?: string;
  targetSlotId?: string; // Optional slot ID for targeted drops
}

const AppDropZone: React.FC<AppDropZoneProps> = ({
  onAppDropped,
  children,
  className,
  targetSlotId,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      try {
        // Handle file drops (executable files)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];

          // Check if it's an executable file
          const isExecutable =
            file.name.endsWith(".exe") ||
            file.name.endsWith(".app") ||
            file.name.endsWith(".bat") ||
            file.name.endsWith(".cmd");

          if (isExecutable) {
            const appData: ExternalApplication = {
              id: `dropped-${Date.now()}`,
              name: file.name.replace(/\.(exe|app|bat|cmd)$/i, ""),
              executablePath: file.path,
              icon: "📦", // Default icon for dropped apps
              color: "default",
              isCustom: true,
            };

            onAppDropped(appData, targetSlotId);
          } else {
            console.warn("Dropped file is not an executable:", file.name);
          }
        }

        // Handle text/uri-list drops (shortcuts, links)
        const uriList = e.dataTransfer.getData("text/uri-list");
        if (uriList) {
          const lines = uriList
            .split("\n")
            .filter((line) => line.trim() && !line.startsWith("#"));
          if (lines.length > 0) {
            const uri = lines[0].trim();

            // Handle file:// URIs
            if (uri.startsWith("file://")) {
              const filePath = decodeURIComponent(uri.replace("file://", ""));
              const fileName = filePath.split(/[/\\]/).pop() || "Unknown App";

              const appData: ExternalApplication = {
                id: `dropped-${Date.now()}`,
                name: fileName.replace(/\.(exe|app|bat|cmd|lnk)$/i, ""),
                executablePath: filePath,
                icon: "📦",
                color: "default",
                isCustom: true,
              };

              onAppDropped(appData, targetSlotId);
            }
          }
        }

        // Handle text/plain drops (might be file paths)
        const textData = e.dataTransfer.getData("text/plain");
        if (
          textData &&
          (textData.endsWith(".exe") || textData.endsWith(".app"))
        ) {
          const fileName = textData.split(/[/\\]/).pop() || "Unknown App";

          const appData: ExternalApplication = {
            id: `dropped-${Date.now()}`,
            name: fileName.replace(/\.(exe|app|bat|cmd)$/i, ""),
            executablePath: textData,
            icon: "📦",
            color: "default",
            isCustom: true,
          };

          onAppDropped(appData, targetSlotId);
        }
      } catch (error) {
        console.error("Error handling dropped application:", error);
      }
    },
    [onAppDropped]
  );

  return (
    <div
      className={`${className || ""} ${isDragOver ? "drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: "relative",
        ...(isDragOver && {
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderRadius: "8px",
          border: "2px dashed rgba(59, 130, 246, 0.5)",
        }),
      }}
    >
      {children}
      {isDragOver && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderRadius: "8px",
            border: "2px dashed rgba(59, 130, 246, 0.5)",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              color: "rgba(59, 130, 246, 0.8)",
              fontSize: "14px",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            Drop application here
          </div>
        </div>
      )}
    </div>
  );
};

export default AppDropZone;
