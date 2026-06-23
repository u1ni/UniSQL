<p align="center">
  <h1 align="center">⚡ UniSQL</h1>
  <p align="center">
    <strong>A modern, web-based alternative to SQL Server Management Studio</strong>
  </p>
  <p align="center">
    Cross-platform • Self-hosted • AI-powered • Beautiful UI
  </p>
</p>

---

## 🚀 What is UniSQL?

UniSQL is a **self-hosted web application** that provides a modern SQL Server management experience directly in your browser. It replaces the need for heavy desktop applications like SSMS, offering a clean and powerful interface inspired by **v0.app**, **VS Code**, and **Notion**.

### ✨ Key Features

| Feature | Description |
|---|---|
| 🖥️ **SQL Editor** | Monaco Editor (same as VS Code) with syntax highlighting, autocompletion |
| 🌳 **Object Explorer** | Browse databases, tables, views, procedures in a tree view |
| 📊 **Results Grid** | Interactive results table with sorting, export to CSV/JSON |
| 🎨 **Themes** | Dark, Light, and Custom themes with live switching |
| 🤖 **AI Assistant** | Explain queries, optimize SQL, chat about your database |
| 📜 **History** | Auto-saved query history with search and re-execution |
| 🔒 **Security** | Dangerous query detection, credential protection |
| 🐳 **Docker Ready** | One command to deploy with Docker Compose |
| 💻 **Cross-platform** | Works on Windows, macOS, and Linux |

---

## 📋 Prerequisites

- **Node.js** v18+ ([Download](https://nodejs.org))
- **Microsoft SQL Server** (local or remote) — the database you want to manage
- *(Optional)* **Docker** — for containerized deployment
- *(Optional)* **Ollama** or **OpenAI API key** — for AI features

---

## 🛠️ Quick Start (Development)

### 1. Clone and install

```bash
# Navigate to the project
cd unisql

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start the backend

```bash
cd backend
npm run dev
# Server starts on http://localhost:3001
```

### 3. Start the frontend (in a new terminal)

```bash
cd frontend
npm run dev
# App opens at http://localhost:3000
```

### 4. Connect to SQL Server

1. Open http://localhost:3000 in your browser
2. Click **"New Connection"**
3. Enter your SQL Server details:
   - **Server**: `localhost` or your server IP
   - **Port**: `1433` (default)
   - **Username**: your SQL Server username
   - **Password**: your password
4. Click **"Test Connection"** to verify
5. Click **"Connect"** to start working!

---

## 🐳 Docker Deployment

### Quick Start with Docker Compose

```bash
cd unisql
docker compose up -d
```

This will start:
- **Frontend** on http://localhost:3000
- **Backend** on http://localhost:3001

### With a test SQL Server

Uncomment the `sqlserver` service in `docker-compose.yml`, then:

```bash
docker compose up -d
```

Connect using:
- **Server**: `sqlserver` (from within Docker) or `localhost` (from host)
- **Username**: `sa`
- **Password**: `YourStrong!Passw0rd`

---

## 🤖 AI Configuration

UniSQL supports AI-powered query analysis using **OpenAI** or **Ollama** (local).

### Option A: Ollama (Free, Local)

1. Install [Ollama](https://ollama.ai)
2. Pull a model: `ollama pull llama3`
3. In UniSQL, open the AI panel and configure:
   - **Provider**: Ollama
   - **Model**: llama3
   - **URL**: http://localhost:11434

### Option B: OpenAI

1. Get an API key from [OpenAI](https://platform.openai.com)
2. In UniSQL, open the AI panel and configure:
   - **Provider**: OpenAI
   - **API Key**: your-api-key
   - **Model**: gpt-4o

### AI Features

- **Explain Query**: Breaks down what a SQL query does in plain language
- **Optimize Query**: Suggests performance improvements
- **Chat**: Ask questions about your database structure

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `F5` | Execute query |
| `Ctrl + Enter` | Execute query |
| `Ctrl + Shift + E` | Execute selected text |
| `Ctrl + N` | New query tab |
| `Ctrl + W` | Close current tab |
| `Ctrl + S` | Save query |
| `Ctrl + Shift + F` | Format SQL |
| `Ctrl + P` | Search tables/objects |
| `Ctrl + H` | Toggle history |
| `Ctrl + J` | Toggle AI panel |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           Browser (localhost:3000)           │
│  ┌─────────┬──────────────┬──────────────┐  │
│  │Sidebar  │ Monaco Editor│  AI Chat     │  │
│  │(Explorer)│  (SQL)      │  (Optional)  │  │
│  │         ├──────────────┤              │  │
│  │         │ Results Grid │              │  │
│  └─────────┴──────────────┴──────────────┘  │
└──────────────────┬──────────────────────────┘
                   │ HTTP/REST
┌──────────────────┴──────────────────────────┐
│        Node.js Backend (port 3001)          │
│  Express + mssql + AI Service + MCP         │
└──────────────────┬──────────────────────────┘
                   │ TDS Protocol
┌──────────────────┴──────────────────────────┐
│          Microsoft SQL Server               │
└─────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
unisql/
├── backend/                  # Express API server
│   ├── server.js             # Entry point
│   ├── src/
│   │   ├── routes/           # API endpoints
│   │   │   ├── connections.js
│   │   │   ├── database.js
│   │   │   ├── query.js
│   │   │   ├── history.js
│   │   │   └── ai.js
│   │   ├── services/         # Business logic
│   │   │   ├── connectionManager.js
│   │   │   └── aiService.js
│   │   ├── mcp/              # MCP server
│   │   │   └── mcpServer.js
│   │   └── utils/            # Helpers
│   │       ├── storage.js
│   │       └── security.js
│   └── data/                 # JSON storage
├── frontend/                 # Next.js app
│   └── src/
│       ├── app/              # Pages & layout
│       ├── components/       # React components
│       ├── stores/           # Zustand state
│       ├── hooks/            # Custom hooks
│       └── lib/              # API client
├── docker-compose.yml
└── README.md
```

---

## 🔧 Configuration

### Environment Variables

**Backend** (`backend/.env`):
```env
PORT=3001
NODE_ENV=development
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

<p align="center">
  Built with ❤️ for developers and DBAs who deserve better tools.
</p>
