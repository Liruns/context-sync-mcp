# @liruns/context-sync-mcp

[![npm version](https://badge.fury.io/js/@liruns%2Fcontext-sync-mcp.svg)](https://www.npmjs.com/package/@liruns/context-sync-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Automatic Context Sync MCP Server for AI Agents**

Automatically share work context between multiple AI editors like Claude Code, Cursor, Windsurf, and Copilot.

---

## Why Do You Need This?

When using AI coding tools, you often face these problems:

- **Context Loss**: Switching from Cursor to Claude Code loses all previous context
- **Decision Amnesia**: "Why did I choose this approach?" - no memory retained
- **Repeating Mistakes**: Trying the same failed approach again
- **Difficult Handoffs**: Explaining context when switching to another AI is tedious

**Context Sync MCP** solves these problems.

---

## Installation

### NPM (Recommended)

```bash
npm install -g @liruns/context-sync-mcp
```

### Build from Source

```bash
git clone https://github.com/Liruns/context-sync-mcp.git
cd context-sync-mcp/packages/context-sync-mcp
npm install && npm run build
```

---

## MCP Configuration

### Claude Code

```bash
claude mcp add context-sync -- npx @liruns/context-sync-mcp
```

### Manual Configuration

Add to `~/.claude/mcp.json` or project's `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "context-sync": {
      "command": "npx",
      "args": ["@liruns/context-sync-mcp"]
    }
  }
}
```

---

## Available Tools (7)

### Context Management

| Tool | Description |
|------|-------------|
| `context_save` | Save work context (goal, status, next steps) |
| `context_load` | Load previous context (full/summary/decisions/blockers/next_steps) |

### Logging & Tracking

| Tool | Description |
|------|-------------|
| `decision_log` | Log decisions (what & why) |
| `attempt_log` | Log tried approaches (success/failed/partial) |
| `blocker_add` | Log blockers |
| `blocker_resolve` | Mark blocker as resolved |
| `handoff` | Handoff to another AI agent |

---

## Basic Workflow

```
# 1. Start work - save your goal
> context_save goal: "Implement user authentication"

# 2. Log decisions
> decision_log what: "Use JWT" why: "stateless and scalable"

# 3. Log failed attempts (so other AIs don't repeat mistakes)
> attempt_log approach: "session-based auth" result: "failed" reason: "Redis setup too complex"

# 4. Log blockers
> blocker_add description: "CORS issue blocking API calls"

# 5. Handoff to another AI
> handoff to: "cursor" summary: "Login UI implementation needed"
```

### Resume Work in Another AI

```
# Load previous context
> context_load

# Get summary only (saves tokens)
> context_load format: "summary"
```

---

## Data Storage

Context is stored in `.context-sync/` folder at project root:

```
<project>/.context-sync/
├── config.json       # Settings
├── context.db        # SQLite database (history, search)
└── snapshots/        # Snapshot backups
```

---

## Supported Platforms

| AI Editor | Supported |
|-----------|-----------|
| Claude Code | ✅ |
| Cursor | ✅ |
| Windsurf | ✅ |
| GitHub Copilot | ✅ |

| OS | Supported |
|----|-----------|
| Windows | ✅ |
| macOS | ✅ |
| Linux | ✅ |

---

## Requirements

- Node.js 18+
- MCP-compatible AI editor

---

## Development

```bash
# Install
cd packages/context-sync-mcp
npm install

# Build
npm run build

# Test
npm test

# Dev mode (watch)
npm run dev
```

---

## License

MIT

---

## Links

- [NPM](https://www.npmjs.com/package/@liruns/context-sync-mcp)
- [GitHub](https://github.com/Liruns/context-sync-mcp)
- [Issues](https://github.com/Liruns/context-sync-mcp/issues)
