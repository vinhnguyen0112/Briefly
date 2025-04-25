//lang
// Default language is English
let currentLanguage = 'en';

const translations = {
  en: {
    title: 'CocBot',
    quickActions: 'Quick Actions',
    questionsAboutPage: 'Questions about this page',
    pageNotes: 'Page Notes',
    editNote: 'Edit Note',
    pageContentViewer: 'Page Content Viewer',
    apiKeySettings: 'API Key Settings',
    responseSettings: 'Response Settings',

    summarize: 'Summarize',
    keyPoints: 'Key Points',
    explain: 'Explain',
    save: 'Save',
    cancel: 'Cancel',
    createFirstNote: 'Create your first note',

    noNotes: 'No notes for this page yet.',
    generatingQuestions: 'Generating questions...',
    processingContent: 'Processing page content...',
    enterApiKeyMessage: 'Enter your OpenAI API key to use the assistant:',

    askMeAnything: 'ask me anything',
    askAnything: 'Ask me anything...',
    writeNote: 'Write your note here...',
    enterApiKey: 'Enter OpenAI API Key',

    viewPageContent: 'View Page Content',
    notes: 'Notes',
    configure: 'Configure',
    settings: 'Settings',
    close: 'Close',
    refreshContent: 'Refresh Content',

    systemPromptAddition: ''
  },
  vi: {
    title: 'CocBot',
    quickActions: 'Hành động nhanh',
    questionsAboutPage: 'Câu hỏi về trang này',
    pageNotes: 'Ghi chú trang',
    editNote: 'Chỉnh sửa ghi chú',
    pageContentViewer: 'Xem nội dung trang',
    apiKeySettings: 'Cài đặt khóa API',
    responseSettings: 'Cài đặt phản hồi',

    summarize: 'Tóm tắt',
    keyPoints: 'Điểm chính',
    explain: 'Giải thích',
    save: 'Lưu',
    cancel: 'Hủy',
    createFirstNote: 'Tạo ghi chú đầu tiên',

    noNotes: 'Chưa có ghi chú nào cho trang này.',
    generatingQuestions: 'Đang tạo câu hỏi...',
    processingContent: 'Đang xử lý nội dung trang...',
    enterApiKeyMessage: 'Nhập khóa API OpenAI của bạn để sử dụng trợ lý:',

    askMeAnything: 'hỏi tôi bất cứ điều gì',
    askAnything: 'Hỏi tôi bất cứ điều gì...',
    writeNote: 'Viết ghi chú của bạn ở đây...',
    enterApiKey: 'Nhập khóa API OpenAI',

    viewPageContent: 'Xem nội dung trang',
    notes: 'Ghi chú',
    configure: 'Cấu hình',
    settings: 'Cài đặt',
    close: 'Đóng',
    refreshContent: 'Làm mới nội dung',

    systemPromptAddition: 'Respond in Vietnamese.'
  }
};

function getTranslation(key) {
  if (translations[currentLanguage] && translations[currentLanguage][key]) {
    return translations[currentLanguage][key];
  }
  
  if (translations.en && translations.en[key]) {
    return translations.en[key];
  }
  
  return key;
}

function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    updatePageTranslations();
    return true;
  }
  return false;
}

function getLanguage() {
  return currentLanguage;
}

function getSystemPromptAddition() {
  return translations[currentLanguage].systemPromptAddition || '';
}

function updatePageTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = getTranslation(key);
  });
  
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    element.setAttribute('title', getTranslation(key));
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    element.setAttribute('placeholder', getTranslation(key));
  });
}

export {
  getTranslation,
  setLanguage,
  getLanguage,
  getSystemPromptAddition,
  updatePageTranslations
}; 