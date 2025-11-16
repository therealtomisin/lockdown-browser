import { contextBridge, ipcRenderer } from "electron";

console.log("🔧 Preload script started loading...");

// Test if IPC is available
console.log("🔧 ipcRenderer available:", !!ipcRenderer);
console.log("🔧 contextBridge available:", !!contextBridge);

try {
  // Expose safe APIs to renderer
  contextBridge.exposeInMainWorld("electronAPI", {
    getConfig: () => {
      console.log("🔧 Preload: getConfig called");
      return ipcRenderer.invoke("get-config");
    },
    validateUrl: (url: string) => {
      console.log("🔧 Preload: validateUrl called with:", url);
      return ipcRenderer.invoke("validate-url", url);
    },
    getWhitelist: () => {
      console.log("🔧 Preload: getWhitelist called");
      return ipcRenderer.invoke("get-whitelist");
    },

    // Event listeners
    onSessionTimerUpdate: (callback: (data: any) => void) => {
      console.log("🔧 Preload: onSessionTimerUpdate listener registered");
      ipcRenderer.on("session-timer-update", (event, data) => callback(data));
    },
    onSessionEnded: (callback: () => void) => {
      console.log("🔧 Preload: onSessionEnded listener registered");
      ipcRenderer.on("session-ended", () => callback());
    },
    onNavigationBlocked: (callback: (url: string) => void) => {
      console.log("🔧 Preload: onNavigationBlocked listener registered");
      ipcRenderer.on("navigation-blocked", (event, url) => callback(url));
    },
    onCloseAttempted: (callback: () => void) => {
      console.log("🔧 Preload: onCloseAttempted listener registered");
      ipcRenderer.on("close-attempted", () => callback());
    },
    onShortcutBlocked: (callback: (shortcut: string) => void) => {
      console.log("🔧 Preload: onShortcutBlocked listener registered");
      ipcRenderer.on("shortcut-blocked", (event, shortcut) =>
        callback(shortcut)
      );
    },
    onAdminExitRequest: (callback: () => void) => {
      console.log("🔧 Preload: onAdminExitRequest listener registered");
      ipcRenderer.on("admin-exit-request", () => callback());
    },
    onNewWindowRequest: (callback: (url: string) => void) => {
      console.log("🔧 Preload: onNewWindowRequest listener registered");
      ipcRenderer.on("new-window-request", (event, url) => callback(url));
    },
  });

  console.log("🔧 Preload: electronAPI exposed successfully");
} catch (error) {
  console.error("🔧 Preload ERROR:", error);
}

// Type declarations
declare global {
  interface Window {
    electronAPI: any; // Use any for now to avoid type issues
  }
}

console.log("🔧 Preload script finished loading");
