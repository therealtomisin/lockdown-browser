import {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  session,
  globalShortcut,
  powerSaveBlocker,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import * as path from "path";

// Configuration
const CONFIG = {
  sessionDuration: 10 * 60 * 1000, // 10 minutes
  whitelist: [
    "https://www.ixl.com",
    "https://www.google.com",
    "https://www.khanacademy.org",
    "https://*.khanacademy.org",
    "https://*.ixl.com",
  ],
};

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let powerSaveId: number | null = null;
let sessionEndTimeout: NodeJS.Timeout | null = null;

// Check if URL is allowed
function isUrlAllowed(url: string): boolean {
  try {
    // Allow about:blank and the local file for the app itself
    if (
      url === "about:blank" ||
      url.includes("lockdown-browser/src/renderer/index.html")
    ) {
      return true;
    }

    const parsedUrl = new URL(url);

    return CONFIG.whitelist.some((pattern) => {
      if (pattern.startsWith("*.")) {
        const domain = pattern.slice(2);
        return parsedUrl.hostname.endsWith(domain);
      }
      return parsedUrl.hostname === new URL(pattern).hostname;
    });
  } catch {
    return false;
  }
}

// Handle navigation requests - FIXED: Just validate URL, let renderer handle navigation
function handleNavigation(url: string): boolean {
  return isUrlAllowed(url);
}

// Disable system shortcuts
function disableSystemShortcuts(): void {
  globalShortcut.unregisterAll();

  const blockableShortcuts = [
    "CommandOrControl+R",
    "CommandOrControl+Shift+R",
    "F5",
    "F11",
    "CommandOrControl+N",
    "CommandOrControl+T",
    "CommandOrControl+Shift+N",
    "CommandOrControl+Shift+I",
    "CommandOrControl+W",
    "CommandOrControl+Q",
    "Escape",
  ];

  const platformSpecificShortcuts =
    process.platform === "darwin"
      ? ["Command+H", "Command+Option+H", "Command+Shift+Q"]
      : ["Alt+F4"];

  const allShortcuts = [...blockableShortcuts, ...platformSpecificShortcuts];

  console.log("Registering shortcuts that can be blocked:");
  allShortcuts.forEach((shortcut) => {
    const success = globalShortcut.register(shortcut, () => {
      console.log(`Blocked shortcut: ${shortcut}`);
      mainWindow?.webContents.send("shortcut-blocked", shortcut);
    });

    if (success) {
      console.log(`✓ Registered: ${shortcut}`);
    } else {
      console.log(`✗ Failed to register: ${shortcut} (OS restricted)`);
    }
  });
}

// Start session timer
function startSessionTimer(): void {
  const startTime = Date.now();
  const endTime = startTime + CONFIG.sessionDuration;

  console.log(`Session started: ${new Date(startTime).toLocaleTimeString()}`);
  console.log(`Session will end: ${new Date(endTime).toLocaleTimeString()}`);

  // Send immediate timer data
  mainWindow?.webContents.send("session-timer-update", {
    duration: CONFIG.sessionDuration,
    endTime,
    startTime,
    remaining: CONFIG.sessionDuration,
  });

  // Set the session end timeout
  sessionEndTimeout = setTimeout(() => {
    console.log("Session time expired - ending session");
    endSession();
  }, CONFIG.sessionDuration);

  // Update timer every second
  const timerInterval = setInterval(() => {
    if (sessionEndTimeout && mainWindow && !mainWindow.isDestroyed()) {
      const remaining = Math.max(0, endTime - Date.now());

      mainWindow.webContents.send("session-timer-update", {
        duration: CONFIG.sessionDuration,
        endTime,
        startTime,
        remaining,
      });

      if (remaining <= 0) {
        clearInterval(timerInterval);
      }
    } else {
      clearInterval(timerInterval);
    }
  }, 1000);
}

// End session and cleanup
function endSession(): void {
  if (sessionEndTimeout) {
    clearTimeout(sessionEndTimeout);
    sessionEndTimeout = null;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    console.log("⚠️ endSession called but window is already destroyed");
    return;
  }

  mainWindow.closable = true;
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setFullScreen(false);
  mainWindow.setSkipTaskbar(false);

  if (tray) {
    tray.setToolTip("Lockdown Browser - Session Complete");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Show Lockdown Browser",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show();
              mainWindow.focus();
            }
          },
        },
        { label: "Exit", click: () => app.quit() },
      ])
    );
  }

  if (!mainWindow.isDestroyed()) {
    mainWindow.webContents.send("session-ended");
  }

  if (powerSaveId !== null) {
    powerSaveBlocker.stop(powerSaveId);
    powerSaveId = null;
  }

  globalShortcut.unregisterAll();
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
  );

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Lockdown Browser",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.setFullScreen(true);
        } else {
          createWindow().catch(console.error);
        }
      },
    },
    {
      label: "Force Exit (Admin Only)",
      click: () => {
        if (sessionEndTimeout === null) {
          app.quit();
        } else {
          mainWindow?.webContents.send("admin-exit-request");
        }
      },
    },
  ]);

  tray.setToolTip("Lockdown Browser - Session Active");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setFullScreen(true);
    }
  });
}

// Setup window event handlers
function setupWindowHandlers(): void {
  if (!mainWindow) return;

  // Prevent window from losing focus
  mainWindow.on("blur", () => {
    if (sessionEndTimeout !== null) {
      setTimeout(() => {
        if (
          mainWindow &&
          !mainWindow.isFocused() &&
          sessionEndTimeout !== null
        ) {
          mainWindow.focus();
          mainWindow.setFullScreen(true);
        }
      }, 100);
    }
  });

  // Prevent minimizing
  mainWindow.on("minimize", (event: any) => {
    if (sessionEndTimeout !== null) {
      event.preventDefault();
      mainWindow?.restore();
      mainWindow?.setFullScreen(true);
    }
  });

  // Prevent leaving fullscreen
  mainWindow.on("leave-full-screen", (event: any) => {
    if (sessionEndTimeout !== null) {
      event.preventDefault();
      mainWindow?.setFullScreen(true);
    }
  });
}

// Create main window
async function createWindow(): Promise<void> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const preloadPath = path.join(__dirname, "preload.js");
  console.log("the directory name is >>> ", __dirname);
  console.log("🔧 Preload path:", preloadPath);
  console.log("🔧 Preload exists:", require("fs").existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width,
    height,
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: false, // Show in taskbar
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: true,
      webviewTag: true,
    },
  });

  // In createWindow() function, after mainWindow is created:
  mainWindow.webContents.openDevTools();

  // Also add this to see if the window is loading:
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("🎯 Renderer finished loading");
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      console.log("❌ Renderer failed to load:", errorDescription);
    }
  );

  // Prevent window closing during session
  mainWindow.on("close", (event) => {
    if (sessionEndTimeout !== null) {
      event.preventDefault();
      mainWindow?.hide();
      mainWindow?.webContents.send("close-attempted");
    }
  });

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setFullScreen(true);
    }
  });

  // Setup session security
  await setupSessionSecurity();

  // Load the interface
  const rendererPath = path.join(__dirname, "../src/renderer/index.html");
  mainWindow.loadFile(rendererPath);

  // Start lockdown features
  startSessionTimer();
  disableSystemShortcuts();
  powerSaveId = powerSaveBlocker.start("prevent-display-sleep");

  // Setup window handlers
  setupWindowHandlers();

  // Prevent devtools
  mainWindow.webContents.on("devtools-opened", () => {
    mainWindow?.webContents.closeDevTools();
  });
}

// Setup session security
async function setupSessionSecurity(): Promise<void> {
  if (!mainWindow) return;

  const ses = mainWindow.webContents.session;

  // Clear cache and data
  await ses.clearCache();
  await ses.clearStorageData();

  // Block all permission requests
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log(`Blocked permission request: ${permission}`);
    callback(false);
  });

  // Block non-whitelisted URLs - FIXED: Only block navigation, not webview content
  ses.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;

    // Allow local files and the app itself
    if (url.startsWith("file://") || url.includes("lockdown-browser")) {
      callback({ cancel: false });
      return;
    }

    // Only block main frame navigation, allow resources from whitelisted domains
    if (details.resourceType === "mainFrame" && !isUrlAllowed(url)) {
      console.log(`Blocked navigation to: ${url}`);
      callback({ cancel: true });
      mainWindow?.webContents.send("navigation-blocked", url);
    } else {
      callback({ cancel: false });
    }
  });
}

// Setup app event handlers
function setupApp(): void {
  // Single instance lock
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.whenReady().then(() => {
    createWindow().catch(console.error);
    createTray();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(console.error);
    } else if (mainWindow && sessionEndTimeout !== null) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setFullScreen(true);
    }
  });

  app.on("before-quit", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      endSession();
    }
  });

  // Handle second instance
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      mainWindow.setFullScreen(true);
    }
  });

  // Handle new windows and navigation
  app.on("web-contents-created", (event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      console.log("Blocked new window request:", url);
      // Let renderer handle the navigation in webview
      mainWindow?.webContents.send("new-window-request", url);
      return { action: "deny" };
    });
  });

  //   // IPC handlers - FIXED: Return validation result instead of handling navigation
  //   ipcMain.handle("get-config", () => CONFIG);
  //   ipcMain.handle("validate-url", (event, url: string) => {
  //     return handleNavigation(url);
  //   });
  //   ipcMain.handle("get-whitelist", () => CONFIG.whitelist);

  // IPC handlers - FIXED: Proper error handling and validation
  ipcMain.handle("get-config", () => {
    console.log("📡 IPC: get-config requested");
    return CONFIG;
  });

  ipcMain.handle("validate-url", (event, url: string) => {
    console.log("📡 IPC: validate-url requested for:", url);
    try {
      const isValid = isUrlAllowed(url);
      console.log("📡 IPC: URL validation result:", isValid, "for URL:", url);
      return isValid;
    } catch (error) {
      console.error("📡 IPC: Error validating URL:", error);
      return false;
    }
  });

  ipcMain.handle("navigate-to", (event, url: string) => {
    console.log("📡 IPC: navigate-to requested for:", url);
    const isValid = isUrlAllowed(url);
    if (isValid && mainWindow) {
      console.log("📡 IPC: Navigation approved for:", url);
      return true;
    } else {
      console.log("📡 IPC: Navigation blocked for:", url);
      mainWindow?.webContents.send("navigation-blocked", url);
      return false;
    }
  });

  ipcMain.handle("get-whitelist", () => {
    console.log("📡 IPC: get-whitelist requested");
    return CONFIG.whitelist;
  });
}

// Start the application
setupApp();
