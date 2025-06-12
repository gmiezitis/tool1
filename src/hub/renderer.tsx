import React from "react";
import ReactDOM from "react-dom/client"; // Use createRoot
import RadialMenu from "../components/RadialMenu"; // Corrected path

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Failed to find the root element");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <RadialMenu />
  </React.StrictMode>
);

console.log("Hub Renderer Loaded");
