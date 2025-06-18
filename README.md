# CocBot - AI Webpage Assistant

CocBot is a Chrome-compatible browser extension designed to help users read and understand webpages using AI-powered summarization and contextual Q&A. Built for the Coc Coc browser and other Chromium-based platforms, CocBot integrates a sidebar assistant with multilingual support, image captioning, and note-taking capabilities.

---

## Features

- **Sidebar Assistant**: Chat with AI about the current page, ask context-aware questions, and receive summaries.
- **Quick Actions**: Summarize, extract key points, and explain content instantly.
- **Notes**: Add, edit, and manage notes per webpage with persistent storage.
- **Content Viewer**: View extracted content, tables, images, and structured data.
- **Image Captioning**: Automatically generates captions for images using backend AI.
- **Feedback System**: Rate responses with stars and optional comments.
- **Multilingual Support**: Works in English and Vietnamese.
- **Personalization**: Configure response style, length, and language.
- **Session Persistence**: Retain chat and notes across reloads (including anonymous sessions).
- **Offline Access**: Recent chat history is available offline.

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/andrewcoldbrew/Briefly
cd Briefly
```

### 2. Install Server Dependencies

```bash
cd server
npm install
```

### 3. Configure Environment

Edit the `server/.env` file with the required credentials:

- OpenAI/Gemini API keys
- Database credentials

### 4. Start the Backend Server

```bash
npm start
```

### 5. Load the Extension

1. Open Chrome or Coc Coc, go to `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load Unpacked**
4. Select the `extension` folder from the repository

---

## Usage

### 1. Launch the Sidebar

Click the CocBot icon in the browser toolbar. The sidebar appears on the right.

### 2. Summarize and Ask Questions

- Type queries into the chat bar.
- Use Quick Action buttons to generate summaries or extract highlights.

### 3. View Extracted Content

- Click **View Page Content** to explore a structured version of the page (text, images, tables, etc.).

### 4. Add Personal Notes

- Use the **Notes** tab to jot down personal insights per page. Notes are saved and associated with the page URL.

### 5. Adjust AI Behavior

- Visit **Configure** panel to choose:
  - Summary style (bullet, narrative...)
  - Max response length
  - Language preference

### 6. Provide Feedback

- Click the feedback icon near any AI message.
- Submit a star rating and optional comment.

### 7. Authentication

- On first use, login using **Google** or **Facebook**.
- Anonymous mode is supported for limited use (3 queries).

---

## License

MIT
