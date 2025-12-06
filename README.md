# 🤖 Autonomous Workspace v3 — Multi-Tool AI Agent (Safe Mode)

A full-stack AI agent system that extracts tasks from emails or text, maps them to MCP tools, and executes them with explicit user approval.

![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Groq](https://img.shields.io/badge/Groq-LLM-green) ![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-purple)

## ✨ Features

- **📧 Email/Text Analysis** — Paste any email or task description
- **🔍 AI Task Extraction** — Groq LLM extracts actionable tasks
- **🔧 Tool Mapping** — Automatically maps tasks to MCP tools
- **🛡️ Safe Mode** — No execution without explicit approval
- **📊 Confidence Scores** — AI provides confidence for each task
- **📝 Audit Trail** — Complete logging of all actions
- **🎨 Premium Dark UI** — Modern, responsive design

## 🏗️ Architecture

```
Frontend (React + Vite) ⇄ MCP Server ⇄ Groq API + Tool Adapters
```

### Available Tools

| Tool | Description | Status |
|------|-------------|--------|
| `filesystem` | Read/write files (sandboxed) | ✅ Active |
| `github` | GitHub API operations | ✅ Active |
| `slack` | Send Slack messages | ✅ Active |
| `calendar` | Manage calendar events | ✅ Active |
| `terminal` | Execute commands | ⚠️ Disabled by default |
| `browser` | Safe HTTP fetch | ✅ Active |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Groq API key ([Get one here](https://console.groq.com))

### Installation

```bash
# Clone and navigate
cd mcp

# Install all dependencies
npm run install:all

# Configure environment
cp mcp-server/.env.example mcp-server/.env
# Edit .env and add your GROQ_API_KEY
```

### Running

**Terminal 1 — MCP Server:**
```bash
npm run dev:mcp
```

**Terminal 2 — Frontend:**
```bash
npm run dev:web
```

Open http://localhost:5173

## 📝 Example Usage

### Sample Email Input

```
Hi team,

Please handle the following:

1. Create a new file called "meeting-notes.md" with today's date
2. Send a Slack message to #general about the standup at 10am
3. Create a GitHub issue for the login bug we discussed
4. Add a calendar event for the design review on Friday at 2pm

Thanks!
```

### Expected Output

The AI will extract 4 tasks:
1. **Filesystem** → Create meeting-notes.md
2. **Slack** → Send message to #general
3. **GitHub** → Create issue for login bug
4. **Calendar** → Create event for Friday 2pm

Each task shows:
- Suggested tool
- Payload preview
- Confidence score
- Approve button

## 🔒 Security

### Safe Mode (Default)

- ✅ **No auto-execution** — All tasks require explicit approval
- ✅ **Sandboxed filesystem** — Only `./sandbox` folder accessible
- ✅ **Terminal disabled** — Set `ALLOW_TERMINAL=true` to enable
- ✅ **Command whitelist** — Only safe commands allowed
- ✅ **Full audit trail** — Every action logged

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GROQ_API_KEY` | Your Groq API key | Required |
| `MCP_SERVER_PORT` | Server port | 3001 |
| `ALLOW_TERMINAL` | Enable terminal adapter | false |

## 📁 Project Structure

```
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI Components
│   │   ├── api/            # MCP API Client
│   │   ├── lib/            # Types
│   │   └── utils/          # Utilities
│   └── ...
├── mcp-server/             # MCP Backend
│   ├── src/
│   │   ├── tools/          # Tool Adapters
│   │   │   └── adapters/   # Individual tools
│   │   ├── planner.ts      # LLM Orchestration
│   │   ├── groqClient.ts   # Groq API
│   │   ├── validation.ts   # Zod Schemas
│   │   └── audit.ts        # Audit Logging
│   ├── audit/              # Audit logs
│   └── sandbox/            # Sandboxed files
└── README.md
```

## 🔌 API Endpoints

### POST /api/plan
Analyze text and generate execution plan.

**Request:**
```json
{
  "text": "Create a file called notes.md..."
}
```

**Response:**
```json
{
  "summary": "Plan to create a notes file",
  "tasks": [
    {
      "id": "task-1",
      "description": "Create notes.md file",
      "tool": "filesystem",
      "payload": { "action": "write", "path": "notes.md", "content": "..." },
      "confidence": 0.95,
      "status": "pending"
    }
  ]
}
```

### POST /api/execute
Execute an approved task.

**Request:**
```json
{
  "taskId": "task-1",
  "tool": "filesystem",
  "payload": { "action": "write", "path": "notes.md", "content": "..." }
}
```

### GET /api/audit
Retrieve audit history.

## 🛠️ Development

### Adding New Tools

1. Create adapter in `mcp-server/src/tools/adapters/`
2. Register in `mcp-server/src/tools/dispatcher.ts`
3. Update Groq prompts in `mcp-server/src/groqClient.ts`

### Customizing Prompts

Edit the prompts in `groqClient.ts` to adjust task extraction and tool mapping behavior.

## 📄 License

MIT License — Feel free to use and modify.

---

Built with ❤️ using React, TypeScript, Groq, and TailwindCSS
>>>>>>> e9eba61 (initial commit)
