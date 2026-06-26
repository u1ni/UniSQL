# UniSQL

UniSQL is a modern, web-based, AI-powered SQL Server management tool. Built to provide a premium developer experience, it offers features found in heavy desktop applications (like DBeaver or SSMS) straight from your browser.

## Features

- **Web-Based Editor:** A fully functional Monaco-based SQL editor with syntax highlighting and auto-completion.
- **AI Integration (Claude / Gemma):** 
  - Automatically explain complex SQL queries.
  - Optimize queries for better performance.
  - Chat with AI specifically about your database.
- **Native File System Access:** Open and save `.sql` files directly to your local computer (supports `Ctrl+S` overwriting on modern browsers).
- **Advanced Query History:** Keep track of your past queries, their execution times, and affected rows natively.
- **Command Palette:** Quick access to all actions via `F1` or `Ctrl+P`.
- **Sleek & Dynamic UI:** Modern dark/light mode interface with glassmorphism and micro-animations for an elevated aesthetic.

## Quick Start

UniSQL is divided into two parts: a **backend** (Node.js/Express) that connects securely to your SQL Server, and a **frontend** (Next.js/React) that serves the user interface.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)
- **A running instance of Microsoft SQL Server**. If you don't have it installed:
  - 🪟 **Windows**: Download and install [SQL Server Developer Edition](https://www.microsoft.com/en-us/sql-server/sql-server-downloads). Make sure to enable "SQL Server Authentication" and set a password for the `sa` user during setup.
  - 🍏 **macOS / 🐧 Linux**: The easiest way is to run it via [Docker](https://www.docker.com/). Run this command in your terminal (replace `YourStrong!Passw0rd` with your own password):
    ```bash
    docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=YourStrong!Passw0rd" -p 1433:1433 -d mcr.microsoft.com/mssql/server:2022-latest
    ```

---

### Installation Guide

#### Windows

1. **Clone the repository:**
   ```cmd
   git clone https://github.com/u1ni/UniSQL.git
   cd UniSQL
   ```
2. **Install & Run Backend:**
   ```cmd
   cd backend
   npm install
   npm run dev
   ```
   *(The backend will start on `http://localhost:3001`)*
3. **Install & Run Frontend:**
   Open a **new terminal** window, and run:
   ```cmd
   cd UniSQL/frontend
   npm install
   npm run dev
   ```
   *(The frontend will start on `http://localhost:3000`)*

#### macOS

1. **Clone the repository:**
   ```bash
   git clone https://github.com/u1ni/UniSQL.git
   cd UniSQL
   ```
2. **Install & Run Backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
3. **Install & Run Frontend:**
   Open a **new terminal** window, and run:
   ```bash
   cd UniSQL/frontend
   npm install
   npm run dev
   ```

#### Linux

1. **Clone the repository:**
   ```bash
   git clone https://github.com/u1ni/UniSQL.git
   cd UniSQL
   ```
2. **Install & Run Backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
3. **Install & Run Frontend:**
   Open a **new terminal** window, and run:
   ```bash
   cd UniSQL/frontend
   npm install
   npm run dev
   ```

---

## Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS, Zustand, Monaco Editor.
- **Backend:** Node.js, Express, `mssql` (TDS connection).

## Security Note

UniSQL connects directly to your database. It is highly recommended to run this tool locally or on a secured internal network. Do not expose the backend publicly without adding robust authentication mechanisms.

## License

This project is open-source and available under the MIT License.

## Preview

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="https://files.catbox.moe/e28goa.png" width="100%" alt="Preview 1" />
    </td>
    <td width="50%" valign="top">
      <img src="https://files.catbox.moe/1vbo3y.png" width="100%" alt="Preview 2" />
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="https://files.catbox.moe/tay25z.png" width="100%" alt="Preview 3" />
    </td>
    <td width="50%" valign="top">
      <img src="https://files.catbox.moe/nlctbl.png" width="100%" alt="Preview 4" />
    </td>
  </tr>
</table>
