# CocBot - AI Webpage Assistant

CocBot is a Chrome-compatible browser extension designed to help users read and understand webpages using AI-powered summarization and contextual Q&A. Built for the Coc Coc browser and other Chromium-based platforms, CocBot integrates a sidebar assistant with multilingual support, image captioning, and note-taking capabilities.

---

## ✨ Features

- **On-page Assistant**: Chat with AI about the current page, ask context-aware questions, and receive summaries.
- **Quick Actions**: Summarize, extract key points, and explain content instantly.
- **Notes**: Add, edit, and manage notes per webpage.
- **Understand PDF**:
- **Understand onpage images**:
- **Multilingual Support**: Works in English and Vietnamese.
- **Personalization**: Configure response style, length, and language.
- **Feedback**: Rate responses with stars and optional comments.
- **Chat History:**:
- **Offline Access**: Access previously opened chat even without Internet access

---

## 🛠️ Installation Guide

### 1. Clone the Repository

```bash
git clone https://github.com/andrewcoldbrew/Briefly
cd Briefly
```

### 2. Configure Environment

Create a `.env` file inside the `/server` directory with the following structure:

```env
# General
NODE_ENV=development
EXTENSION_ID=fnbbiklifmlapflfjcmbjlpklgfafllh
GOOGLE_CLIENT_ID=833310676000-755pdr3r9isck33epnmom0e8v2vfcsvs.apps.googleusercontent.com
FACEBOOK_APP_ID=684792190680106
FACEBOOK_APP_SECRET=<your-facebook-app-secret>
SESSION_TTL=604800
SUMMARY_TTL=86400
OPENAI_API_KEY=<your-openai-api-key>

# Redis config
REDIS_HOST=<your-redis-host>
REDIS_PORT=<your-redis-port>
REDIS_USERNAME=<your-redis-username>
REDIS_PASSWORD=<your-redis-password>
REDIS_PREFIX=capstone

# MySQL config
MYSQL_HOST=<your-mysql-host>
MYSQL_PORT=<your-mysql-port>
MYSQL_USERNAME=<your-mysql-username>
MYSQL_PASSWORD=<your-mysql-password>
MYSQL_DATABASE=<your-database-name>

# Qdrant config
QDRANT_URL=<your-qdrant-url>
QDRANT_API_KEY=<your-qdrant-api-key>
QDRANT_ENABLE_BINARY_QUANTIZATION=true
QDRANT_ENABLE_RESCORING=true
```

Create another `.env` file inside the root directory (same level with `docker-compose.yml`) with the following structure:

```
# App service
APP_NAME=capstone-2025
APP_PORT=3000

# Nginx service
NGINX_HOST_HTTP_PORT=8080
```

### 3. Start the Backend Server

**3.1 Run with NodeJS**

```bash
cd server
npm install
npm run dev
```

**3.2 Run with Docker**

Run the server

```bash
docker compose up
```

Run the monitoring stack

```bash
docker compose -f docker-compose.monitoring.yml up
```

Run the server and monitoring at once

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up
```

### 4. Load the Extension

1. Open Chrome or Coc Coc or any Chromium browers, go to `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load Unpacked**
4. Select the `extension` folder from the repository

---

## 🚀 User Guide

### 1. Launch the extension

Click the "Extensions" icon on the browser's toolbar
Click on the Briefly extension logo to open the AI assistant.

  <img src="assets/logo.png" alt="Logo" width="48"/>

The assistant will be a sidebar that looks like this

  <img src="assets/sidebar.png" alt="Sidebar" width="350"/>

### 2. Using the toolbar

The toolbar is where you can access all features of Briefly.

  <img src="assets/toolbar.png" alt="Chatbar" width="450"/>

From left to right, they are:

- Start a new chat
- View chat history
- Take notes
- Account & Settings
- Close assistant

We suggest you start with signing first as some features are limited and only available to authenticated users

  <img src="assets/authentication.png" alt="Chatbar" width="450"/>

### 3. Chatting & quick actions

You can chat with the AI assistant using the chatbar

  <img src="assets/chatbar.png" alt="Chatbar" width="350"/>

Or you can click on the Quick Actions button to summarize the page,
ask for key points, explaination or generate suggested question

  <img src="assets/quick-actions.png" alt="Quick Action buttons" width="350"/>
  
  <img src="assets/suggested-questions.png" alt="Suggested questions" width="350"/>

### 4. Feedback

Next to each response, there will be a small icon on the right, click it to send feedback for that specific response.

  <img src="assets/feedback.png" alt="feedback" width="350"/>

A feedback panel will appear, where you can rate and add comments.

  <img src="assets/feedback-panel.png" alt="feedback panel" width="350"/>

### 5. Access chat history

To access chat history, click on the chat history icon on the toolbar at the.  
You can delete, rename, or click to continue any conversations.

  <img src="assets/History.png" alt="History tab" width="350"/>

### 6. Add Personal Notes

Use the **Notes** tab to jot down personal insights per page. Notes are saved and associated with the page URL.  
To make management easier, we split the notes into two lists — notes associated with the currently active URL and all notes.

  <img src="assets/note.png" alt="Note tab" width="350"/>

### 7. Adjust AI Behavior

Visit **Configure** panel to choose Summary style and Max response length.

  <img src="assets/setting.png" alt="Setting tab" width="350"/>

---

## 📄 License

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
