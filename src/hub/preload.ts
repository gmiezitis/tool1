import { contextBridge, ipcRenderer } from "electron";

// No need to expose a full API, just send messages

// Wait for the DOM to be ready before attaching listeners
window.addEventListener("DOMContentLoaded", () => {
  const triggerLine = document.getElementById("trigger-line");

  if (triggerLine) {
    triggerLine.addEventListener("mouseenter", () => {
      console.log("Preload: Mouse Enter Trigger Line"); // Log for debugging
      ipcRenderer.send("trigger-mouse-enter");
    });

    triggerLine.addEventListener("mouseleave", () => {
      console.log("Preload: Mouse Leave Trigger Line"); // Log for debugging
      ipcRenderer.send("trigger-mouse-leave"); // Keep sending leave event
    });
  } else {
    console.error("Preload: Could not find #trigger-line element");
  }
});

console.log("Hub Trigger Preload Script Loaded");
