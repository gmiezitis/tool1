import React, { useState, useEffect } from "react";
import type { HubMenuSettings, HexagonColor } from "../types";
import styles from "./HubMenuSettings.module.css";

interface HubMenuSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: HubMenuSettings) => void;
  currentSettings: HubMenuSettings;
}

const defaultSettings: HubMenuSettings = {
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

const HubMenuSettingsComponent: React.FC<HubMenuSettingsProps> = ({
  isOpen,
  onClose,
  onSettingsChange,
  currentSettings,
}) => {
  const [settings, setSettings] = useState<HubMenuSettings>(currentSettings);

  useEffect(() => {
    setSettings(currentSettings);
  }, [currentSettings]);

  const handleColorToggle = (color: HexagonColor) => {
    const newPreferredColors = settings.preferredColors.includes(color)
      ? settings.preferredColors.filter((c) => c !== color)
      : [...settings.preferredColors, color];

    const newSettings = {
      ...settings,
      preferredColors: newPreferredColors,
    };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleSliderChange = (
    key: keyof HubMenuSettings,
    value: number | boolean | string
  ) => {
    const newSettings = {
      ...settings,
      [key]: value,
    };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
    onSettingsChange(defaultSettings);
  };

  const getColorDisplay = (color: HexagonColor): string => {
    const colorMap: Record<HexagonColor, string> = {
      blue: "🔵 Blue",
      green: "🟢 Green",
      red: "🔴 Red",
      default: "⚪ Default",
    };
    return colorMap[color];
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.settingsPanel}>
        <div className={styles.header}>
          <h2>🎨 Hub Menu Settings</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {/* Color Selection */}
          <div className={styles.section}>
            <h3>🎨 Preferred Colors</h3>
            <p className={styles.description}>
              Choose which colors are available for your hexagons
            </p>
            <div className={styles.colorGrid}>
              {settings.availableColors.map((color) => (
                <button
                  key={color}
                  className={`${styles.colorButton} ${
                    settings.preferredColors.includes(color)
                      ? styles.colorActive
                      : styles.colorInactive
                  }`}
                  data-color={color}
                  onClick={() => handleColorToggle(color)}
                >
                  {getColorDisplay(color)}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Opacity */}
          <div className={styles.section}>
            <h3>👁️ Menu Transparency</h3>
            <p className={styles.description}>
              Adjust how transparent the menu background appears
            </p>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={settings.menuOpacity}
                onChange={(e) =>
                  handleSliderChange("menuOpacity", parseFloat(e.target.value))
                }
                className={styles.slider}
              />
              <span className={styles.sliderValue}>
                {Math.round(settings.menuOpacity * 100)}%
              </span>
            </div>
          </div>

          {/* Auto Hide Delay */}
          <div className={styles.section}>
            <h3>⏱️ Auto Hide Delay</h3>
            <p className={styles.description}>
              How long to wait before hiding the menu (milliseconds)
            </p>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                min="100"
                max="2000"
                step="100"
                value={settings.autoHideDelay}
                onChange={(e) =>
                  handleSliderChange("autoHideDelay", parseInt(e.target.value))
                }
                className={styles.slider}
              />
              <span className={styles.sliderValue}>
                {settings.autoHideDelay}ms
              </span>
            </div>
          </div>

          {/* Hexagon Size */}
          <div className={styles.section}>
            <h3>📏 Hexagon Size</h3>
            <p className={styles.description}>
              Choose the size of hexagons in the menu
            </p>
            <div className={styles.radioGroup}>
              {["small", "medium", "large"].map((size) => (
                <label key={size} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="hexagonSize"
                    value={size}
                    checked={settings.hexagonSize === size}
                    onChange={(e) =>
                      handleSliderChange("hexagonSize", e.target.value)
                    }
                    className={styles.radioInput}
                  />
                  <span className={styles.radioText}>
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Layout Style */}
          <div className={styles.section}>
            <h3>📐 Layout Style</h3>
            <p className={styles.description}>
              Choose between circular (traditional) or grid (structured) layout
              to reduce overlapping
            </p>
            <div className={styles.radioGroup}>
              {[
                { value: "circular", label: "🔄 Circular (Traditional)" },
                { value: "grid", label: "⬛ Grid (Less Overlapping)" },
              ].map(({ value, label }) => (
                <label key={value} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="layoutStyle"
                    value={value}
                    checked={settings.layoutStyle === value}
                    onChange={(e) =>
                      handleSliderChange("layoutStyle", e.target.value)
                    }
                    className={styles.radioInput}
                  />
                  <span className={styles.radioText}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Toggle Settings */}
          <div className={styles.section}>
            <h3>⚙️ Features</h3>
            <div className={styles.toggleGroup}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={settings.enableColorCycling}
                  onChange={(e) =>
                    handleSliderChange("enableColorCycling", e.target.checked)
                  }
                  className={styles.toggleInput}
                />
                <span className={styles.toggleText}>
                  🎨 Enable color cycling (right-click)
                </span>
              </label>

              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={settings.showLabels}
                  onChange={(e) =>
                    handleSliderChange("showLabels", e.target.checked)
                  }
                  className={styles.toggleInput}
                />
                <span className={styles.toggleText}>
                  🏷️ Show hexagon labels
                </span>
              </label>
            </div>
          </div>

          {/* Max Hexagons */}
          <div className={styles.section}>
            <h3>🔢 Maximum Hexagons</h3>
            <p className={styles.description}>
              Maximum number of hexagons allowed in the menu
            </p>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                min="6"
                max="19"
                step="1"
                value={settings.maxHexagons}
                onChange={(e) =>
                  handleSliderChange("maxHexagons", parseInt(e.target.value))
                }
                className={styles.slider}
              />
              <span className={styles.sliderValue}>{settings.maxHexagons}</span>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.resetButton} onClick={resetToDefaults}>
            🔄 Reset to Defaults
          </button>
          <button className={styles.doneButton} onClick={onClose}>
            ✅ Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default HubMenuSettingsComponent;
