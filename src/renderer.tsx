/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import React from "react";
import { createRoot } from "react-dom/client"; // Import createRoot for React 18
import App from "./App"; // Import the main App component (will be created next)
import ErrorBoundary from "./components/ErrorBoundary"; // <-- ADD IMPORT
import "./index.css";

// Find the root element in index.html
const rootElement = document.getElementById("root");

// Ensure the root element exists before trying to render
if (rootElement) {
  // Create a root instance
  const root = createRoot(rootElement);

  // Render the App component within React StrictMode
  root.render(
    <React.StrictMode>
      <ErrorBoundary
        fallback={
          <div
            style={{
              color: "orange",
              padding: "20px",
              textAlign: "center",
              border: "2px dashed orange",
              margin: "20px",
              backgroundColor: "#333",
            }}
          >
            <h2>Oops! The Application Encountered a Critical Error.</h2>
            <p>
              Something went wrong while loading the main application. Please
              try restarting.
            </p>
          </div>
        }
      >
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element. Please check index.html.");
}
