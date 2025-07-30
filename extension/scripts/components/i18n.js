// internationalization module
import { state, getLanguage, saveLanguage } from "./state.js";

const translations = {
  en: {
    title: "Briefly",
    close: "Close",
    save: "Save",
    cancel: "Cancel",

    // Authentications
    signOut: "Sign Out",
    signInGoogle: "Sign In With Google",
    signInFacebook: "Sign In With Facebook",

    pageContentViewer: "Page Content Viewer",
    apiKeySettings: "API Key Settings",
    responseSettings: "Response Settings",
    pageNotes: "Page Notes",
    editNote: "Edit Note",

    quickActions: "Quick Actions",
    summarize: "Summarize this page for me.",
    keyPoints: "What are the key points of this page?",
    explain: "Explain this page to me as if I'm a beginner",
    "generate-questions": "Generate questions about this page",
    questionsAboutPage: "Questions about this page",
    askMeAnything: "ask me anything",
    refreshContent: "Refresh Content",
    viewPageContent: "View Page Content",
    settings: "Settings",
    configure: "Configure",
    notes: "Notes",

    refreshPageContext: "Refresh Page Context",

    askAnything: "Ask me anything...",
    writeNote: "Write your note here...",
    enterApiKey: "Enter OpenAI API Key",

    processingContent: "Processing page content...",
    generatingQuestions: "Generating questions...",

    // Notes
    noNotes: "No notes for this page yet.",
    createFirstNote: "Create your first note",
    addNote: "Add Note",

    enterApiKeyMessage: "Enter your OpenAI API key to use the assistant:",

    languageChanged:
      "Language has been switched to English. User interface and responses will be in English from now on.",

    newChat: "New Chat",
    chatHistory: "Chat History",
    clearHistory: "Clear History",
    refreshHistory: "Refresh History",
    noChats: "No chats yet.",
    rename: "Rename",
    delete: "Delete",

    account: "Account",

    welcome: "Ask me anything about this webpage",

    responseLength: "Maximum Response Length:",
    words: "words",
    responseStyle: "Response Style",
    conversational: "Conversational",
    educational: "Educational",
    technical: "Technical",
    responseLanguage: "Response Language",
    conversationalDesc:
      "Friendly, easy-to-understand explanations using everyday language",
    educationalDesc: "Structured explanations with clear points and examples",
    technicalDesc:
      "Precise terminology and thorough analysis for advanced understanding",
    responseVerbosity: "Control how verbose the answers will be",
    languageToggleDesc: "Select the language for the assistant",
    saveSettings: "Save Settings",

    forThisPage: "For This Page",
    allNotes: "All Notes",
    noNotesThisPage: "No notes for this page yet.",
    noNotesAtAll: "No notes created yet.",
    reloadNotes: "Reload Notes",
    deleteNote: "Delete Note",
    deleteNoteConfirmation:
      "Are you sure you want to delete this note? This action cannot be undone.",
    confirmDelete: "Delete",
    cancel: "Cancel",
  },

  vi: {
    title: "Briefly",
    close: "Đóng",
    save: "Lưu",
    cancel: "Hủy",

    // Authentications
    signOut: "Đăng Xuất",
    signInGoogle: "Đăng Nhập Với Google",
    signInFacebook: "Đăng Nhập Với Facebook",

    pageContentViewer: "Trình Xem Nội Dung Trang",
    apiKeySettings: "Cài Đặt Khóa API",
    responseSettings: "Cài Đặt Phản Hồi",
    pageNotes: "Ghi Chú Trang",
    editNote: "Sửa Ghi Chú",

    quickActions: "Thao Tác Nhanh",
    summarize: "Tóm tắt trang web này cho tôi",
    keyPoints: "Cho tôi các ý chính của trang web này",
    explain: "Giải thích trang web này cho tôi",
    "generate-questions": "Tạo các câu hỏi về trang web này",
    questionsAboutPage: "Câu hỏi về trang này",
    askMeAnything: "hỏi tôi bất cứ điều gì",
    refreshContent: "Làm Mới Nội Dung",
    viewPageContent: "Xem Nội Dung Trang",
    settings: "Cài Đặt",
    configure: "Cấu Hình",
    notes: "Ghi Chú",

    refreshPageContext: "Tải Lại Nội Dung Trang",

    askAnything: "Hỏi tôi bất cứ điều gì...",
    writeNote: "Viết ghi chú của bạn tại đây...",
    enterApiKey: "Nhập Khóa API OpenAI",

    processingContent: "Đang xử lý nội dung trang...",
    generatingQuestions: "Đang tạo câu hỏi...",

    // Notes
    noNotes: "Chưa có ghi chú nào cho trang này.",
    createFirstNote: "Tạo ghi chú đầu tiên",
    addNote: "Thêm Ghi Chú",

    enterApiKeyMessage: "Nhập khóa API OpenAI của bạn để sử dụng trợ lý:",

    languageChanged:
      "Ngôn ngữ đã được chuyển sang tiếng Việt. Giao diện và phản hồi sẽ bằng tiếng Việt từ bây giờ.",

    newChat: "Cuộc Trò Chuyện Mới",
    chatHistory: "Lịch Sử Trò Chuyện",
    clearHistory: "Xóa Lịch Sử",
    refreshHistory: "Tải Lại Lịch Sử",
    noChats: "Chưa có cuộc trò chuyện nào.",
    rename: "Sửa tên",
    delete: "Xóa",

    account: "Tài Khoản",

    welcome: "Hỏi tôi bất kì thứ gì về trang web này",

    responseLength: "Độ Dài Phản Hồi Tối Đa:",
    words: "từ",
    responseStyle: "Phong Cách Phản Hồi",
    conversational: "Thân Mật",
    educational: "Giáo Dục",
    technical: "Kỹ Thuật",
    responseLanguage: "Ngôn ngữ phản hồi",
    conversationalDesc:
      "Giải thích thân thiện, dễ hiểu bằng ngôn ngữ đời thường",
    educationalDesc:
      "Giải thích có cấu trúc với các điểm chính rõ ràng và ví dụ cụ thể",
    technicalDesc:
      "Thuật ngữ chính xác và phân tích chuyên sâu cho người dùng nâng cao",
    responseVerbosity: "Điều chỉnh mức độ chi tiết của câu trả lời",
    languageToggleDesc: "Chọn ngôn ngữ cho trợ lý",
    saveSettings: "Lưu Cài Đặt",

    forThisPage: "Cho Trang Này",
    allNotes: "Tất Cả Ghi Chú",
    noNotesThisPage: "Chưa có ghi chú nào cho trang này.",
    noNotesAtAll: "Chưa có ghi chú nào được tạo.",
    reloadNotes: "Tải Lại Ghi Chú",
    deleteNote: "Xóa Ghi Chú",
    deleteNoteConfirmation:
      "Bạn có chắc chắn muốn xóa ghi chú này không? Hành động này không thể hoàn tác.",
    confirmDelete: "Xóa",
    cancel: "Hủy",
  },
};

let currentLanguage = "en";

export async function initializeLanguage() {
  currentLanguage = await getLanguage();
  await updatePageLanguage();
}

export function translate(key) {
  const lang = state.language || currentLanguage;
  if (translations[lang] && translations[lang][key]) {
    return translations[lang][key];
  }

  if (translations.en && translations.en[key]) {
    return translations.en[key];
  }

  return key;
}

export async function updatePageLanguage() {
  document.documentElement.lang = currentLanguage;

  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach((element) => {
    const key = element.getAttribute("data-i18n");
    element.textContent = translate(key);
  });

  // placeholder attributes with data-i18n-placeholder
  const placeholders = document.querySelectorAll("[data-i18n-placeholder]");
  placeholders.forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    element.placeholder = translate(key);
  });

  const titles = document.querySelectorAll("[data-i18n-title]");
  titles.forEach((element) => {
    const key = element.getAttribute("data-i18n-title");
    element.title = translate(key);
  });
}

// Switch language
export async function switchLanguage(language) {
  if (language !== "en" && language !== "vi") {
    language = "en";
  }

  const previousLanguage = currentLanguage;
  currentLanguage = language;
  state.language = language;

  await saveLanguage(language);

  await updatePageLanguage();

  // state.generatedQuestions[language] = [];
  // const questionsContainer = document.querySelector(".generated-questions");
  // if (questionsContainer) {
  //   const buttonContainer = document.querySelector(
  //     ".question-buttons-container"
  //   );
  //   if (buttonContainer) {
  //     buttonContainer.innerHTML = `
  //       <div class="question-loading">
  //         <div class="spinner-small"></div>
  //         <span data-i18n="generatingQuestions">${translate(
  //           "generatingQuestions"
  //         )}</span>
  //       </div>
  //     `;
  //   }

  //   questionsContainer.style.display = "block";
  // }

  return translate("languageChanged");
}

/**
 * Translates elements with `data-i18n` inside a given root.
 * @param {HTMLElement} root
 */
export function translateElement(root = document.body) {
  const elements = root.querySelectorAll("[data-i18n]");
  for (const el of elements) {
    const key = el.getAttribute("data-i18n");
    el.textContent = translate(key);
  }
}

export default {
  translate,
  switchLanguage,
  initializeLanguage,
  updatePageLanguage,
  translateElement,
};
