# @liruns/context-sync-mcp

[![npm version](https://badge.fury.io/js/@liruns%2Fcontext-sync-mcp.svg)](https://www.npmjs.com/package/@liruns/context-sync-mcp)
[![CI](https://github.com/Liruns/context-sync-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Liruns/context-sync-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Automatic Context Sync MCP Server for AI Agents**

Automatically share work context between multiple AI editors like Claude Code, Cursor, Windsurf, and Copilot.

[English](./packages/context-sync-mcp/README.en.md) | [한국어](./packages/context-sync-mcp/README.ko.md)

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

## Usage

### Natural Language Commands (New!)

Use the `ctx` tool with natural language instead of remembering tool names:

```
"save" / "저장해줘"        → Save context
"load" / "불러와"          → Load previous context
"status" / "상태"          → Check current status
"summary" / "요약"         → Get context summary
"auto on" / "자동저장 켜줘" → Start auto-sync
"auto off" / "자동저장 꺼줘" → Stop auto-sync
```

### Basic Workflow

```
# 1. Start work - save your goal
> context_save with goal "Implement user authentication"

# 2. Log decisions
> decision_log: decided "Use JWT" because "stateless and scalable"

# 3. Log failed attempts (so other AIs don't repeat mistakes)
> attempt_log: tried "session-based auth" - failed because "Redis setup too complex"

# 4. Log blockers
> blocker_add: "CORS issue blocking API calls"

# 5. Handoff to another AI
> handoff to Cursor: "Login UI implementation"
```

### Resume Work in Another AI

```
# Load previous context
> context_load

# Get summary only (saves tokens)
> context_summarize format: markdown
```

### Auto-Sync

```
# Start auto-sync (saves on editor switch, file save, Git commit)
> sync_start

# Check status
> sync_status

# Stop
> sync_stop
```

### Session Start with Auto-Load

```
# Automatically load previous context when starting a session
> session_start agent: "claude-code"
```

---

## Automation Settings

Configure in `.context-sync/config.json`:

```json
{
  "automation": {
    "autoLoad": true,    // Auto-load context on session start
    "autoSave": true,    // Auto-save on changes
    "autoSync": false    // Auto-start sync engine
  }
}
```

Use `automation_config` tool to view/modify settings:

```
> automation_config autoLoad: true, autoSync: true
```

---

## Available Tools (17)

### Natural Language & Automation (New!)

| Tool | Description |
|------|-------------|
| `ctx` | Natural language commands (save/load/status/summary) |
| `session_start` | Start session with auto-load support |
| `automation_config` | Manage automation settings |

### Context Management

| Tool | Description |
|------|-------------|
| `context_save` | Save work context (goal, status, next steps) |
| `context_load` | Load previous context |
| `context_query` | Query specific info (decisions, blockers, approaches) |
| `context_summarize` | Summarize context (token-saving, compression levels) |

### Logging & Tracking

| Tool | Description |
|------|-------------|
| `decision_log` | Log decisions (what & why) |
| `attempt_log` | Log tried approaches (success/failed/partial) |
| `blocker_add` | Log blockers |
| `blocker_resolve` | Mark blocker as resolved |
| `handoff` | Handoff to another AI agent |

### Snapshots

| Tool | Description |
|------|-------------|
| `snapshot_create` | Create current state snapshot |
| `snapshot_list` | List snapshots |

### Auto-Sync

| Tool | Description |
|------|-------------|
| `sync_start` | Start auto-sync (editor switch, file save, Git commit detection) |
| `sync_stop` | Stop auto-sync |
| `sync_status` | Check sync status |

---

## Data Storage

Context is stored in `.context-sync/` folder at project root:

```
<project>/.context-sync/
├── current.json      # Current context
├── config.json       # Settings (including automation)
└── snapshots/        # Snapshot backups
    ├── snapshot-xxx.json
    └── ...
```

> Recommended: Add `.context-sync/` to your `.gitignore`.

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
