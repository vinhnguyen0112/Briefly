// create and inject the sidebar UI
function injectSidebar() {
  // only inject if not already done
  // differentiate with window sidebar
  if (window.isalSidebarInjected) return;
  window.isalSidebarInjected = true;

  console.log("CocBot: Injecting sidebar");

  // Create container for sidebar
  const container = document.createElement("div");
  container.id = "isal-sidebar-container";

  // Create iframe to load sidebar.html
  const iframe = document.createElement("iframe");
  iframe.id = "isal-sidebar-iframe";
  iframe.src = chrome.runtime.getURL("sidebar.html");
  container.appendChild(iframe);

  // Create toggle button
  const toggleButton = document.createElement("button");
  toggleButton.id = "isal-toggle-button";
  toggleButton.innerHTML = "&lt;";
  toggleButton.title = "Toggle Assistant";

  // Add elements to the page
  document.body.appendChild(container);
  document.body.appendChild(toggleButton);

  // Toggle sidebar visibility when button is clicked
  toggleButton.addEventListener("click", () => {
    toggleSidebar();
  });

  // Setup communication between sidebar iframe and content script
  window.addEventListener("message", (event) => {
    // Ensure message is from our sidebar
    if (event.source === iframe.contentWindow) {
      handleSidebarMessage(event.data);
    }
  });

  // Add resize observer to handle sidebar width changes
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === container) {
        // Update the iframe width to match container
        iframe.style.width = "100%";
        iframe.style.height = "100%";
      }
    }
  });

  // Observe the container for size changes
  resizeObserver.observe(container);

  console.log("CocBot: Sidebar injected successfully");

  // Don't automatically open the sidebar on page load
  // Just check if it was previously forced open
  chrome.storage.local.get(["sidebarActive"], (data) => {
    // We only want to auto-open if explicitly requested
    if (data.sidebarActive === true && data.forceOpen === true) {
      setTimeout(() => {
        toggleSidebar(true);
      }, 100);
    } else {
      // Make sure sidebar is closed by default
      chrome.storage.local.set({ sidebarActive: false, forceOpen: false });
    }
  });
}

// Toggle sidebar visibility
function toggleSidebar(forceState) {
  console.log("CocBot: Toggle sidebar requested, forceState:", forceState);

  const container = document.getElementById("isal-sidebar-container");
  const toggleButton = document.getElementById("isal-toggle-button");

  if (container && toggleButton) {
    // If forceState is provided, use it, otherwise toggle current state
    const isActive =
      forceState !== undefined
        ? forceState
        : container.classList.toggle("active");

    // Ensure class reflects the correct state
    if (isActive) {
      container.classList.add("active");

      // Get saved width from storage
      chrome.storage.local.get(["sidebar_width"], (result) => {
        if (result.sidebar_width) {
          // Apply saved width
          container.style.width = result.sidebar_width + "px";
        }
      });
    } else {
      container.classList.remove("active");
    }

    toggleButton.innerHTML = isActive ? "&gt;" : "&lt;";
    console.log("CocBot: Sidebar toggled, active state:", isActive);

    // Save state to extension storage
    chrome.storage.local.set({ sidebarActive: isActive });
  } else {
    console.error("CocBot: Sidebar elements not found");
    // Try to re-inject if elements are missing
    if (!window.isalSidebarInjected) {
      injectSidebar();
      // Try toggle again after injection
      setTimeout(() => {
        const newContainer = document.getElementById("isal-sidebar-container");
        if (newContainer) {
          newContainer.classList.add("active");
          chrome.storage.local.set({ sidebarActive: true });
          const newToggleButton = document.getElementById("isal-toggle-button");
          if (newToggleButton) {
            newToggleButton.innerHTML = "&gt;";
          }

          // Get saved width from storage
          chrome.storage.local.get(["sidebar_width"], (result) => {
            if (result.sidebar_width) {
              // Apply saved width
              newContainer.style.width = result.sidebar_width + "px";
            }
          });
        }
      }, 100);
    }
  }
}

let collectedCaptions = [];
let lastExtractedContent = null;
function handleSidebarMessage(message) {
  console.log("CocBot: Received message from sidebar:", message.action);

  switch (message.action) {
    case "close_sidebar":
      const container = document.getElementById("isal-sidebar-container");
      if (container) {
        container.classList.remove("active");
        document.getElementById("isal-toggle-button").innerHTML = "&lt;";
      }
      break;

    case "get_page_content":
      console.log("CocBot: Extracting page content");
      try {
        const pageContent = extractPageContent(); // Uses the global function
        console.log("CocBot: Content extracted successfully", {
          title: pageContent.title,
          url: pageContent.url,
        });

        // Send page content back to sidebar
        const iframe = document.getElementById("isal-sidebar-iframe");
        if (iframe) {
          iframe.contentWindow.postMessage(
            {
              action: "page_content",
              content: pageContent,
            },
            "*"
          );
          console.log("CocBot: Page content sent to sidebar");
        } else {
          console.error("CocBot: Sidebar iframe not found");
        }
      } catch (error) {
        console.error("CocBot: Error extracting content", error);
      }
      break;

    case "sidebar_width_changed":
      // Update container width to match sidebar
      const sidebarContainer = document.getElementById(
        "isal-sidebar-container"
      );
      if (sidebarContainer && message.width) {
        sidebarContainer.style.width = message.width + "px";
        console.log("CocBot: Updated container width to", message.width);
      }
      break;
  }
}

// listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("CocBot: Message received in content script:", message);

  if (message.action === "toggle_sidebar") {
    // ensure sidebar is injected first
    if (!window.isalSidebarInjected) {
      injectSidebar();
    }
    // Use a slight delay to ensure sidebar elements are ready after potential injection
    setTimeout(() => {
      toggleSidebar();
      sendResponse({ success: true });
    }, 50);
  } else if (message.action === "extract_content") {
    // Support direct extraction request from background script
    const content = extractPageContent();
    sendResponse({ success: true, content: content });
  } else if (message.action === "url_changed") {
    console.log("CocBot: URL change detected:", message.url);

    // If sidebar is active, notify it to refresh content
    const iframe = document.getElementById("isal-sidebar-iframe");
    const container = document.getElementById("isal-sidebar-container");

    // Only update if the sidebar is currently open
    if (iframe && container && container.classList.contains("active")) {
      console.log("CocBot: Notifying sidebar to refresh content for new URL");

      iframe.contentWindow.postMessage(
        {
          action: "refresh_page_content",
          url: message.url,
        },
        "*"
      );
    }

    sendResponse({ success: true });
  } else if (message.action === "image_processing_done") {
    if (message.page_url && message.page_url !== location.href) {
      console.warn("Mismatch captions for page url:", message.page_url);
      return;
    }

    const iframe = document.getElementById("isal-sidebar-iframe");
    if (iframe) {
      iframe.contentWindow.postMessage(
        {
          action: "image_processing_done",
          success: message.success,
        },
        "*"
      );
    }
  } else if (message.action === "auth_session_changed") {
    const iframe = document.getElementById("isal-sidebar-iframe");

    // Update UI via sidebar
    if (iframe) {
      console.log("CocBot: Notifying sidebar to react to auth session change");

      iframe.contentWindow.postMessage(
        {
          action: "auth_session_changed",
          isAuth: message.isAuth,
        },
        "*"
      );
    } else {
      console.error("Iframe is not ready, cannot post message");
    }
    sendResponse({ success: true });
  }
  if (message.action === "session_expired") {
    const iframe = document.getElementById("isal-sidebar-iframe");
    const container = document.getElementById("isal-sidebar-container");

    // Only update if the sidebar is currently open
    if (iframe && container && container.classList.contains("active")) {
      console.log("CocBot: Notifying sidebar to react to auth session change");

      // Send message to the sidebar and update the UI
      iframe.contentWindow.postMessage(
        {
          action: "session_expired",
        },
        "*"
      );
    }
    sendResponse({ success: true });
  }
  if (message.action === "anon_query_limit_reached") {
    const iframe = document.getElementById("isal-sidebar-iframe");
    const container = document.getElementById("isal-sidebar-container");

    // Only update if the sidebar is currently open
    if (iframe && container && container.classList.contains("active")) {
      console.log("CocBot: Notifying sidebar to react to auth session change");

      // Send message to the sidebar and update the UI
      iframe.contentWindow.postMessage(
        {
          action: "anon_query_limit_reached",
        },
        "*"
      );
    }
    sendResponse({ success: true });
  }
  if (message.action === "sign_in_required") {
    const iframe = document.getElementById("isal-sidebar-iframe");
    const container = document.getElementById("isal-sidebar-container");

    // Only update if the sidebar is currently open
    if (iframe && container && container.classList.contains("active")) {
      console.log("CocBot: Notifying sidebar to react to auth session change");

      // Send message to the sidebar and update the UI
      iframe.contentWindow.postMessage(
        {
          action: "sign_in_required",
        },
        "*"
      );
    }
    sendResponse({ success: true });
  }
  return true;
});

// PAGE NEEDS TO LOAD FULLY before injecting
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectSidebar);
} else {
  injectSidebar();
}

// Track URL changes in single-page applications (SPA) that use History API
let lastUrl = location.href;

// Set up an observer to detect URL changes
const urlObserver = new MutationObserver(() => {
  if (lastUrl !== location.href) {
    console.log("CocBot: URL change detected via History API navigation");
    const newUrl = location.href;

    // Handle URL change in the same way as a normal navigation
    const iframe = document.getElementById("isal-sidebar-iframe");
    const container = document.getElementById("isal-sidebar-container");

    // Only update if the sidebar is currently open
    if (iframe && container && container.classList.contains("active")) {
      console.log(
        "CocBot: Notifying sidebar to refresh content for new URL (SPA navigation)"
      );

      iframe.contentWindow.postMessage(
        {
          action: "refresh_page_content",
          url: newUrl,
        },
        "*"
      );
    }

    lastUrl = newUrl;
  }
});

// Start observing
urlObserver.observe(document, { subtree: true, childList: true });

// Also handle popstate events (back/forward navigation)
window.addEventListener("popstate", () => {
  if (lastUrl !== location.href) {
    console.log("CocBot: URL change detected via popstate event");
    const newUrl = location.href;

    // Handle URL change in the same way as a normal navigation
    const iframe = document.getElementById("isal-sidebar-iframe");
    const container = document.getElementById("isal-sidebar-container");

    // Only update if the sidebar is currently open
    if (iframe && container && container.classList.contains("active")) {
      console.log(
        "CocBot: Notifying sidebar to refresh content for popstate navigation"
      );

      iframe.contentWindow.postMessage(
        {
          action: "refresh_page_content",
          url: newUrl,
        },
        "*"
      );
    }

    lastUrl = newUrl;
  }
});

function extractAndCachePageContent() {
  const raw = extractPageContent();
  lastExtractedContent = { ...raw, captions: collectedCaptions };
  return lastExtractedContent;
}

function sendToSidebar(content) {
  const iframe = document.getElementById("isal-sidebar-iframe");
  if (iframe) {
    iframe.contentWindow.postMessage(
      {
        action: "page_content",
        content,
      },
      "*"
    );
    console.log("Sent updated page content to sidebar");
  } else {
    console.error("CocBot: Sidebar iframe not found");
  }
}
