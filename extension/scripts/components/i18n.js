// internationalization module
import { state, getLanguage, saveLanguage } from "./state.js";

const translations = {
  en: {
    title: "Briefly",
    close: "Close",
    save: "Save",
    cancel: "Cancel",

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

    askAnything: "Ask me anything...",
    writeNote: "Write your note here...",
    enterApiKey: "Enter OpenAI API Key",

    processingContent: "Processing page content...",
    generatingQuestions: "Generating questions...",
    noNotes: "No notes for this page yet.",
    createFirstNote: "Create your first note",

    enterApiKeyMessage: "Enter your OpenAI API key to use the assistant:",
    responseLength: "Maximum Response Length",
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
  },

  vi: {
    title: "Briefly",
    close: "Đóng",
    save: "Lưu",
    cancel: "Hủy",

    pageContentViewer: "Trình Xem Nội Dung Trang",
    apiKeySettings: "Cài Đặt Khóa API",
    responseSettings: "Cài Đặt Phản Hồi",
    pageNotes: "Ghi Chú Trang",
    editNote: "Chỉnh Sửa Ghi Chú",

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

    askAnything: "Hỏi tôi bất cứ điều gì...",
    writeNote: "Viết ghi chú của bạn tại đây...",
    enterApiKey: "Nhập Khóa API OpenAI",

    processingContent: "Đang xử lý nội dung trang...",
    generatingQuestions: "Đang tạo câu hỏi...",
    noNotes: "Chưa có ghi chú nào cho trang này.",
    createFirstNote: "Tạo ghi chú đầu tiên",

    enterApiKeyMessage: "Nhập khóa API OpenAI của bạn để sử dụng trợ lý:",
    responseLength: "Độ Dài Phản Hồi Tối Đa",
    words: "từ",
    responseStyle: "Phong Cách Phản Hồi",
    conversational: "Đàm Thoại",
    educational: "Giáo Dục",
    technical: "Kỹ Thuật",
    responseLanguage: "Ngôn Ngữ Phản Hồi",

    conversationalDesc:
      "Giải thích thân thiện, dễ hiểu bằng ngôn ngữ hàng ngày",
    educationalDesc: "Giải thích có cấu trúc với các điểm rõ ràng và ví dụ",
    technicalDesc: "Thuật ngữ chính xác và phân tích kỹ lưỡng để hiểu sâu",
    responseVerbosity: "Điều chỉnh độ chi tiết của câu trả lời",
    languageToggleDesc: "Chọn ngôn ngữ cho trợ lý",

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

  state.generatedQuestions = null;
  const questionsContainer = document.querySelector(".generated-questions");
  if (questionsContainer) {
    const buttonContainer = document.querySelector(
      ".question-buttons-container"
    );
    if (buttonContainer) {
      buttonContainer.innerHTML = `
        <div class="question-loading">
          <div class="spinner-small"></div>
          <span data-i18n="generatingQuestions">${translate(
            "generatingQuestions"
          )}</span>
        </div>
      `;
    }

    questionsContainer.style.display = "block";
  }

  return translate("languageChanged");
}

export default {
  translate,
  switchLanguage,
  initializeLanguage,
  updatePageLanguage,
};
