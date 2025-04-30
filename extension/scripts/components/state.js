// State management module

// Global state object
export const state = {
  welcomeMode: true,
  pageContent: null,
  isAnimating: false,
  history: [],
  currentConfig: null,
  isResizing: false,
  isSettingsOpen: false,
  isConfigOpen: false,
  isContentViewerOpen: false,
  contentFetchAttempts: 0,
  maxContentFetchAttempts: 5,
  isGeneratingQuestions: false,
  generatedQuestions: null,
  isNotesOpen: false,
  currentPageUrl: "",
  isEditingNote: false,
  currentEditingNoteTimestamp: null,
  isAuthenticated: false,
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

// Anon query management
export async function getAnonQueryCount() {
  return new Promise((resolve) => {
    chrome.storage.local.get("anon_query_count", (result) => {
      resolve(result.anon_query_count);
    });
  });
}

export async function setAnonQueryCount(count) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ anon_query_count: count }, (result) => {
      resolve(true);
    });
  });
}

// User session management
export async function getUserSession() {
  return new Promise((resolve) => {
    const start = performance.now();
    chrome.storage.local.get("session_id", (result) => {
      const end = performance.now();
      console.log(`Get user sessions took: ${end - start} s`);
      resolve(result.session_id);
    });
  });
}

export async function saveUserSession(sessionId) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ session_id: sessionId }, () => {
      console.log("CocBot: User session saved", sessionId);
      resolve(true);
    });
  });
}

export async function clearUserSession() {
  return new Promise((resolve) => {
    chrome.storage.local.remove("session_id", () => {
      console.log("CocBot: User session removed");
      resolve(true);
    });
  });
}

// API key management
export async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["openai_api_key"], (result) => {
      resolve(result.openai_api_key);
    });
  });
}

export async function saveApiKey(apiKey) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ openai_api_key: apiKey }, () => {
      resolve();
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
