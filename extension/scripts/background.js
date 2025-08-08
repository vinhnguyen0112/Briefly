import {
  getStoredPageUrl,
  saveStoredPageUrl,
  saveUserSession,
  sendRequest,
} from "./components/state.js";
import {
  authenticateWithFacebook,
  authenticateWithGoogle,
  signOut,
} from "./components/auth-handler.js";
import {
  handleCaptionImages,
  resetProcessedImages,
} from "./components/caption-handler.js";
import idbHandler from "./components/idb-handler.js";
import chatHandler from "./components/chat-handler.js";

const SERVER_URL = "https://dev-capstone-2025.coccoc.com";

const CHAT_QUERY_LIMIT = 20;
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
chrome.action.onClicked.addListener(async (tab) => {
  console.log("Extension icon clicked on tab:", tab.id);

  if (isProcessingClick) {
    console.log("Already processing a click, ignoring");
    return;
  }

  isProcessingClick = true;
  chrome.action.setPopup({ popup: "" });

  // Restricted pages
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

  // Inject script to check document's language
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const lang = document.documentElement.lang;
        console.log("Current document lang:", lang);
        return lang;
      },
    });
    const lang = results && results[0] && results[0].result;
    if (!lang || (!lang.startsWith("en") && !lang.startsWith("vi"))) {
      chrome.storage.local.set({ popupReason: "unsupported_lang" }, () => {
        chrome.action.setPopup({
          popup: "popup-unsupported-lang.html",
          tabId: tab.id,
        });
        chrome.action.openPopup();
        isProcessingClick = false;
      });
      return;
    }
  } catch (e) {
    chrome.action.setPopup({
      popup: "popup.html",
      tabId: tab.id,
    });
    chrome.action.openPopup();
    isProcessingClick = false;
    return;
  }

  console.log("Toggling sidebar");
  chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("Content script not yet injected, injecting now");
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
      .then((response) => {
        if (response.success) {
          saveUserSession(response.data)
            .then(() => {
              sendResponse({ success: true });
            })
            .catch((err) => {
              throw err;
            });
        } else {
          sendResponse({ success: false });
        }
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
      .then((response) => {
        if (response.success) {
          saveUserSession(response.data)
            .then(() => {
              sendResponse({ success: true });
            })
            .catch((err) => {
              throw err;
            });
        } else {
          sendResponse({ success: false });
        }
      })
      .catch((error) => {
        console.error("Failed to handle captions", error);
      });

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
  if (message.action === "fetch_chat_history") {
    chatHandler
      .getChatsForCurrentUser({
        offset: message.currentPage * CHAT_QUERY_LIMIT,
      })
      .then((response) => {
        if (response.success) {
          sendResponse({
            success: true,
            chats: response.data.chats,
            hasMore: response.data.hasMore,
          });
        } else {
          sendResponse({
            success: false,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to fetch chat history:", err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }
  if (message.action === "fetch_chat_messages") {
    chatHandler.getMessagesOfChat(message.chatId).then((response) => {
      sendResponse({
        success: response.success,
        messages: response.data.messages,
      });
    });

    return true;
  }
  if (message.action === "clear_chat_history") {
    // TODO: Run clear chats from IndexedDB in parallel as well
    chatHandler.deleteAllChatsOfCurrentUser().then((response) => {
      sendResponse({ success: response.success });
    });

    return true;
  }
  if (message.action === "store_page_metadata") {
    sendRequest(`${SERVER_URL}/api/pages`, {
      method: "POST",
      body: {
        page_url: message.page_url,
        title: message.title,
        page_content: message.page_content,
      },
      withVisitorId: false,
    })
      .then((response) => {
        console.log("store_page_metadata response: ", response);
        sendResponse({ success: response.success, data: response.data });
      })
      .catch((err) => {
        console.error("Failed to store page:", err);
        sendResponse({ success: false, data: null });
      });

    return true;
  }
  if (message.action === "store_page_summary") {
    sendRequest(`${SERVER_URL}/api/page-summaries`, {
      method: "POST",
      body: {
        page_url: message.page_url,
        language: message.language,
        summary: message.summary,
      },
      withVisitorId: false,
    })
      .then((response) => {
        console.log("store_page_summary response: ", response);
        sendResponse({ success: response.success });
      })
      .catch((err) => {
        console.error("Failed to store summary:", err);
        sendResponse({ success: false });
      });

    return true;
  }
  if (message.action === "get_page") {
    sendRequest(`${SERVER_URL}/api/pages/${message.page_id}`, {
      method: "GET",
    }).then((response) => {
      console.log("get_page response: ", response);
      sendResponse({
        success: response.success,
        page: response.data.page,
      });
    });

    return true;
  }
  if (message.action === "process_images") {
    resetProcessedImages();
    handleCaptionImages(message.images, message.content)
      .then((captions) => {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "caption_results",
          captions: captions,
        });
      })
      .catch((error) => {
        console.error("Failed to handle captions", error);
      });
    return true;
  }
});

// Observe change in storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  // Notify all tabs if auth session changed
  if (areaName === "local" && changes.auth_session) {
    const isAuth = !!changes.auth_session.newValue; // Convert to boolean
    console.log("Briefly: Auth state changed: ", isAuth);

    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "auth_session_changed",
            isAuth,
          },
          () => {
            if (chrome.runtime.lastError) {
              console.error(
                `Error sending message to tab ${tab.id}:`,
                chrome.runtime.lastError.message
              );
            }
          }
        );
      });
    });

    // Clear chats from IDB
    idbHandler.clearChats();
  }
});
