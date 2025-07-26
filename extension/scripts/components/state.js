// Global state object
// Only persist in IDB when user click to view a chat

export const state = {
  pageContent: {},
  isAnimating: false,
  isProcessingQuery: false,
  history: [],
  currentConfig: null,
  isResizing: false,
  isConfigOpen: false,
  contentFetchAttempts: 0,
  maxContentFetchAttempts: 5,
  isGeneratingQuestions: false,
  generatedQuestions: {
    vn: [],
    en: [],
  },
  isNotesOpen: false,
  currentPageUrl: "",
  isEditingNote: false,
  currentEditingNoteTimestamp: null,
  language: "en", // Default language is English
  currentChat: {
    id: null,
    title: "",
    pageUrl: "",
    history: [],
  },
  pagination: {
    currentPage: 0,
    hasMore: true,
    isFetching: false,
  },
  chatHistory: [],
  isChatHistoryEventsInitialized: false,
  toastIdCounter: 0,
};

// Load sidebar width from storage
export function loadSidebarWidth() {
  chrome.storage.local.get(["sidebar_width"], (result) => {
    if (result.sidebar_width) {
      // Keep it in bounds
      const width = Math.min(
        Math.max(
          parseInt(result.sidebar_width),
          parseInt(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--sidebar-min-width"
            )
          )
        ),
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--sidebar-max-width"
          )
        )
      );
      document.documentElement.style.setProperty(
        "--sidebar-width",
        width + "px"
      );
      console.log("CocBot: Using width", width);
    }
  });
}

// Save sidebar width to storage
export function saveSidebarWidth(width) {
  chrome.storage.local.set({ sidebar_width: width }, () => {
    console.log("CocBot: Saved width", width);
  });
}

// Anon session management
export function getAnonSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["anon_session"], (result) => {
      console.log("Cocbot: Gotten anon session: ", resolve.anon_session);
      resolve(result.anon_session || null);
    });
  });
}

export function saveAnonSession(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ anon_session: { ...data, id: data.id } }, () =>
      resolve(data.id)
    );
  });
}

// Increase anon query count for the current anon session
export async function increaseAnonQueryCount() {
  const anonSession = await getAnonSession();
  await saveAnonSession({
    ...anonSession,
    anon_query_count: (anonSession.anon_query_count || 0) + 1,
  });
}

// User session management
export async function getUserSession() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["auth_session"], (result) => {
      console.log(`Cocbot: Gotten auth session `, result.auth_session);
      resolve(result.auth_session);
    });
  });
}

export async function saveUserSession(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ auth_session: { ...data, id: data.id } }, () => {
      console.log("CocBot: User session saved", data);
      resolve(true);
    });
  });
}

export async function clearUserSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove("auth_session", () => {
      console.log("CocBot: User session removed");
      resolve(true);
    });
  });
}

// Visitor ID management
export async function getVisitorId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["visitor_id"], (result) => {
      console.log(`Cocbot: Gotten visitor ID: `, result.visitor_id);
      resolve(result.visitor_id);
    });
  });
}

export async function setVisitorId(id) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ visitor_id: id }, () => {
      console.log("CocBot: Visitor ID saved", data);
      resolve(true);
    });
  });
}

export async function removeVisitorId() {
  return new Promise((resolve) => {
    chrome.storage.local.remove("visitor_id", () => {
      console.log("CocBot: Visitor ID removed");
      resolve(true);
    });
  });
}

// Config management
export async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["config"], (result) => {
      resolve(result.config || {});
    });
  });
}

export async function saveConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ config: config }, () => {
      console.log("CocBot: Config saved", config);
      resolve(config);
    });
  });
}

// Notes management
export async function getNotesForUrl(url) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["notes"], (result) => {
      const allNotes = result.notes || {};
      resolve(allNotes[url] || []);
    });
  });
}

export async function saveNote(note) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["notes"], (result) => {
      const allNotes = result.notes || {};
      const urlNotes = allNotes[note.url] || [];
      urlNotes.push(note);
      allNotes[note.url] = urlNotes;

      chrome.storage.local.set({ notes: allNotes }, () => {
        resolve();
      });
    });
  });
}

export async function updateNote(timestamp, content) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["notes"], (result) => {
      const allNotes = result.notes || {};
      const urlNotes = allNotes[state.currentPageUrl] || [];

      const noteIndex = urlNotes.findIndex(
        (note) => note.timestamp === timestamp
      );
      if (noteIndex !== -1) {
        urlNotes[noteIndex].content = content;
        allNotes[state.currentPageUrl] = urlNotes;

        chrome.storage.local.set({ notes: allNotes }, () => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

export async function deleteNote(timestamp) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["notes"], (result) => {
      const allNotes = result.notes || {};
      const urlNotes = allNotes[state.currentPageUrl] || [];

      const filteredNotes = urlNotes.filter(
        (note) => note.timestamp !== timestamp
      );
      allNotes[state.currentPageUrl] = filteredNotes;

      chrome.storage.local.set({ notes: allNotes }, () => {
        resolve();
      });
    });
  });
}

// lang preference management
export async function getLanguage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["language"], (result) => {
      resolve(result.language || "en"); //eng default
    });
  });
}

export async function saveLanguage(language) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ language: language }, () => {
      console.log("CocBot: Language preference saved", language);
      state.language = language;
      resolve(language);
    });
  });
}

// Page references management
export async function getStoredPageUrl(url) {
  return new Promise((resolve) => {
    chrome.storage.session.get(url, (result) => {
      resolve(result);
    });
  });
}

export async function saveStoredPageUrl(url) {
  return new Promise((resolve) => {
    chrome.storage.session.set({ url }, () => {
      console.log("Briefly: Stored page url saved", url);
      resolve(true);
    });
  });
}

export function resetCurrentChatState() {
  state.currentChat = {
    id: null,
    title: "",
    pageUrl: "",
    history: [],
  };
}

/**
 * Reset pagination state to default
 */
export function resetPaginationState() {
  state.pagination = {
    currentPage: 0,
    hasMore: true,
    isFetching: false,
  };
}

/**
 * Set current chat state
 * @param {Object} chat
 * @param {String} [chat.id]
 * @param {String} [chat.title]
 * @param {String} [chat.pageUrl]
 * @param {Array<Object>} [chat.history]
 */
export function setCurrentChatState(chat = {}) {
  state.currentChat = {
    id: chat.id || null,
    title: chat.title || "",
    pageUrl: chat.pageUrl || "",
    history: chat.history || [],
  };
}

/**
 * A helper function to send a request with session or visitor ID attached as headers.
 *
 * Session and visitor ID is attached in headers by default.
 *
 * @param {string} url The endpoint URL
 * @param {Object} options Fetch options with custom flags
 * @param {String} [options.method] HTTP method
 * @param {Object|FormData} [options.body] Request payload
 * @param {Object} [options.headers] Additional headers
 * @param {boolean} [options.withSession] Whether to include session in headers
 * @param {boolean} [options.withVisitorId] Whether to include visitor ID in headers
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function sendRequest(url, options = {}) {
  const {
    withSession = true,
    withVisitorId = true,
    headers: customHeaders,
    ...fetchOptions
  } = options;

  const headers = new Headers(customHeaders);

  if (withSession) {
    const userSession = await getUserSession();
    const anonSession = !userSession && (await getAnonSession());
    const sessionId = userSession?.id || anonSession?.id;
    if (!sessionId) throw new Error("No active session found");
    headers.set(
      "Authorization",
      `Bearer ${userSession ? `auth:${sessionId}` : `anon:${sessionId}`}`
    );
  }

  if (withVisitorId) {
    const visitorId = await getVisitorId();
    headers.set("Visitor", visitorId);
  }

  // JSON encoding
  if (
    fetchOptions.body &&
    typeof fetchOptions.body === "object" &&
    !(fetchOptions.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }

  const response = await fetch(url, { ...fetchOptions, headers });

  // Error handling
  if (!response.ok) {
    const data = await response.json();
    const { code, message } = data.error;
    // If user session is invalid, signed them out gracefully
    if (code === "UNAUTHORIZED") {
      clearUserSession().then(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "session_expired",
            });
          }
        });
      });
    } else {
      console.error(`Error ${code}: ${message}`);
    }
    throw new Error(`Request failed: ${code}: ${message}`);
  }

  const data = await response.json();

  // If server assigned a new anonymous session, save it
  if (
    data.meta &&
    data.meta.newAnonSessionAssigned &&
    data.meta.newAnonSession
  ) {
    console.log("New anon session assigned, saving to storage...");
    await saveAnonSession(data.meta.newAnonSession);
  }

  return data;
}
