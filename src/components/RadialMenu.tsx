import React, { useRef, useCallback, useState, useEffect } from "react";
import type { IHubMenuElectronAPI } from "../hub/menuPreload"; // Import the specific type
import type {
  HubMenuSettings,
  HexagonColor,
  ExternalApplication,
} from "../types";
import styles from "./RadialMenu.module.css"; // Import CSS Module
// import HubMenuSettingsComponent from "./HubMenuSettings"; // Temporarily disabled for testing
import AppDropZone from "./AppDropZone";
import ProductivitySidebar from "./ProductivitySidebar";

// Default settings for the hub menu
const defaultHubSettings: HubMenuSettings = {
  availableColors: ["blue", "green", "red", "default"],
  preferredColors: ["blue", "green", "red"],
  menuOpacity: 0.8,
  autoHideDelay: 300,
  enableColorCycling: true,
  maxHexagons: 19,
  showLabels: true,
  hexagonSize: "medium",
  layoutStyle: "circular",
  customApplications: [],
  enableDragAndDrop: true,
};

// Define the structure for a tool item in the menu
interface ToolItem {
  id: string;
  name: string;
  icon: string; // Placeholder for icon (could be character, emoji, or later an SVG path/component)
  action?: () => void; // Action to perform on click
  color?: HexagonColor; // Color group for the hexagon
  isAddButton?: boolean; // Flag to mark this as an "add new" button
  isExternal?: boolean; // Flag to mark this as an external application
  externalApp?: ExternalApplication; // External application data
  isEmpty?: boolean; // Flag to mark this as an empty slot waiting for an app
  isRemovable?: boolean; // Flag to mark if this item can be removed
}

interface RadialMenuProps {
  // Currently no props needed, but keeping interface for future extensibility
}

// Helper function to calculate hexagon points
const getHexagonPoints = (
  centerX: number,
  centerY: number,
  size: number
): string => {
  let points = "";
  for (let i = 0; i < 6; i++) {
    const angle_deg = 60 * i - 30; // Start pointy top
    const angle_rad = (Math.PI / 180) * angle_deg;
    const x = centerX + size * Math.cos(angle_rad);
    const y = centerY + size * Math.sin(angle_rad);
    points += `${x},${y} `;
  }
  return points.trim();
};

// Helper function to get positions for beehive-style hexagons (grid-based, non-overlapping)
const getBeehivePositions = (
  centerX: number,
  centerY: number,
  hexSize: number,
  totalHexagons: number,
  svgSize: number
): { x: number; y: number; ring: number; indexInRing: number }[] => {
  const positions: {
    x: number;
    y: number;
    ring: number;
    indexInRing: number;
  }[] = [];

  if (totalHexagons === 0) return positions;

  // Calculate proper spacing to avoid overlapping
  // Use 2.0 for better spacing while avoiding overlap
  const hexDistance = hexSize * 2.0;

  // Define adaptive padding - smaller when fewer hexagons for compact appearance
  const adaptivePadding = totalHexagons <= 7 ? hexSize * 0.8 : hexSize * 1.2;
  const drawableArea = svgSize - adaptivePadding * 2;
  const effectiveRadius = drawableArea / 2;

  // Adjust center to account for padding
  const drawableCenterX = adaptivePadding + effectiveRadius;
  const drawableCenterY = adaptivePadding + effectiveRadius;

  // For small number of hexagons (7 or less), use a tight, compact ring
  if (totalHexagons <= 7) {
    const ring = 1;
    // Use smaller radius for compact appearance with 7 hexagons
    const compactRadius = Math.min(hexDistance * 0.9, effectiveRadius * 0.7);

    for (let i = 0; i < totalHexagons; i++) {
      const angle_deg = (360 / Math.max(totalHexagons, 6)) * i - 90; // Start from top
      const angle_rad = (Math.PI / 180) * angle_deg;
      const x = drawableCenterX + compactRadius * Math.cos(angle_rad);
      const y = drawableCenterY + compactRadius * Math.sin(angle_rad);

      positions.push({ x, y, ring: 1, indexInRing: i });
    }
    return positions;
  }

  // For larger numbers, use expanding rings that grow outward
  let currentHexIndex = 0;
  let ring = 1;

  while (currentHexIndex < totalHexagons && ring <= 3) {
    const hexagonsInRing = ring === 1 ? 6 : 6 * ring;
    // Scale radius based on number of hexagons for progressive expansion
    const baseRadius = hexDistance * ring;
    const expansionFactor = Math.min(totalHexagons / 12, 1); // Gradually expand up to 12 hexagons
    const ringRadius = Math.min(
      baseRadius * (0.7 + expansionFactor * 0.3),
      effectiveRadius
    );

    // Stagger alternate rings for better packing
    const ringRotation = ring % 2 === 0 ? 30 : 0; // 30 degrees offset for even rings

    for (
      let i = 0;
      i < hexagonsInRing && currentHexIndex < totalHexagons;
      i++
    ) {
      const angle_deg = (360 / hexagonsInRing) * i + ringRotation - 90; // Start from top
      const angle_rad = (Math.PI / 180) * angle_deg;

      const x = drawableCenterX + ringRadius * Math.cos(angle_rad);
      const y = drawableCenterY + ringRadius * Math.sin(angle_rad);

      positions.push({ x, y, ring, indexInRing: i });
      currentHexIndex++;
    }
    ring++;
  }

  return positions;
};

// Helper function for grid-style layout (inspired by the user's reference image)
const getGridPositions = (
  centerX: number,
  centerY: number,
  hexSize: number,
  totalHexagons: number,
  svgSize: number
): { x: number; y: number; ring: number; indexInRing: number }[] => {
  const positions: {
    x: number;
    y: number;
    ring: number;
    indexInRing: number;
  }[] = [];

  if (totalHexagons === 0) return positions;

  // Define a padding area to prevent clipping
  const padding = hexSize * 1.2;
  const drawableWidth = svgSize - padding * 2;
  const drawableHeight = svgSize - padding * 2;

  // Grid spacing for clear separation (like in the reference image)
  const horizontalSpacing = hexSize * 1.6;
  const verticalSpacing = hexSize * 1.4;

  // Calculate grid dimensions
  const itemsPerRow = Math.min(
    Math.ceil(Math.sqrt(totalHexagons)),
    Math.floor(drawableWidth / horizontalSpacing)
  );
  const rows = Math.ceil(totalHexagons / itemsPerRow);

  // Center the grid within the drawable area
  const gridWidth = (itemsPerRow - 1) * horizontalSpacing;
  const gridHeight = (rows - 1) * verticalSpacing;

  const startX = padding + (drawableWidth - gridWidth) / 2;
  const startY = padding + (drawableHeight - gridHeight) / 2;

  let currentIndex = 0;

  for (let row = 0; row < rows && currentIndex < totalHexagons; row++) {
    const currentRowItems = Math.min(itemsPerRow, totalHexagons - currentIndex);
    const rowWidth = (currentRowItems - 1) * horizontalSpacing;
    const rowStartX = startX + (gridWidth - rowWidth) / 2;

    for (
      let col = 0;
      col < currentRowItems && currentIndex < totalHexagons;
      col++
    ) {
      // Offset every other row for honeycomb effect (like CSS-Tricks technique)
      const xOffset = row % 2 === 1 ? horizontalSpacing / 2 : 0;

      const x = rowStartX + col * horizontalSpacing + xOffset;
      const y = startY + row * verticalSpacing;

      positions.push({
        x,
        y,
        ring: Math.floor(row / 2) + 1,
        indexInRing: col,
      });
      currentIndex++;
    }
  }

  return positions;
};

// --- Styles are now fully controlled by RadialMenu.module.css ---

const RadialMenu: React.FC<RadialMenuProps> = (props) => {
  // State for dynamic hexagons
  const [tools, setTools] = useState<ToolItem[]>([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    itemId: string;
  } | null>(null);

  // State for settings
  const [hubSettings, setHubSettings] =
    useState<HubMenuSettings>(defaultHubSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showBeeAnimation, setShowBeeAnimation] = useState(false);
  const [beeAnimationCooldown, setBeeAnimationCooldown] = useState(false);
  const [showProductivitySidebar, setShowProductivitySidebar] = useState(true);

  // Ref to store the hide timeout ID
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const beeAnimationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to clear any existing hide timeout
  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Helper to request hiding the menu window via IPC
  const requestHideMenu = useCallback(() => {
    clearHideTimeout(); // Ensure no pending timeout fires
    (window.electronAPI as unknown as IHubMenuElectronAPI)?.hideMenuWindow();
  }, [clearHideTimeout]);

  // Function to start the hide timer when mouse leaves the menu container
  const handleMouseLeaveContainer = useCallback(() => {
    clearHideTimeout(); // Clear any previous timeout just in case
    hideTimeoutRef.current = setTimeout(() => {
      console.log("Mouse left menu container, requesting hide after delay.");
      requestHideMenu();
    }, hubSettings.autoHideDelay); // Use settings delay
  }, [requestHideMenu, clearHideTimeout, hubSettings.autoHideDelay]);

  // Function to cancel the hide timer when mouse enters the menu container
  const handleMouseEnterContainer = useCallback(() => {
    clearHideTimeout();

    // Random bee animation logic - only show occasionally and with random chance
    if (!showBeeAnimation && !beeAnimationCooldown) {
      // 15% chance of showing bee animation, down from 100%
      const randomChance = Math.random();
      if (randomChance < 0.15) {
        setShowBeeAnimation(true);
        setBeeAnimationCooldown(true);

        // Random animation duration between 2-4 seconds
        const animationDuration = 2000 + Math.random() * 2000;

        // Clear animation after random duration
        setTimeout(() => setShowBeeAnimation(false), animationDuration);

        // Set a longer cooldown period (15-30 seconds) before next possible animation
        const cooldownDuration = 15000 + Math.random() * 15000;
        if (beeAnimationTimeoutRef.current) {
          clearTimeout(beeAnimationTimeoutRef.current);
        }
        beeAnimationTimeoutRef.current = setTimeout(() => {
          setBeeAnimationCooldown(false);
        }, cooldownDuration);
      }
    }
  }, [clearHideTimeout, showBeeAnimation, beeAnimationCooldown]);

  // Updated action for the center button
  const handleCenterClick = useCallback(() => {
    console.log("LLM Chat (Center) Clicked - Opening Chat Interface");
    // TODO: Implement LLM chat interface
    // For now, we'll just log and hide the menu
    // Later this will open a chat window or interface
    console.log("🤖 Opening local offline LLM chat...");
    requestHideMenu(); // Hide the menu after triggering action
  }, [requestHideMenu]);

  // Function to handle external application clicks
  const handleExternalAppClick = useCallback(
    (appId: string) => {
      console.log(`Launching external application: ${appId}`);
      try {
        (
          window.electronAPI as unknown as IHubMenuElectronAPI
        )?.launchApplication(appId);
        requestHideMenu(); // Hide the menu after launching
      } catch (error) {
        console.error("Error launching application:", error);
      }
    },
    [requestHideMenu]
  );

  // Function to browse for and add a new application to a specific slot
  const handleBrowseForApplication = useCallback(
    async (targetSlotId?: string) => {
      try {
        const appData = await (
          window.electronAPI as unknown as IHubMenuElectronAPI
        )?.browseForApplication();
        if (appData) {
          const newApp = await (
            window.electronAPI as unknown as IHubMenuElectronAPI
          )?.addCustomApplication(appData);
          if (newApp) {
            // Add the new app to the tools list
            const newTool: ToolItem = {
              id: newApp.id,
              name: newApp.name,
              icon: newApp.icon || "📦",
              color: newApp.color || "default",
              isExternal: true,
              externalApp: newApp,
              isRemovable: true,
              action: () => handleExternalAppClick(newApp.id),
            };

            setTools((prevTools) => {
              if (targetSlotId) {
                // Replace the empty slot with the new app
                return prevTools.map((tool) =>
                  tool.id === targetSlotId ? newTool : tool
                );
              } else {
                // Check if we've reached the maximum limit (19 hexagons)
                const currentCount = prevTools.length;
                if (currentCount >= hubSettings.maxHexagons) {
                  console.log(
                    `Maximum number of hexagons reached (${hubSettings.maxHexagons})`
                  );
                  return prevTools; // Don't add more hexagons
                }

                // Remove the add button, add the new tool, then add the add button back
                const withoutAddButton = prevTools.filter(
                  (tool) => !tool.isAddButton
                );
                const addButton = prevTools.find((tool) => tool.isAddButton);
                return addButton
                  ? [...withoutAddButton, newTool, addButton]
                  : [...withoutAddButton, newTool];
              }
            });
          }
        }
      } catch (error) {
        console.error("Error adding custom application:", error);
      }
    },
    [handleExternalAppClick]
  );

  // Function to handle empty slot clicks
  const handleEmptySlotClick = useCallback(
    (slotId: string) => {
      handleBrowseForApplication(slotId);
    },
    [handleBrowseForApplication]
  );

  // Function to create a new empty slot
  const handleCreateEmptySlot = useCallback(() => {
    console.log("🚀 handleCreateEmptySlot called");

    setTools((prevTools) => {
      console.log(
        `📊 BEFORE: Current tools count: ${prevTools.length}, Max: ${hubSettings.maxHexagons}`
      );

      // Check if we've reached the maximum limit (19 hexagons)
      const currentCount = prevTools.length;
      if (currentCount >= hubSettings.maxHexagons) {
        console.log(
          `❌ Maximum number of hexagons reached (${hubSettings.maxHexagons})`
        );
        return prevTools; // Don't add more hexagons
      }

      const emptySlotId = `empty-slot-${Date.now()}`;
      console.log(`🆔 Creating empty slot with ID: ${emptySlotId}`);

      const emptySlot: ToolItem = {
        id: emptySlotId,
        name: "Click to Add",
        icon: "➕",
        color: "default",
        isEmpty: true,
        isRemovable: true,
        action: () => handleEmptySlotClick(emptySlotId),
      };

      // Remove the add button, add the empty slot, then add the add button back
      const withoutAddButton = prevTools.filter((tool) => !tool.isAddButton);
      const addButton = prevTools.find((tool) => tool.isAddButton);

      const newTools = addButton
        ? [...withoutAddButton, emptySlot, addButton]
        : [...withoutAddButton, emptySlot];

      console.log(
        `✅ AFTER: Created new empty slot. Total tools: ${newTools.length}`
      );
      return newTools;
    });
  }, [handleEmptySlotClick, hubSettings.maxHexagons]);

  // Function to remove a tool from the menu
  const handleRemoveTool = useCallback(
    async (toolId: string) => {
      try {
        // Find the tool to be removed
        const toolToRemove = tools.find((tool) => tool.id === toolId);

        // If it's an external app, remove it from backend as well
        if (toolToRemove?.isExternal && toolToRemove.externalApp?.isCustom) {
          await (
            window.electronAPI as unknown as IHubMenuElectronAPI
          )?.removeCustomApplication(toolId);
        }

        // Remove from frontend state
        setTools((prevTools) => prevTools.filter((tool) => tool.id !== toolId));
      } catch (error) {
        console.error("Error removing tool:", error);
        // Still remove from frontend even if backend removal failed
        setTools((prevTools) => prevTools.filter((tool) => tool.id !== toolId));
      }
    },
    [tools]
  );

  // Function to handle dropped applications
  const handleAppDropped = useCallback(
    async (appData: ExternalApplication, targetSlotId?: string) => {
      try {
        const newApp = await (
          window.electronAPI as unknown as IHubMenuElectronAPI
        )?.addCustomApplication(appData);
        if (newApp) {
          // Add the new app to the tools list
          const newTool: ToolItem = {
            id: newApp.id,
            name: newApp.name,
            icon: newApp.icon || "📦",
            color: newApp.color || "default",
            isExternal: true,
            externalApp: newApp,
            isRemovable: true,
            action: () => handleExternalAppClick(newApp.id),
          };

          setTools((prevTools) => {
            if (targetSlotId) {
              // Replace the empty slot or existing tool with the new app
              return prevTools.map((tool) =>
                tool.id === targetSlotId ? newTool : tool
              );
            } else {
              // Check if we've reached the maximum limit (19 hexagons)
              const currentCount = prevTools.length;
              if (currentCount >= hubSettings.maxHexagons) {
                console.log(
                  `Maximum number of hexagons reached (${hubSettings.maxHexagons})`
                );
                return prevTools; // Don't add more hexagons
              }

              // Remove the add button, add the new tool, then add the add button back
              const withoutAddButton = prevTools.filter(
                (tool) => !tool.isAddButton
              );
              const addButton = prevTools.find((tool) => tool.isAddButton);
              return addButton
                ? [...withoutAddButton, newTool, addButton]
                : [...withoutAddButton, newTool];
            }
          });
        }
      } catch (error) {
        console.error("Error adding dropped application:", error);
      }
    },
    [handleExternalAppClick]
  );

  // Stable callback for segment clicks
  const handleSegmentClick = useCallback(
    (toolName: string, toolId: string) => {
      console.log(`🎯 ${toolName} Clicked (ID: ${toolId})`);

      // Check if this is an "add new" button
      if (toolId === "add-new") {
        console.log(
          `📝 Add new button clicked. Current tools: ${tools.length}, Max: ${hubSettings.maxHexagons}`
        );
        // Check if we've reached the maximum limit before adding
        if (tools.length >= hubSettings.maxHexagons) {
          console.log(
            `❌ Cannot add more hexagons. Maximum limit reached (${hubSettings.maxHexagons})`
          );
          return;
        }
        console.log("🚀 Calling handleCreateEmptySlot");
        handleCreateEmptySlot(); // Only call this once - it handles setTools internally
        return;
      }

      // Check if this is the settings button
      if (toolId === "settings") {
        console.log("⚙️ Settings button clicked");
        setShowSettings(true);
        return;
      }

      // Handle default system applications
      try {
        console.log(`🚀 Launching system application: ${toolName} (${toolId})`);
        
        // Map tool IDs to system application IDs that ApplicationService can handle
        const systemAppMap: { [key: string]: string } = {
          "calculator": "system-calculator",
          "notepad": "system-notepad", 
          "browser": "detected-google-chrome", // Try Chrome first, fallback handled in service
          "files": "system-file-explorer",
          "snipping-tool": "system-snipping-tool"
        };

        const systemAppId = systemAppMap[toolId];
        if (systemAppId) {
          // Use the existing application service to launch system apps
          (window.electronAPI as unknown as IHubMenuElectronAPI)?.launchApplication(systemAppId);
          requestHideMenu(); // Hide menu after launching
        } else {
          console.log(`⚠️ No system app mapping found for ${toolId}, hiding menu`);
          requestHideMenu();
        }
      } catch (error) {
        console.error(`❌ Error launching ${toolName}:`, error);
        requestHideMenu(); // Still hide menu even if launch fails
      }
    },
    [
      requestHideMenu,
      handleCreateEmptySlot,
      tools.length,
      hubSettings.maxHexagons,
    ]
  );

  // Function to cycle through colors for a hexagon
  const handleColorCycle = useCallback(
    (toolId: string) => {
      console.log(`🎨 Color cycle requested for tool: ${toolId}`);
      console.log(
        `🎨 Color cycling enabled: ${hubSettings.enableColorCycling}`
      );

      // Don't cycle if disabled in settings
      if (!hubSettings.enableColorCycling) {
        console.log(`❌ Color cycling is disabled in settings`);
        return;
      }

      const colors: HexagonColor[] = [
        "default",
        ...hubSettings.preferredColors,
      ];

      console.log(`🎨 Available colors: ${colors.join(", ")}`);

      setTools((prevTools) => {
        const updatedTools = prevTools.map((tool) => {
          if (tool.id === toolId) {
            const currentIndex = colors.indexOf(tool.color || "default");
            const nextIndex = (currentIndex + 1) % colors.length;
            const newColor = colors[nextIndex];
            console.log(
              `🎨 Tool ${toolId}: ${tool.color || "default"} → ${newColor}`
            );
            return { ...tool, color: newColor };
          }
          return tool;
        });
        console.log(`🎨 Tools updated successfully`);
        return updatedTools;
      });
    },
    [hubSettings.enableColorCycling, hubSettings.preferredColors]
  );

  // Load external applications and initialize tools - ONLY ONCE on mount
  useEffect(() => {
    const loadApplicationsAndInitialize = async () => {
      // Create default tools - 7 modern tools by default (don't load external apps initially)
      const defaultTools: ToolItem[] = [
        {
          id: "calculator",
          name: "Calculator",
          icon: "🧮",
          color: "blue",
          action: () => handleSegmentClick("Calculator", "calculator"),
        },
        {
          id: "notepad",
          name: "Notepad",
          icon: "📝",
          color: "green",
          action: () => handleSegmentClick("Notepad", "notepad"),
        },
        {
          id: "browser",
          name: "Browser",
          icon: "🌐",
          color: "blue",
          action: () => handleSegmentClick("Browser", "browser"),
        },
        {
          id: "snipping-tool",
          name: "Snipping Tool",
          icon: "✂️",
          color: "red",
          action: () => handleSegmentClick("Snipping Tool", "snipping-tool"),
        },
        {
          id: "files",
          name: "Files",
          icon: "📁",
          color: "red",
          action: () => handleSegmentClick("Files", "files"),
        },
        {
          id: "settings",
          name: "Settings",
          icon: "⚙️",
          color: "default",
          action: () => handleSegmentClick("Settings", "settings"),
        },
        {
          id: "add-new",
          name: "Add Tool",
          icon: "➕",
          color: "default",
          isAddButton: true,
          action: () => handleSegmentClick("Add Tool", "add-new"),
        },
      ];

      // Set tools once - no try/catch duplication!
      setTools(defaultTools);
    };

    loadApplicationsAndInitialize();
  }, []); // 🔥 FIXED: Empty dependency array - only run once on mount!

  // Define the center tool
  const centerTool = {
    id: "center",
    name: "LLM Chat",
    icon: "🤖",
    action: handleCenterClick,
  };

  // --- SVG Layout Calculations ---
  const hexSizeMultiplier =
    hubSettings.hexagonSize === "small"
      ? 0.85 // Increased from 0.7 - bigger small size
      : hubSettings.hexagonSize === "large"
      ? 1.35 // Increased from 1.15 - much bigger large size (like old medium)
      : 1.1; // Increased from 0.9 - bigger medium size

  // Adaptive SVG size based on number of hexagons - ensure new hexagons are visible
  const baseSvgSize = 350; // Base size for initial hexagons
  const maxSvgSize = 650; // Increased maximum size for better visibility
  const expansionFactor = Math.min(tools.length / 10, 1); // More responsive expansion
  const svgSize = Math.round(
    baseSvgSize + (maxSvgSize - baseSvgSize) * expansionFactor
  );

  const centerHexSize = 65 * hexSizeMultiplier; // Much bigger center hexagon for prominence
  const surroundingHexSize = 45 * hexSizeMultiplier; // Increased from 38 - bigger surrounding size
  const svgCenter = svgSize / 2;

  // Get positions based on selected layout style
  const toolPositions =
    hubSettings.layoutStyle === "grid"
      ? getGridPositions(
          svgCenter,
          svgCenter,
          surroundingHexSize,
          tools.length,
          svgSize
        )
      : getBeehivePositions(
          svgCenter,
          svgCenter,
          surroundingHexSize,
          tools.length,
          svgSize
        );

  // Debug: Log positioning info
  console.log(
    `📐 SVG Size: ${svgSize}, Tools: ${tools.length}, Positions: ${toolPositions.length}`
  );
  console.log(
    "🔧 Current tools:",
    tools.map((t) => ({
      id: t.id,
      name: t.name,
      isEmpty: t.isEmpty,
      isAddButton: t.isAddButton,
    }))
  );

  // Enhanced render debugging
  console.log(`🎯 RENDER COUNT: Tools array has ${tools.length} items`);
  console.log(
    "🎯 Tools rendering:",
    tools.map((t, i) => ({
      index: i,
      id: t.id,
      name: t.name,
      isEmpty: t.isEmpty,
      isAddButton: t.isAddButton,
      hasPosition: !!toolPositions[i],
    }))
  );

  // Cleanup effect for bee animation timeout
  useEffect(() => {
    return () => {
      if (beeAnimationTimeoutRef.current) {
        clearTimeout(beeAnimationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {/* Productivity Sidebar */}
      <ProductivitySidebar isVisible={showProductivitySidebar} />

      <AppDropZone onAppDropped={handleAppDropped}>
        <div
          className={styles.svgContainer} // Use a container for the SVG
          onMouseEnter={handleMouseEnterContainer}
          onMouseLeave={handleMouseLeaveContainer}
        >
          <svg
            width={svgSize}
            height={svgSize}
            viewBox={`0 0 ${svgSize} ${svgSize}`}
          >
            {/* Central Hexagon */}
            <g
              key={centerTool.id}
              className={styles.hexGroup} // Apply group style
              onClick={centerTool.action}
            >
              <title>{centerTool.name}</title> {/* Use SVG title for tooltip */}
              <polygon
                className={`${styles.hexagon} ${styles.centerHexagon}`} // Add specific class for center? Needed if styling differs
                points={getHexagonPoints(svgCenter, svgCenter, centerHexSize)}
              />
              <text
                x={svgCenter}
                y={svgCenter - 7} // Position icon slightly above center Y (adjusted)
                className={styles.hexIcon}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {centerTool.icon}
              </text>
              <text
                x={svgCenter}
                y={svgCenter + 10} // Position label below icon (adjusted)
                className={styles.hexLabel}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {centerTool.name}
              </text>
            </g>

            {/* Surrounding Hexagons in Beehive Pattern */}
            {tools.map((item: ToolItem, index: number) => {
              const pos = toolPositions[index];
              if (!pos) return null; // Should not happen with proper positioning

              return (
                <g key={item.id}>
                  {/* Individual drop zone for each hexagon */}
                  <foreignObject
                    x={pos.x - surroundingHexSize}
                    y={pos.y - surroundingHexSize}
                    width={surroundingHexSize * 2}
                    height={surroundingHexSize * 2}
                    style={{ pointerEvents: item.isEmpty ? "all" : "none" }}
                  >
                    <AppDropZone
                      onAppDropped={handleAppDropped}
                      targetSlotId={item.isEmpty ? item.id : undefined}
                    >
                      <div style={{ width: "100%", height: "100%" }} />
                    </AppDropZone>
                  </foreignObject>

                  {/* Hexagon */}
                  <g
                    className={styles.hexGroup}
                    onClick={item.action}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      console.log(
                        `🖱️ Right-click on item: ${item.id}, isAddButton: ${item.isAddButton}, isEmpty: ${item.isEmpty}, isRemovable: ${item.isRemovable}, isExternal: ${item.isExternal}`
                      );
                      // Show context menu for all items except the add button
                      if (!item.isAddButton) {
                        console.log(
                          `✅ Showing context menu for item: ${item.id}`
                        );
                        setContextMenu({
                          show: true,
                          x: e.clientX,
                          y: e.clientY,
                          itemId: item.id,
                        });
                      } else {
                        console.log(
                          `❌ Context menu not shown for item: ${item.id} (is add button)`
                        );
                      }
                    }}
                  >
                    <title>
                      {item.name}
                      {!item.isAddButton &&
                        !item.isEmpty &&
                        " (Right-click for options)"}
                      {item.isEmpty && " (Click to add app or drag & drop)"}
                    </title>
                    <polygon
                      className={styles.hexagon} // Apply base hexagon style
                      data-color={item.color || "default"}
                      data-add-button={item.isAddButton || false}
                      data-disabled={
                        item.isAddButton &&
                        tools.length >= hubSettings.maxHexagons
                      }
                      data-empty={item.isEmpty || false}
                      data-ring={pos.ring}
                      points={getHexagonPoints(
                        pos.x,
                        pos.y,
                        surroundingHexSize
                      )}
                    />
                    <text
                      x={pos.x}
                      y={pos.y - 5} // Position icon slightly above center Y (adjusted)
                      className={styles.hexIcon}
                      dominantBaseline="middle"
                      textAnchor="middle"
                    >
                      {item.icon}
                    </text>
                    {hubSettings.showLabels && (
                      <text
                        x={pos.x}
                        y={pos.y + 8} // Position label below icon (adjusted)
                        className={styles.hexLabel}
                        dominantBaseline="middle"
                        textAnchor="middle"
                      >
                        {item.name}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Context Menu */}
          {contextMenu &&
            (() => {
              const contextTool = tools.find(
                (tool) => tool.id === contextMenu.itemId
              );
              return (
                <div
                  className={styles.contextMenu}
                  style={{
                    position: "fixed",
                    left: contextMenu.x,
                    top: contextMenu.y,
                    zIndex: 10000,
                  }}
                >
                  {/* Show color cycling for ALL items (not just removable) */}
                  <button
                    className={styles.contextMenuItem}
                    onClick={() => {
                      console.log(
                        `🎨 Color change button clicked for: ${contextMenu.itemId}`
                      );
                      handleColorCycle(contextMenu.itemId);
                      setContextMenu(null);
                    }}
                  >
                    🎨 Change Color
                  </button>

                  {/* Show remove option only for removable items */}
                  {(contextTool?.isEmpty ||
                    contextTool?.isRemovable ||
                    contextTool?.isExternal) && (
                    <button
                      className={styles.contextMenuItem}
                      onClick={() => {
                        handleRemoveTool(contextMenu.itemId);
                        setContextMenu(null);
                      }}
                    >
                      {contextTool?.isEmpty
                        ? "🗑️ Remove Empty Slot"
                        : "🗑️ Remove"}
                    </button>
                  )}
                </div>
              );
            })()}

          {/* Click outside to close context menu */}
          {contextMenu && (
            <div
              className={styles.contextMenuOverlay}
              onClick={() => setContextMenu(null)}
            />
          )}

          {/* Settings Modal - Temporarily disabled for testing */}
          {false && <div>Settings Modal Disabled</div>}

          {/* Subtle Bee Animation */}
          {showBeeAnimation && (
            <div className={styles.beeContainer}>
              <div className={styles.bee}>🐝</div>
            </div>
          )}
        </div>
      </AppDropZone>
    </>
  );
};

export default RadialMenu;
