import {
  authenticateWithFacebook,
  authenticateWithGoogle,
  isUserAuthenticated,
  signOut,
} from "./components/auth-handler.js";
import { openIndexedDB } from "./components/idb-handler.js";
import { saveUserSession, state } from "./components/state.js";

//  first install
chrome.runtime.onInstalled.addListener(() => {
  console.log("CocBot extension installed");

  // No popup initially
  chrome.action.setPopup({ popup: "" });

  // initial state
  chrome.storage.local.set({
    sidebarActive: false,
  });
});

// Don't let people spam-click
let isProcessingClick = false;

// Where we store content for the popup
let popupContent = null;

// Track active content extraction
let activeExtraction = null;

// When user clicks our icon
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked on tab:", tab.id);

  // Prevent multiple rapid clicks -- fuck them users
  if (isProcessingClick) {
    console.log("Already processing a click, ignoring");
    return;
  }

  isProcessingClick = true;

  // no popup is set
  chrome.action.setPopup({ popup: "" });

  // Can't mess with Chrome pages - show popup instead
  if (
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("https://chrome.google.com/webstore/")
  ) {
    console.log("Restricted page, showing popup instead");

    chrome.action.setPopup({
      popup: "popup.html",
      tabId: tab.id,
    });

    chrome.action.openPopup();
    isProcessingClick = false;
    return;
  }

  console.log("Toggling sidebar");

  // Try to message content script if it's already there
  chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Content script not yet injected, injecting now");

      // Need to inject scripts first
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ["components/ContentExtractor.js"],
        })
        .then(() => {
          console.log("ContentExtractor.js injected successfully");
          return chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });
        })
        .then(() => {
          // Now try again
          console.log("All scripts injected, sending toggle message");
          setTimeout(() => {
            chrome.tabs
              .sendMessage(tab.id, { action: "toggle_sidebar" })
              .catch((error) =>
                console.error("Error sending message after injection:", error)
              );
            isProcessingClick = false;
          }, 500);
        })
        .catch((error) => {
          console.error("Error injecting content script:", error);

          // Show error in popup
          chrome.action.setPopup({
            popup: "popup.html",
            tabId: tab.id,
          });

          chrome.action.openPopup();
          isProcessingClick = false;
        });
    } else {
      console.log("Content script already injected, message sent successfully");
      isProcessingClick = false;
    }
  });
});

// Reset when tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    chrome.action.setPopup({
      popup: "",
      tabId: tabId,
    });
    isProcessingClick = false;

    // Clear cached content when URL changes
    if (changeInfo.url) {
      console.log("CocBot: URL changed, clearing cached content");
      popupContent = null;

      // Notify sidebar to refresh content for the new page
      try {
        chrome.tabs
          .sendMessage(tabId, {
            action: "url_changed",
            url: changeInfo.url,
          })
          .catch((error) => {
            // Ignore errors; the content script might not be injected yet
            console.log(
              "CocBot: Could not notify sidebar of URL change (might not be open)"
            );
          });
      } catch (e) {
        // Ignore errors; the content script might not be injected yet
      }
    }
  }
});

// Clean up when popup is closed
function resetPopupState(tabId) {
  console.log("Forcefully resetting popup state for tab:", tabId);

  chrome.action.setPopup({
    popup: "",
    tabId: tabId,
  });

  isProcessingClick = false;
}

// Get content from active tab
async function extractContentFromActiveTab() {
  // Only do one extraction at a time
  if (activeExtraction) {
    console.log(
      "Content extraction already in progress, returning existing promise"
    );
    return activeExtraction;
  }

  try {
    // Start extraction
    activeExtraction = (async () => {
      console.log("Starting new content extraction");
      try {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!activeTab) {
          console.log("No active tab found during content extraction");
          return { success: false, error: "No active tab found" };
        }

        if (!activeTab.url) {
          console.log("Active tab has no URL");
          return {
            success: false,
            error: "Active tab has no URL or is inaccessible",
          };
        }

        // Check if we're on a restricted page
        try {
          if (
            activeTab.url.startsWith("chrome://") ||
            activeTab.url.startsWith("chrome-extension://") ||
            activeTab.url.startsWith("https://chrome.google.com/webstore/")
          ) {
            return {
              success: false,
              error:
                "Cannot extract content from this page type. Try on a regular webpage.",
            };
          }
        } catch (urlError) {
          console.error("Error checking tab URL:", urlError);
          return {
            success: false,
            error: "Error checking tab URL: " + urlError.message,
          };
        }

        if (typeof activeTab.id !== "number") {
          return { success: false, error: "Invalid tab ID" };
        }

        try {
          return await new Promise((resolve) => {
            chrome.tabs.sendMessage(
              activeTab.id,
              { action: "extract_content" },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.log(
                    "Content script not yet injected, injecting now for extraction"
                  );

                  // Inject the content extractor script
                  chrome.scripting
                    .executeScript({
                      target: { tabId: activeTab.id },
                      files: ["components/ContentExtractor.js"],
                    })
                    .then(() => {
                      console.log(
                        "ContentExtractor.js injected successfully for extraction"
                      );
                      return chrome.scripting.executeScript({
                        target: { tabId: activeTab.id },
                        function: () => {
                          if (typeof window.extractPageContent === "function") {
                            return window.extractPageContent();
                          } else {
                            console.error(
                              "extractPageContent function not found"
                            );
                            return { error: "Content extractor not available" };
                          }
                        },
                      });
                    })
                    .then((results) => {
                      if (results && results[0] && results[0].result) {
                        const extractedContent = results[0].result;
                        // Cache the content for quicker access later
                        popupContent = extractedContent;
                        resolve({ success: true, content: extractedContent });
                      } else {
                        resolve({
                          success: false,
                          error:
                            "Failed to extract content after script injection",
                        });
                      }
                    })
                    .catch((error) => {
                      console.error(
                        "Error in content extraction process:",
                        error
                      );
                      resolve({
                        success: false,
                        error:
                          "Error injecting content extractor: " + error.message,
                      });
                    });
                } else if (response && response.success) {
                  // Cache the content for quicker access later
                  popupContent = response.content;
                  resolve({ success: true, content: response.content });
                } else {
                  resolve({
                    success: false,
                    error:
                      response?.error || "Unknown error extracting content",
                  });
                }
              }
            );
          });
        } catch (error) {
          console.error("Error in extraction process:", error);
          return {
            success: false,
            error: "Error during content extraction: " + error.message,
          };
        }
      } catch (error) {
        console.error("Error in extractContentFromActiveTab:", error);
        return {
          success: false,
          error: "Error getting active tab: " + error.message,
        };
      } finally {
        // Clear the active extraction when done
        setTimeout(() => {
          activeExtraction = null;
        }, 500);
      }
    })();

    return activeExtraction;
  } catch (error) {
    console.error("Major error in extraction handler:", error);
    return {
      success: false,
      error: "Critical extraction error: " + error.message,
    };
  }
}

// Show content in popup
function openContentViewerPopup(content) {
  popupContent = content;

  // popup dimensions
  const width = 600;
  const height = 700;

  // current window to center the popup
  chrome.windows.getCurrent((currentWindow) => {
    const left = Math.round(
      (currentWindow.width - width) / 2 + currentWindow.left
    );
    const top = Math.round(
      (currentWindow.height - height) / 2 + currentWindow.top
    );

    //the popup window
    chrome.windows.create(
      {
        url: chrome.runtime.getURL("popup-content-viewer.html"),
        type: "popup",
        width: width,
        height: height,
        left: left,
        top: top,
        focused: true,
      },
      (window) => {
        console.log("CocBot: Content viewer popup created with ID:", window.id);
      }
    );
  });

  return { success: true };
}

//opening settings popup if requested
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message.action);

  if (message.action === "openSettings") {
    //popup for the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        console.log("Opening settings popup on tab:", tabs[0].id);

        chrome.action.setPopup(
          {
            popup: "popup.html",
            tabId: tabs[0].id,
          },
          () => {
            // try to open the popup
            chrome.action.openPopup();
          }
        );
      }
    });
    sendResponse({ success: true });
    return true;
  }

  // When settings popup is closed, reset action popup
  if (message.action === "closeSettings") {
    console.log("Closing settings - resetting popup state");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        resetPopupState(tabs[0].id);
      }
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "saveApiKey") {
    // API key to chrome storage
    chrome.storage.sync.set({ openaiApiKey: message.apiKey }, () => {
      console.log("API key saved");

      if (sender.tab) {
        chrome.action.setPopup({
          popup: "",
          tabId: sender.tab.id,
        });
      }

      sendResponse({ success: true });
    });
    return true; //async response
  }

  if (message.action === "getApiKey") {
    chrome.storage.sync.get(["openaiApiKey"], (result) => {
      sendResponse({ apiKey: result.openaiApiKey || "" });
    });
    return true; // async response
  }

  if (message.action === "extract_page_content") {
    console.log(
      "CocBot: Received extract_page_content request",
      message.forceRefresh ? "(forced refresh)" : ""
    );

    // Check if we have cached content first and don't need to force refresh
    if (popupContent && !message.forceRefresh) {
      console.log("CocBot: Using cached content");
      sendResponse({ success: true, content: popupContent });

      // Still refresh in the background but don't wait for it
      extractContentFromActiveTab()
        .then((result) => {
          if (result.success) {
            console.log("CocBot: Background refresh successful");
          }
        })
        .catch((error) => {
          console.error("CocBot: Background refresh error:", error);
        });

      return true; // message channel open
    }

    // Extract content from the active tab
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs || tabs.length === 0) {
          console.error("CocBot: No active tab found for content extraction");
          sendResponse({
            success: false,
            error: "No active tab found",
            content: {
              title: "No Active Tab",
              url: "",
              content:
                "Unable to extract content because no active tab was found. Please try refreshing the page or opening the extension on a different page.",
              timestamp: new Date().toISOString(),
              extractionSuccess: false,
            },
          });
          return;
        }

        // We have an active tab, proceed with extraction
        extractContentFromActiveTab()
          .then((result) => {
            console.log(
              "CocBot: Content extraction result:",
              result.success ? "Success" : "Failed",
              result.error || ""
            );

            // If we fail but have a tab, create a minimal content object
            if (!result.success && tabs[0]) {
              result.content = {
                title: tabs[0].title || "Unknown Page",
                url: tabs[0].url || "unknown-url",
                content:
                  "Content extraction failed: " +
                  (result.error || "Unknown error"),
                timestamp: new Date().toISOString(),
                extractionSuccess: false,
              };
            }

            sendResponse(result);
          })
          .catch((error) => {
            console.error("CocBot: Error in extraction:", error);
            sendResponse({
              success: false,
              error: "Error processing extraction request: " + error.message,
              content: {
                title: tabs[0] ? tabs[0].title || "Error Page" : "Error Page",
                url: tabs[0] ? tabs[0].url || "" : "",
                content:
                  "An error occurred while extracting content from this page: " +
                  error.message,
                timestamp: new Date().toISOString(),
                extractionSuccess: false,
              },
            });
          });
      });

      // Keep the message channel open for the async response
      return true;
    } catch (error) {
      console.error(
        "CocBot: Critical error in extract_page_content handler:",
        error
      );
      sendResponse({
        success: false,
        error: "Critical error processing extraction request: " + error.message,
        content: {
          title: "Error Page",
          url: "",
          content:
            "A critical error occurred in the content extraction system: " +
            error.message,
          timestamp: new Date().toISOString(),
          extractionSuccess: false,
        },
      });
      return true;
    }
  }

  if (message.action === "display_content_popup") {
    console.log("CocBot: Received request to display content in popup");

    if (message.useSidebar) {
      console.log("CocBot: Using sidebar content viewer instead of popup");
      sendResponse({ success: true, content: message.content || popupContent });
      return true;
    }

    if (message.content) {
      const result = openContentViewerPopup(message.content);
      sendResponse(result);
    } else {
      // If no content was provided, try to extract it first
      extractContentFromActiveTab()
        .then((result) => {
          if (result.success) {
            openContentViewerPopup(result.content);
            sendResponse({ success: true });
          } else {
            console.error("CocBot: Failed to extract content for popup");
            sendResponse({
              success: false,
              error: result.error || "Failed to extract content for display",
            });
          }
        })
        .catch((error) => {
          console.error("CocBot: Error extracting content for popup:", error);
          sendResponse({
            success: false,
            error: "Error extracting content: " + error.message,
          });
        });

      return true;
    }
  }

  if (message.action === "google_login") {
    console.log("CocBot: Received request to authenticate with Google");

    authenticateWithGoogle()
      .then((sessionId) => {
        console.log("Session ID: ", sessionId);
        // Store sessionId into extension's local storage
        saveUserSession(sessionId)
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((err) => {
            throw err;
          });
      })
      .catch((err) => {
        console.error(err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep the message channel open for async response
  }
  if (message.action === "facebook_login") {
    console.log("CocBot: Received request to authenticate with Facebook");
    authenticateWithFacebook()
      .then((sessionId) => {
        console.log("Sessions ID: ", sessionId);
        saveUserSession(sessionId)
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((err) => {
            throw err;
          });
      })
      .catch((err) => console.error(err));

    return true;
  }
  if (message.action === "sign_out") {
    console.log("CocBot: Received request to sign out");
    signOut()
      .then((success) => {
        if (success) {
          console.log("Sign out sucessfully");
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
      })
      .catch((err) => {
        console.error(err);
        sendResponse({ success: false, message: err.message });
      });

    return true;
  }
  if (message.action === "setup_storage") {
    console.log("CocBot: Setting up IndexedDB storage");

    openIndexedDB()
      .then((response) => {
        if (response.success) {
          console.log("IndexedDB setup complete:", response);
          sendResponse({
            success: true,
            db: response.db,
            message: "Database setup complete",
          });
        } else {
          console.error("Error setting up IndexedDB:", error);
          sendResponse({ success: false, message: "Failed to setup storage" });
        }
      })
      .catch((error) => {
        console.error("Error setting up IndexedDB:", error);
        sendResponse({ success: false, message: error.message });
      });

    return true; // Keep the message channel open for async response
  }
});
