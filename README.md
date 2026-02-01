<p align="center">
  <img src="drift-web/public/orgio-logo.png" alt="Orgio" width="200" />
</p>

<h1 align="center">Orgio</h1>

<p align="center">
  <strong>AI-Powered Sprint Planning & Automatic Work Tracking</strong>
</p>

<p align="center">
  <em>One Brief. Personalized Views. Zero Meetings.</em>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#documentation">Documentation</a>
</p>

---

## The Problem

Modern teams waste **30% of their time** on coordination instead of building:

- **Fragmented AI Usage**: PM asks ChatGPT → gets PM answer. Dev asks → gets Dev answer. Designer asks → gets Designer answer. Same work done 3x, no sync.
- **Manual Tracking Hell**: Jira updates forgotten, Notion docs outdated, Slack messages lost.
- **Meeting Overhead**: Daily standups just to know what everyone is doing.
- **Context Switching**: Constantly switching between tools to piece together project state.

## The Solution

Orgio eliminates coordination overhead through intelligent automation:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   📝 One Brief → 🤖 AI Generates → 👥 Everyone Sees Their View  │
│                                                                 │
│   PM:      Kanban Board  │  User Stories  │  Timeline           │
│   Dev:     Architecture  │  API Specs     │  Code Snippets      │
│   Design:  User Flow     │  Components    │  States Preview     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### 🎯 **Generative UI Views**
Create one brief, get personalized visualizations for every role. The AI decides which components to render based on who's viewing.

### 🖥️ **Desktop Work Tracking**
Lightweight Electron overlay that tracks your active apps and files. AI watches your screen and generates insights automatically.

### 📊 **PR-Style Submissions**
End your session → AI generates a summary of what you accomplished. Review, edit, and submit like a pull request.

### 🔄 **Automatic Task Matching**
AI matches your work submissions to existing tasks. Checklists update automatically, sprint progress tracked in real-time.

### 🔌 **MCP Integration Hub**
Connect Notion, Slack, Jira, GitHub through the Model Context Protocol. Everything stays in sync automatically.

---

## Architecture

```
orgio/
├── backend/              # FastAPI + Multi-Agent AI System
│   ├── agents/           # LangChain agents (Brief, Task Matching, Submission, UI)
│   ├── routers/          # REST API endpoints
│   ├── services/         # Core business logic
│   └── prompts/          # Agent prompt templates
│
├── drift-web/            # React Dashboard
│   ├── components/       # UI components + generative views
│   ├── pages/            # Route pages
│   └── hooks/            # Custom React hooks
│
├── drift-desktop/        # Electron Desktop App
│   ├── app/              # React overlay UI
│   └── lib/              # Main process + IPC handlers
│
└── orgio-landing/        # Marketing Landing Page
```

### Multi-Agent System

```
┌────────────────────────────────────────────────────────────────┐
│                        Agent Orchestration                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ Brief Agent │    │   Task      │    │   Submission        │ │
│  │             │───▶│   Matching  │◀──▶│   Analysis          │ │
│  │ Generates   │    │   Agent     │    │   Agent             │ │
│  │ role tasks  │    │             │    │                     │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│         │                  │                      │             │
│         ▼                  ▼                      ▼             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Generative UI Agent                          │  │
│  │                                                           │  │
│  │   Generates role-specific component structures            │  │
│  │   PM → Kanban + Stories   |   Dev → Architecture + API   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker (optional)

### 1. Clone & Setup

```bash
git clone https://github.com/your-org/orgio.git
cd orgio
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run
python main.py
```

### 3. Web Dashboard

```bash
cd drift-web
npm install
npm run dev
```

### 4. Desktop App

```bash
cd drift-desktop
npm install
npm run dev
```

### Docker Deployment

```bash
# Full stack
docker-compose up -d
```

---

## Tech Stack

<table>
<tr>
<td>

**Backend**
- FastAPI
- LangChain
- OpenAI GPT-4
- Supabase (PostgreSQL)
- WebSockets

</td>
<td>

**Frontend**
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI
- Clerk Auth

</td>
<td>

**Desktop**
- Electron 36
- electron-vite
- XState
- Screen Capture
- Active Window API

</td>
</tr>
</table>

---

## Environment Variables

### Backend (`backend/.env`)

```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
CLERK_SECRET_KEY=sk_live_...
```

### Web (`drift-web/.env`)

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:8000
```

### Desktop (`drift-desktop/.env`)

```env
OPENAI_API_KEY=sk-...
CLERK_PUBLISHABLE_KEY=pk_live_...
API_URL=http://localhost:8000
```

---

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/briefs` | POST | Create brief with AI task generation |
| `/api/briefs/{id}/view` | GET | Get role-specific generative view |
| `/api/submissions` | POST | Submit work session |
| `/api/desktop/session/start` | POST | Start tracking session |
| `/api/desktop/session/end` | POST | End session with AI summary |
| `/health` | GET | Health check |

Full API documentation available at `/docs` when running the backend.

---

## Documentation

- [Product Overview](docs/DRIFT_PRODUCT.md)
- [Design System](docs/DRIFT_DESIGN.md)
- [Development Guide](docs/DRIFT_DEV.md)
- [API Specification](docs/API_SPEC.md)
- [Backend README](backend/README.md)

---

## License

MIT

---

<p align="center">
  <strong>Built for teams who want to ship, not sync.</strong>
</p>
