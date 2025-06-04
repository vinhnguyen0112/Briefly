// Global state object
// TODO: Handle pagination state
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
  language: "en", // Default language is English
  currentChat: {
    id: null,
    title: "",
    pageUrl: "",
    history: [],
  },
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
export async function incrementAnonQueryCount() {
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

export async function resetCurrentChat() {
  state.currentChat = {
    id: null,
    title: "",
    pageUrl: "",
    history: [],
  };

  const cleared = !state.currentChat.id;

  return cleared;
}

export function setCurrentChat(chat) {
  state.currentChat = {
    id: chat.id || null,
    title: chat.title || "",
    pageUrl: chat.pageUrl || "",
    history: chat.history || [],
  };
}
