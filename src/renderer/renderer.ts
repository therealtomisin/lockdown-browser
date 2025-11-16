let currentUrl = "";
let timerInterval: NodeJS.Timeout | null = null;

function updateDebug(message: string) {
  console.log("🔧 " + message);
  const debugStatus = document.getElementById("debugStatus");
  if (debugStatus) {
    debugStatus.textContent = message;
  }
}

function updateDebugUrl(url: string) {
  const debugUrl = document.getElementById("debugUrl");
  if (debugUrl) {
    debugUrl.textContent = "URL: " + url;
  }
}

function updateDebugWebview(status: string) {
  const debugWebview = document.getElementById("debugWebview");
  if (debugWebview) {
    debugWebview.textContent = "Webview: " + status;
  }
}

function showLoading(show: boolean) {
  const loading = document.getElementById("loadingIndicator") as HTMLElement | null;
  if (loading) {
    loading.style.display = show ? "block" : "none";
  }
}

async function initializeApp() {
  updateDebug("App starting...");
  setupEventListeners();
  startTimerUpdates();
  showWelcomeMessage();
  updateDebug("App started successfully");
}

function setupEventListeners() {
  updateDebug("Setting up event listeners...");

  const urlInput = document.getElementById("urlInput") as HTMLInputElement | null;
  const goButton = document.getElementById("goButton");

  if (goButton) {
    goButton.addEventListener("click", () => {
      updateDebug("Go button clicked!");
      handleUrlInput();
    });
  }

  if (urlInput) {
    urlInput.addEventListener("keypress", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        updateDebug("Enter key pressed");
        handleUrlInput();
      }
    });
  }

  const backButton = document.getElementById("backButton");
  const homeButton = document.getElementById("homeButton");

  if (backButton) {
    backButton.addEventListener("click", goBack);
  }

  if (homeButton) {
    homeButton.addEventListener("click", goHome);
  }

  const webview = document.getElementById("webview") as any;

  if (window.electronAPI) {
    window.electronAPI.onSessionTimerUpdate((data: any) => {
      updateTimerDisplay(data);
    });

    window.electronAPI.onSessionEnded(() => {
      showSessionEndOverlay();
    });

    window.electronAPI.onNavigationBlocked((url: string) => {
      updateDebug("Navigation blocked: " + url);
      showBlockedOverlay(url);
    });

    window.electronAPI.onCloseAttempted(() => {
      showToast("App minimized to system tray. Click tray icon to restore.");
    });

    window.electronAPI.onShortcutBlocked((shortcut: string) => {
      showToast(`Shortcut blocked: ${shortcut}`);
    });

    window.electronAPI.onAdminExitRequest(() => {
      showToast("Admin exit requested - session will continue for security");
    });

    window.electronAPI.onNewWindowRequest((url: string) => {
      updateDebug("New window request: " + url);
      navigateToUrl(url);
    });
  }

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

    webview.addEventListener("did-finish-load", () => {
      updateDebugWebview("Load Complete");
      showLoading(false);
      showToast("site visited");
      const welcomeMessage = document.getElementById("welcomeMessage") as HTMLElement;
      if (welcomeMessage) welcomeMessage.style.display = "none";
      webview.style.display = "block";
    });

    webview.addEventListener("did-navigate", (event: any) => {
      updateDebug("Navigated to: " + event.url);
      currentUrl = event.url;
      const urlInputEl = document.getElementById("urlInput") as HTMLInputElement;
      urlInputEl.value = event.url;
      updateNavButtons();
    });

    webview.addEventListener("did-navigate-in-page", (event: any) => {
      currentUrl = event.url;
      const urlInputEl = document.getElementById("urlInput") as HTMLInputElement;
      urlInputEl.value = event.url;
      updateNavButtons();
    });

    webview.addEventListener("did-fail-load", (event: any) => {
      updateDebugWebview("Load FAILED: " + event.errorDescription);
      showLoading(false);
      showToast("Failed to load page: " + event.errorDescription);
    });
  }

  updateDebug("Event listeners setup complete");
}

async function handleUrlInput() {
  const urlInput = document.getElementById("urlInput") as HTMLInputElement;
  let url = urlInput.value.trim();

  updateDebug("Processing URL: " + url);

  if (!url) {
    showToast("Please enter a URL");
    return;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
    updateDebug("Added https://, URL: " + url);
  }

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
      navigateToUrlDirect(url);
    } else {
      updateDebug("URL not in whitelist");
      showBlockedOverlay(url);
    }
  } catch (error: any) {
    updateDebug("Validation error: " + error.message);
    updateDebug("Trying direct navigation as fallback...");
    navigateToUrlDirect(url);
  }
}

function navigateToUrlDirect(url: string) {
  updateDebug("Direct navigation to: " + url);

  const webview = document.getElementById("webview") as any;
  const welcomeMessage = document.getElementById("welcomeMessage") as HTMLElement | null;

  if (!webview) {
    updateDebug("ERROR: Webview not found!");
    return;
  }

  showLoading(true);

  if (welcomeMessage) welcomeMessage.style.display = "none";
  webview.style.display = "block";

  updateDebug("Setting webview src...");
  webview.src = url;

  const urlInput = document.getElementById("urlInput") as HTMLInputElement;
  urlInput.value = url;

  updateDebug("Navigation command sent");
}

function navigateToUrl(url: string) {
  updateDebug("Navigating to: " + url);
  updateDebugUrl(url);

  const webview = document.getElementById("webview") as any;

  if (!webview) {
    updateDebug("ERROR: Webview not found!");
    showToast("webview not found");
    return;
  }

  webview.src = url;
  currentUrl = url;
  showToast(url);

  const urlInput = document.getElementById("urlInput") as HTMLInputElement;
  urlInput.value = url;

  showWebview();
}

function showWebview() {
  const welcomeMessage = document.getElementById("welcomeMessage") as HTMLElement;
  const webview = document.getElementById("webview") as HTMLElement;

  welcomeMessage.style.display = "none";
  webview.style.display = "block";
  updateDebug("Webview shown");
  showToast("web view loaded");
}

function showWelcomeMessage() {
  const welcomeMessage = document.getElementById("welcomeMessage") as HTMLElement;
  const webview = document.getElementById("webview") as HTMLElement;

  welcomeMessage.style.display = "flex";
  webview.style.display = "none";

  const urlInput = document.getElementById("urlInput") as HTMLInputElement;
  urlInput.value = "";
  urlInput.focus();

  updateNavButtons();
  updateDebug("Welcome message shown");
}

function updateNavButtons() {
  const webview = document.getElementById("webview") as any;
  const backButton = document.getElementById("backButton") as HTMLButtonElement | null;

  if (backButton && webview) {
    backButton.disabled = !webview.canGoBack();
  }
}

function goBack() {
  const webview = document.getElementById("webview") as any;
  if (webview.canGoBack()) {
    webview.goBack();
    updateDebug("Going back");
  }
}

function goHome() {
  updateDebug("Going home");
  showWelcomeMessage();
}

function updateTimerDisplay(data: any) {
  const timeRemaining = document.getElementById("timeRemaining") as HTMLElement;
  const remaining = data.remaining || Math.max(0, data.endTime - Date.now());

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  timeRemaining.textContent = `${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  if (remaining < 60000) {
    timeRemaining.style.color = "#ff4444";
  } else if (remaining < 300000) {
    timeRemaining.style.color = "#ffaa00";
  } else {
    timeRemaining.style.color = "#44ff44";
  }
}

function startTimerUpdates() {
  updateDebug("Timer updates started");
}

function showToast(message: string) {
  const toast = document.getElementById("toast") as HTMLElement | null;
  if (toast) {
    toast.textContent = message;
    toast.style.display = "block";

    setTimeout(() => {
      toast.style.display = "none";
    }, 3000);
  }
  updateDebug("Toast: " + message);
}

function showBlockedOverlay(url: string) {
  const overlay = document.getElementById("blockedOverlay") as HTMLElement | null;
  const blockedUrl = document.getElementById("blockedUrl") as HTMLElement | null;

  if (overlay && blockedUrl) {
    blockedUrl.textContent = url;
    overlay.style.display = "flex";
  }
}

function hideBlockedOverlay() {
  const overlay = document.getElementById("blockedOverlay") as HTMLElement | null;
  if (overlay) {
    overlay.style.display = "none";
  }
  showWelcomeMessage();
}

function showSessionEndOverlay() {
  const overlay = document.getElementById("sessionEndOverlay") as HTMLElement | null;
  if (overlay) {
    overlay.style.display = "flex";
  }

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  updateDebug("Session ended");
}

function closeApp() {
  window.close();
}

document.addEventListener("DOMContentLoaded", initializeApp);
