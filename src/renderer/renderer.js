// Global variables
let currentUrl = "";
let timerInterval = null;

// Debug functions
function updateDebug(message) {
  console.log("🔧 " + message);
  const debugStatus = document.getElementById("debugStatus");
  if (debugStatus) {
    debugStatus.textContent = message;
  }
}

function updateDebugUrl(url) {
  const debugUrl = document.getElementById("debugUrl");
  if (debugUrl) {
    debugUrl.textContent = "URL: " + url;
  }
}

function updateDebugWebview(status) {
  const debugWebview = document.getElementById("debugWebview");
  if (debugWebview) {
    debugWebview.textContent = "Webview: " + status;
  }
}

function showLoading(show) {
  const loading = document.getElementById("loadingIndicator");
  if (loading) {
    loading.style.display = show ? "block" : "none";
  }
}

// Initialize the app
async function initializeApp() {
  updateDebug("App starting...");
  setupEventListeners();
  startTimerUpdates();
  showWelcomeMessage();
  updateDebug("App started successfully");
}

// Setup event listeners
function setupEventListeners() {
  updateDebug("Setting up event listeners...");

  // URL navigation
  const urlInput = document.getElementById("urlInput");
  const goButton = document.getElementById("goButton");

  if (goButton) {
    goButton.addEventListener("click", () => {
      updateDebug("Go button clicked!");
      handleUrlInput();
    });
  }

  if (urlInput) {
    urlInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        updateDebug("Enter key pressed");
        handleUrlInput();
      }
    });
  }

  // Navigation controls
  const backButton = document.getElementById("backButton");
  const homeButton = document.getElementById("homeButton");

  if (backButton) {
    backButton.addEventListener("click", goBack);
  }

  if (homeButton) {
    homeButton.addEventListener("click", goHome);
  }

  // Electron IPC events
  if (window.electronAPI) {
    window.electronAPI.onSessionTimerUpdate((data) => {
      updateTimerDisplay(data);
    });

    window.electronAPI.onSessionEnded(() => {
      showSessionEndOverlay();
    });

    window.electronAPI.onNavigationBlocked((url) => {
      updateDebug("Navigation blocked: " + url);
      showBlockedOverlay(url);
    });

    window.electronAPI.onCloseAttempted(() => {
      showToast("App minimized to system tray. Click tray icon to restore.");
    });

    window.electronAPI.onShortcutBlocked((shortcut) => {
      showToast(`Shortcut blocked: ${shortcut}`);
    });

    window.electronAPI.onAdminExitRequest(() => {
      showToast("Admin exit requested - session will continue for security");
    });

    window.electronAPI.onNewWindowRequest((url) => {
      updateDebug("New window request: " + url);
      navigateToUrl(url);
    });
  } else {
    updateDebug("WARNING: electronAPI not available");
  }

  // Webview events
  const webview = document.getElementById("webview");
  if (webview) {
    webview.addEventListener("dom-ready", () => {
      updateDebugWebview("DOM Ready");
      updateNavButtons();
      showToast("dom is ready");
    });

    webview.addEventListener("did-start-loading", () => {
      updateDebugWebview("Loading...");
      showLoading(true);
    });

    // webview.addEventListener("did-finish-load", () => {
    //   updateDebugWebview("Load Complete");
    //   showLoading(false);
    //   updateNavButtons();
    // });

    webview.addEventListener("did-finish-load", () => {
      updateDebugWebview("Load Complete");
      showLoading(false);
      showToast("site visited")

      document.getElementById("welcomeMessage").style.display = "none";
      webview.style.display = "block";isJsxCallLike.com
    });

    webview.addEventListener("did-navigate", (event) => {
      updateDebug("Navigated to: " + event.url);
      currentUrl = event.url;
      document.getElementById("urlInput").value = event.url;
      updateNavButtons();
    });

    webview.addEventListener("did-navigate-in-page", (event) => {
      currentUrl = event.url;
      document.getElementById("urlInput").value = event.url;
      updateNavButtons();
    });

    webview.addEventListener("did-fail-load", (event) => {
      updateDebugWebview("Load FAILED: " + event.errorDescription);
      showLoading(false);
      showToast("Failed to load page: " + event.errorDescription);
    });
  }

  updateDebug("Event listeners setup complete");
}

// Handle URL input
// async function handleUrlInput() {
//   const urlInput = document.getElementById("urlInput");
//   let url = urlInput.value.trim();

//   updateDebug("Processing URL: " + url);

//   if (!url) {
//     showToast("Please enter a URL");
//     return;
//   }

//   if (!url.startsWith("http://") && !url.startsWith("https://")) {
//     url = "https://" + url;
//     updateDebug("Added https://, URL: " + url);
//   }

//   updateDebug("Validating URL...");

//   try {
//     const isValid = await window.electronAPI.validateUrl(url);
//     updateDebug("URL validation result: " + isValid);

//     if (isValid) {
//       updateDebug("URL valid, navigating...");
//       navigateToUrl(url);
//     } else {
//       updateDebug("URL not in whitelist");
//       showBlockedOverlay(url);
//     }
//   } catch (error) {
//     updateDebug("Error validating URL: " + error);
//     showToast("Error validating URL");
//   }
// }

// Handle URL input - SIMPLIFIED VERSION

async function handleUrlInput() {
  const urlInput = document.getElementById("urlInput");
  let url = urlInput.value.trim();

  updateDebug("Processing URL: " + url);

  if (!url) {
    showToast("Please enter a URL");
    return;
  }

  // Add https:// if missing
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
    updateDebug("Added https://, URL: " + url);
  }

  updateDebug("Validating URL...");

  //   if (window.electronAPI) {
  //     console.log ('the electron api exists')
  //     showToast('the electron api exists')
  //   }

  //   if (window.electronAPI.validateUrl) {
  //     console.log ('the electron api url exists')
  //     showToast('the electron api url exists')
  //   }

  // Test if electronAPI is working
  if (!window.electronAPI || !window.electronAPI.validateUrl) {
    updateDebug("ERROR: electronAPI not available");
    showToast("Error: App not properly initialized");
    return;
  }

  try {
    updateDebug("Calling validateUrl...");
    const isValid = await window.electronAPI.validateUrl(url);
    updateDebug("Validation result: " + isValid);

    if (isValid) {
      updateDebug("URL valid, navigating directly");
      // Navigate directly without further validation
      navigateToUrlDirect(url);
    } else {
      updateDebug("URL not in whitelist");
      showBlockedOverlay(url);
    }
  } catch (error) {
    updateDebug("Validation error: " + error.message);
    // If validation fails, try direct navigation for testing
    updateDebug("Trying direct navigation as fallback...");
    navigateToUrlDirect(url);
  }
}

// Handle URL input - BYPASS ELECTRON API COMPLETELY
// async function handleUrlInput() {
//   const urlInput = document.getElementById("urlInput");
//   let url = urlInput.value.trim();

//   updateDebug("BYPASS: Processing URL: " + url);

//   if (!url) {
//     showToast("Please enter a URL");
//     return;
//   }

//   // Add https:// if missing
//   if (!url.startsWith("http://") && !url.startsWith("https://")) {
//     url = "https://" + url;
//     updateDebug("BYPASS: Added https://, URL: " + url);
//   }

//   updateDebug("BYPASS: Navigating directly to: " + url);

//   const webview = document.getElementById("webview");
//   const welcomeMessage = document.getElementById("welcomeMessage");

//   if (!webview) {
//     updateDebug("ERROR: Webview not found!");
//     return;
//   }

//   // Show loading
//   showLoading(true);

//   // Hide welcome, show webview
//   if (welcomeMessage) welcomeMessage.style.display = "none";
//   webview.style.display = "block";

//   // Navigate directly - NO VALIDATION
//   updateDebug("BYPASS: Setting webview src to: " + url);
//   webview.src = url;

//   // Update URL input
//   document.getElementById("urlInput").value = url;

//   updateDebug("BYPASS: Navigation command sent - waiting for webview...");

//   // Add webview event listeners to see what happens
//   webview.addEventListener("did-finish-load", () => {
//     updateDebug("🎉 SUCCESS: Webview finished loading!");
//     showLoading(false);
//   });

//   webview.addEventListener("did-fail-load", (event) => {
//     updateDebug("❌ FAILED: Webview load failed: " + event.errorDescription);
//     showLoading(false);
//     showToast("Failed to load: " + event.errorDescription);
//   });

//   webview.addEventListener("did-start-loading", () => {
//     updateDebug("📡 Webview started loading...");
//   });
// }

// Direct navigation without validation (for testing)
function navigateToUrlDirect(url) {
  updateDebug("Direct navigation to: " + url);

  const webview = document.getElementById("webview");
  const welcomeMessage = document.getElementById("welcomeMessage");

  if (!webview) {
    updateDebug("ERROR: Webview not found!");
    return;
  }

  // Show loading
  showLoading(true);

  // Hide welcome, show webview
  if (welcomeMessage) welcomeMessage.style.display = "none";
  webview.style.display = "block";

  // Navigate directly
  updateDebug("Setting webview src...");
  webview.src = url;

  // Update URL input
  document.getElementById("urlInput").value = url;
  updateDebug("Navigation command sent");
}

// Navigate to URL using webview directly
function navigateToUrl(url) {
  updateDebug("Navigating to: " + url);
  updateDebugUrl(url);

  const webview = document.getElementById("webview");

  if (!webview) {
    updateDebug("ERROR: Webview not found!");
    showToast("webview not found");
    return;
  }

  // Use webview for navigation
  webview.src = url;
  currentUrl = url;
  showToast(url);

  // Update URL input
  document.getElementById("urlInput").value = url;

  // Show webview and hide welcome message
  showWebview();
}

// Show webview and hide welcome message
function showWebview() {
  document.getElementById("welcomeMessage").style.display = "none";
  document.getElementById("webview").style.display = "block";
  updateDebug("Webview shown");
  showToast("web view loaded");
}

// Show welcome message and hide webview
function showWelcomeMessage() {
  document.getElementById("welcomeMessage").style.display = "flex";
  document.getElementById("webview").style.display = "none";
  document.getElementById("urlInput").value = "";
  document.getElementById("urlInput").focus();
  updateNavButtons();
  updateDebug("Welcome message shown");
}

// Update navigation buttons
function updateNavButtons() {
  const webview = document.getElementById("webview");
  const backButton = document.getElementById("backButton");

  if (backButton && webview) {
    backButton.disabled = !webview.canGoBack();
  }
}

// Navigation functions
function goBack() {
  const webview = document.getElementById("webview");
  if (webview.canGoBack()) {
    webview.goBack();
    updateDebug("Going back");
  }
}

function goHome() {
  updateDebug("Going home");
  showWelcomeMessage();
}

// Update timer display
function updateTimerDisplay(data) {
  const timeRemaining = document.getElementById("timeRemaining");
  const remaining = data.remaining || Math.max(0, data.endTime - Date.now());

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  timeRemaining.textContent = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  // Color coding
  if (remaining < 60000) {
    timeRemaining.style.color = "#ff4444";
  } else if (remaining < 300000) {
    timeRemaining.style.color = "#ffaa00";
  } else {
    timeRemaining.style.color = "#44ff44";
  }
}

// Start timer updates
function startTimerUpdates() {
  updateDebug("Timer updates started");
  // Timer updates come from main process via IPC
}

// Show toast notification
function showToast(message) {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = message;
    toast.style.display = "block";

    setTimeout(() => {
      toast.style.display = "none";
    }, 3000);
  }
  updateDebug("Toast: " + message);
}

// Show blocked URL overlay
function showBlockedOverlay(url) {
  const overlay = document.getElementById("blockedOverlay");
  const blockedUrl = document.getElementById("blockedUrl");

  if (overlay && blockedUrl) {
    blockedUrl.textContent = url;
    overlay.style.display = "flex";
  }
}

// Hide blocked URL overlay
function hideBlockedOverlay() {
  const overlay = document.getElementById("blockedOverlay");
  if (overlay) {
    overlay.style.display = "none";
  }
  showWelcomeMessage();
}

// Show session end overlay
function showSessionEndOverlay() {
  const overlay = document.getElementById("sessionEndOverlay");
  if (overlay) {
    overlay.style.display = "flex";
  }

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  updateDebug("Session ended");
}

// Close application
function closeApp() {
  window.close();
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initializeApp);
