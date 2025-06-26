// ui interaction stuff
import { elements } from "./dom-elements.js";
import { state, saveSidebarWidth } from "./state.js";
import {
  renderContentInSidebar,
  requestPageContent,
  updateContentStatus,
} from "./content-handler.js";
import { renderToggleAccountPopupUI } from "./event-handler.js";

// close all panels
export function closeAllPanels() {
  // hide settings
  elements.apiKeyContainer.style.display = "none";
  elements.settingsButton.classList.remove("active");
  state.isSettingsOpen = false;

  // hide config
  elements.configContainer.style.display = "none";
  elements.configButton.classList.remove("active");
  state.isConfigOpen = false;

  // hide content viewer
  elements.contentViewerScreen.style.display = "none";
  elements.viewContentButton.classList.remove("active");
  state.isContentViewerOpen = false;

  // hide notes
  elements.notesScreen.style.display = "none";
  elements.notesButton.classList.remove("active");
  state.isNotesOpen = false;

  // show main screen
  if (state.welcomeMode) {
    elements.welcomeScreen.style.display = "flex";
  } else {
    elements.chatScreen.style.display = "flex";
  }
}

// set up quick action buttons
export function setupQuickActions() {
  // hook up each button
  elements.quickActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");
      let query = "";

      switch (action) {
        case "summarize":
          query = "Summarize this page in a concise way.";
          break;
        case "keypoints":
          query = "What are the key points of this page?";
          break;
        case "explain":
          query = "Explain the content of this page as if I'm a beginner.";
          break;
      }

      if (query) {
        // jump to chat and fire the query
        switchToChat();
        processUserQuery(query);
      }
    });
  });
}

// handle resize events
export function handleResize(e) {
  if (!state.isResizing) return;

  // figure out new width
  const sidebarRect = elements.sidebar.getBoundingClientRect();
  const newWidth = window.innerWidth - e.clientX;

  // keep it in bounds
  const minWidth = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--sidebar-min-width"
    )
  );
  const maxWidth = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--sidebar-max-width"
    )
  );

  const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

  // update width
  document.documentElement.style.setProperty(
    "--sidebar-width",
    constrainedWidth + "px"
  );

  // tell parent to resize too
  window.parent.postMessage(
    {
      action: "sidebar_width_changed",
      width: constrainedWidth,
    },
    "*"
  );
}

// done resizing
export function stopResize() {
  if (state.isResizing) {
    state.isResizing = false;
    elements.resizeHandle.classList.remove("active");
    document.body.classList.remove("sidebar-resizing");
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);

    // save the width
    const currentWidth = getComputedStyle(elements.sidebar).width;
    const widthValue = parseInt(currentWidth);
    saveSidebarWidth(widthValue);

    // tell parent about final size
    window.parent.postMessage(
      {
        action: "sidebar_width_changed",
        width: widthValue,
      },
      "*"
    );
  }
}

// switch from welcome to chat view
export function switchToChat() {
  if (!state.welcomeMode) return;

  state.welcomeMode = false;

  // hide welcome
  elements.welcomeScreen.style.display = "none";

  // show chat
  elements.chatScreen.style.display = "flex";

  // focus input
  elements.userInput.focus();

  // remember generated questions so they appear when switching back
  const existingQuestions = state.generatedQuestions;

  // store a reference to switch back
  const backButton = document.createElement("button");
  backButton.className = "back-to-welcome-button";
  backButton.textContent = "← Back";
  backButton.onclick = () => {
    state.welcomeMode = true;
    elements.chatScreen.style.display = "none";
    elements.welcomeScreen.style.display = "flex";

    // restore questions if we had them
    if (existingQuestions && existingQuestions.length > 0) {
      state.generatedQuestions = existingQuestions;
      const questionsContainer = document.querySelector(".generated-questions");
      const buttonContainer = document.querySelector(
        ".question-buttons-container"
      );

      if (questionsContainer && buttonContainer) {
        questionsContainer.style.display = "block";
        buttonContainer.innerHTML = "";

        existingQuestions.forEach((question) => {
          const questionButton = document.createElement("button");
          questionButton.className = "question-button";
          questionButton.textContent = question;
          questionButton.onclick = () => {
            switchToChat();
            processUserQuery(question);
          };

          buttonContainer.appendChild(questionButton);
        });
      }
    }

    backButton.remove();
  };

  if (!document.querySelector(".back-to-welcome-button")) {
    document.querySelector(".sidebar-content").prepend(backButton);
  }
}

// add message to chat
// ...existing code...
export function addMessageToChat(message, role) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${role}-message`;
  if (role === "assistant") {
    messageElement.innerHTML = `
    <div class="message-content">${formatMessage(message)}</div>
  `;
    const feedbackBtn = document.createElement("button");
    feedbackBtn.className = "feedback-icon";
    feedbackBtn.title = "Send feedback";
    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("icons/feedback.png");
    img.alt = "Feedback";
    feedbackBtn.appendChild(img);
    feedbackBtn.onclick = () => {
      console.log("Feedback icon clicked!");
      showFeedbackModal();
    };
    messageElement.appendChild(feedbackBtn);
  } else {
    messageElement.innerHTML = `
      <div class="message-content">${formatMessage(message)}</div>
    `;
  }

  elements.chatContainer.appendChild(messageElement);
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

function showFeedbackModal() {
  if (document.getElementById("cocbot-feedback-modal")) return;

  console.log("Opening feedback modal...");

  // Thêm blur cho sidebar
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) sidebar.classList.add("cocbot-blur");

  const modal = document.createElement("div");
  modal.id = "cocbot-feedback-modal";
  modal.innerHTML = `
    <div class="cocbot-modal-backdrop"></div>
    <div class="cocbot-modal-content feedback-modal">
      <h2 class="feedback-title">Give Feedback</h2>
      <div class="feedback-subtitle">Rating your experience with Briefly</div>
      ${renderStars()}
      <div class="feedback-reason-label">
        Write your feedback <span class="optional-label">(optional)</span>
      </div>
      <textarea class="feedback-reason-input" placeholder="please write here"></textarea>
      <div class="feedback-modal-actions">
        <button class="button feedback-submit">Submit</button>
        <button class="button feedback-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Đóng modal khi click backdrop
  modal
    .querySelector(".cocbot-modal-backdrop")
    .addEventListener("click", () => {
      modal.remove();
      if (sidebar) sidebar.classList.remove("cocbot-blur");
    });

  // Ngăn nổi bọt khi click vào modal content
  modal
    .querySelector(".cocbot-modal-content")
    .addEventListener("click", (e) => {
      e.stopPropagation();
    });

  // Star rating logic
  const ratingItems = modal.querySelectorAll(".feedback-rating-item");
  let selectedRate = null;
  const submitBtn = modal.querySelector(".feedback-submit");
  submitBtn.disabled = true; // Disable submit ban đầu

  ratingItems.forEach((item, idx) => {
    item.addEventListener("mouseenter", () => {
      ratingItems.forEach((el, i) => {
        el.classList.toggle("hovered", i <= idx);
        el.classList.toggle(
          "selected",
          selectedRate && i < selectedRate && i <= idx
        );
      });
    });
    item.addEventListener("mouseleave", () => {
      ratingItems.forEach((el) => el.classList.remove("hovered"));
      ratingItems.forEach((el, i) => {
        el.classList.toggle("selected", selectedRate && i < selectedRate);
      });
    });
    item.addEventListener("click", () => {
      if (selectedRate === idx + 1) {
        selectedRate = null;
        ratingItems.forEach((el) => el.classList.remove("selected"));
        submitBtn.disabled = true; // Disable khi bỏ chọn
      } else {
        selectedRate = idx + 1;
        ratingItems.forEach((el, i) => {
          el.classList.toggle("selected", i < selectedRate);
        });
        submitBtn.disabled = false; // Enable khi đã chọn
      }
    });
  });

  // Submit/cancel logic
  submitBtn.onclick = async () => {
    if (submitBtn.disabled) return;
    const stars = selectedRate;
    const comment = modal.querySelector(".feedback-reason-input").value.trim();

    try {
      const res = await fetch("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, comment }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Feedback received!");
        modal.remove();
        if (sidebar) sidebar.classList.remove("cocbot-blur");
      } else {
        alert(data.error || "fail!");
      }
    } catch (err) {
      alert("server fail");
    }
  };

  function showToast(message) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.top = "24px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "#222";
    toast.style.color = "#fff";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = 99999;
    toast.style.fontSize = "1rem";
    toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    toast.style.opacity = "0.92";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  const cancelBtn = modal.querySelector(".feedback-cancel");
  cancelBtn.onclick = () => {
    modal.remove();
    if (sidebar) sidebar.classList.remove("cocbot-blur");
  };
}

function renderStars() {
  if (window.innerWidth < 386) {
    // 3 trên, 2 dưới
    return `
      <div class="feedback-rating-row">
        <div class="feedback-rating-stars-row">
          ${[0, 1, 2]
            .map(
              (i) => `
            <div class="feedback-rating-item" data-rate="${i + 1}">
              <img src="${chrome.runtime.getURL("icons/star.png")}" alt="Star ${
                i + 1
              }" class="feedback-rating-icon" />
            </div>
          `
            )
            .join("")}
        </div>
        <div class="feedback-rating-stars-row">
          ${[3, 4]
            .map(
              (i) => `
            <div class="feedback-rating-item" data-rate="${i + 1}">
              <img src="${chrome.runtime.getURL("icons/star.png")}" alt="Star ${
                i + 1
              }" class="feedback-rating-icon" />
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  } else {
    // 5 sao 1 hàng
    return `
      <div class="feedback-rating-row">
        ${[0, 1, 2, 3, 4]
          .map(
            (i) => `
          <div class="feedback-rating-item" data-rate="${i + 1}">
            <img src="${chrome.runtime.getURL("icons/star.png")}" alt="Star ${
              i + 1
            }" class="feedback-rating-icon" />
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }
}

// format markdown-like text
export function formatMessage(message) {
  return message
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>");
}

// show typing indicator
export function addTypingIndicator() {
  const typingElement = document.createElement("div");
  typingElement.className = "typing-indicator";
  typingElement.innerHTML = "<span></span><span></span><span></span>";

  elements.chatContainer.appendChild(typingElement);
  elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;

  return typingElement;
}

// remove typing indicator
export function removeTypingIndicator(indicator) {
  if (indicator && indicator.parentNode) {
    indicator.parentNode.removeChild(indicator);
  }
}

// handle messages from content script
export function handleContentMessage(message) {
  switch (message.action) {
    case "page_content":
      console.log("CocBot: Got page content");
      state.pageContent = message.content;

      // update ui
      updateContentStatus();

      // update viewer if open
      if (elements.contentViewerScreen.style.display !== "none") {
        renderContentInSidebar(state.pageContent);
      }

      // if notes panel is open, refresh notes for new URL
      if (state.isNotesOpen && state.pageContent.url !== state.currentPageUrl) {
        state.currentPageUrl = state.pageContent.url;
        openNotesPanel();
      }
      break;

    case "refresh_page_content":
      console.log("CocBot: URL changed, requesting fresh content");

      // Reset content extraction state
      state.contentFetchAttempts = 0;
      state.pageContent = null;

      // Request fresh content
      requestPageContent();

      // If in welcome mode, reset any generated questions
      if (state.welcomeMode) {
        state.generatedQuestions = null;
        const questionsContainer = document.querySelector(
          ".generated-questions"
        );
        if (questionsContainer) {
          questionsContainer.style.display = "none";
        }
      }

      // Show loading indicator if content viewer is open
      if (elements.contentViewerScreen.style.display !== "none") {
        elements.contentDisplay.innerHTML = `
          <div class="content-viewer-loading">
            <div class="spinner"></div>
            <p>Loading content for new page...</p>
          </div>
        `;
      }
      break;

    case "auth_session_changed":
      console.log("Auth state changed event received, updating UI!");
      renderToggleAccountPopupUI(message.isAuth);
  }
}

// helper function to escape HTML
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
