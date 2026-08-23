# AI Assistant — ChatGPT-Inspired Chat App

A lightweight, ChatGPT-style chat application built with **plain HTML, CSS,
and vanilla JavaScript** on the frontend, and **Node.js + Express** on the
backend, powered by the **Anthropic Claude API**. Conversations persist to a
local JSON file — no database required.

![tech](https://img.shields.io/badge/stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Node%20%7C%20Express%20%7C%20Claude-6366f1)

## Features

- ChatGPT-style layout: collapsible sidebar, main chat area, sticky input bar
- Welcome screen with example prompt cards
- Full conversation history (create, rename, delete, search)
- Markdown rendering (headings, lists, bold/italic, tables, blockquotes, links)
- Code blocks with language label + copy-to-clipboard button, syntax highlighted
- Typing indicator while waiting on Claude
- Auto-expanding textarea, Enter to send / Shift+Enter for newline
- Dark theme by default, with a light-theme toggle
- Fully responsive — sidebar becomes a mobile overlay with a hamburger menu
- Toast notifications for network/API errors
- LocalStorage persistence: last-open conversation, sidebar state, theme, draft message

## Project Structure

```
chatgpt-clone/
├── backend/
│   ├── server.js
│   ├── routes/
│   │   ├── chat.js
│   │   └── conversations.js
│   ├── controllers/
│   │   ├── chat.controller.js
│   │   └── conversations.controller.js
│   ├── services/
│   │   └── conversation.service.js
│   ├── conversations/
│   │   └── conversations.json
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html
    ├── css/style.css
    ├── js/
    │   ├── api.js
    │   ├── app.js
The backend now includes a LangGraph agent. Claude autonomously decides whether
to answer directly, search the web, or read a supplied webpage, then uses the
tool result to compose the final response. The frontend API is unchanged.
    │   ├── chat.js
    │   ├── markdown.js
    │   ├── sidebar.js
    │   └── toast.js
    └── assets/
```

### Context and memory

Each request keeps the last `SHORT_TERM_HISTORY` user turns, including their
assistant replies and message metadata. Persistent user facts and preferences
are extracted conservatively into `backend/memory/long-term-memory.json`, while
per-conversation task plans live in `backend/context/task-context.json`.

Configure these features in `backend/.env`:

```text
SHORT_TERM_HISTORY=15
LONG_TERM_MEMORY_ENABLED=true
MAX_MEMORY_RESULTS=5
```

The request pipeline emits `stage` events for context loading, reasoning,
memory retrieval, agent selection, memory updates, and completion. Existing
agent and tool APIs remain unchanged.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- An Anthropic API key from [Anthropic Console](https://console.anthropic.com/settings/keys)

## Setup

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Configure your API key

```bash
cp .env.example .env
```

Then open `backend/.env` and paste in your key:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PORT=5000
CLAUDE_MODEL=claude-sonnet-4-20250514
```

### 3. Run the app

The Express server also serves the frontend as static files, so **one
command runs everything**:

```bash
npm start
```

Then open **http://localhost:5000** in your browser.

> Prefer auto-restart on file changes during development? Use `npm run dev`
> (uses Node's built-in `--watch` flag, no extra dependency needed).

### Running the frontend separately (optional)

If you'd rather serve the frontend with your own static server (e.g. the
VS Code "Live Server" extension) while the backend runs on port 5000,
that works too — just make sure both are running. The frontend calls the
API at relative path `/api/...`, so if you serve it from a different
origin/port you'll need a proxy or to update `BASE_URL` in
`frontend/js/api.js`.

## API Reference
GOOGLE_SEARCH_API_KEY=your_google_custom_search_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id_here
AGENT_MAX_STEPS=4
TOOL_TIMEOUT_MS=8000

| Method | Endpoint                  | Description                          |
|--------|----------------------------|---------------------------------------|
| GET    | `/api/conversations`       | List all conversations (summaries)   |
| GET    | `/api/conversations/:id`   | Get one conversation with full history |
| POST   | `/api/conversations`       | Create a new empty conversation      |
| PUT    | `/api/conversations/:id`   | Rename a conversation                |
| DELETE | `/api/conversations/:id`   | Delete a conversation                |
| POST   | `/api/chat`                | Send a prompt, get a Claude reply    |
| GET    | `/api/health`              | Health check                         |

`POST /api/chat` body:

```json
{ "message": "Hello!", "conversationId": "optional-existing-id" }
```

If `conversationId` is omitted or not found, a new conversation is created
automatically and its title is derived from your first message.

## Data Storage

Conversations live in `backend/conversations/conversations.json` as a
plain JSON array. Each conversation looks like:

```json
{
  "id": "uuid",
  "title": "JavaScript Closures",
  "createdAt": "2026-08-22T10:00:00.000Z",
  "updatedAt": "2026-08-22T10:02:00.000Z",
  "messages": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ]
}
```

The service layer automatically repairs a missing or corrupted
`conversations.json` by resetting it to `[]`, so a bad file won't crash
the server.

## Troubleshooting

- **"Claude API key is missing"** — make sure `backend/.env` exists and
  `ANTHROPIC_API_KEY` is set, then restart the server.
- **"Can't reach the server"** toast — the backend isn't running, or you're
  serving the frontend from a different port without a proxy.
- **Blank sidebar** — check the browser console; the app will also show a
  toast if `/api/conversations` fails to load.

## Customization

- Swap the 🤖 emoji avatar for a custom image — see `frontend/assets/README.txt`.
- Change the Gemini model via `GEMINI_MODEL` in `.env` (e.g. `gemini-1.5-pro`).
- All colors, spacing, and radii are CSS variables at the top of
  `frontend/css/style.css` — tweak `:root` to re-theme the whole app.

## License

MIT — do whatever you'd like with this.
