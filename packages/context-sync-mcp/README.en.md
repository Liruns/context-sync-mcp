# Context Sync MCP v2.0

Automatic context synchronization MCP server for AI agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue.svg)](https://github.com/Liruns/context-sync-mcp)

## Overview

Context Sync MCP is an MCP (Model Context Protocol) server that enables seamless sharing of work context across multiple AI coding tools like Cursor, Claude Code, and Windsurf.

### Why do you need this?

- **Prevent context loss when switching agents**: Maintain work context when switching from Claude Code to Cursor
- **Natural language commands**: Use simple phrases like "save" or "load" instead of tool names
- **Auto save/load**: Automatically load previous context on session start
- **Decision logging**: Allow other AIs to understand why certain approaches were chosen
- **Failure logging**: Share failed attempts to prevent repeating the same mistakes
- **Work continuity**: Restore state to specific points using snapshots

## v2.0 What's New

- **SQLite Hybrid Storage**: JSON + SQLite (sql.js) dual storage for history tracking and search
- **Token-Efficient Responses**: 2-stage response pattern saves 90% tokens (hints → details)
- **FTS5 Full-Text Search**: Fast context search using SQLite FTS5
- **Session Linking**: Track related work continuity (parentId)
- **Failure Pattern Warnings**: Automatic warnings from previous failure records
- **Cross-Project Search**: Search contexts across projects via global DB
- **Archive System**: Archive and restore old contexts

## Key Features

| Feature | Description |
|---------|-------------|
| Natural Language | Use "save", "load", "status" commands naturally |
| Auto Save/Load | Configure automatic context persistence |
| Context Save/Load | Manage work goals, status, and next steps |
| Decision Logging | Record decisions with rationale |
| Approach Logging | Track successful/failed attempts |
| Blocker Management | Track blockers and their resolutions |
| Agent Handoff | Seamless handoff between AI agents |
| Snapshots | Save and restore state at specific points |
| Auto-Sync | Automatic sync on file save, editor switch, Git commit |
| Diff/Merge | Compare and merge snapshots |
| Full-Text Search | FTS5-based context search |
| Metrics | Track sync performance and work statistics |
| Archive | Archive management for old contexts |

## Installation

### npm Install (Recommended)

```bash
npm install @liruns/context-sync-mcp
```

### Build from Source

```bash
git clone https://github.com/Liruns/context-sync-mcp.git
cd context-sync-mcp/packages/context-sync-mcp
npm install
npm run build
```

## Configuration

### Claude Code

Add to `.claude/mcp.json`:

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

### Cursor

Add to `.cursor/mcp.json`:

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

### Windsurf

Add MCP server in Windsurf settings:

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

## Usage

### Natural Language Commands

Use the `ctx` tool with natural language:

```
"save"        → Save context
"load"        → Load previous context
"status"      → Check current status
"summary"     → Get context summary
"auto on"     → Start auto-sync
"auto off"    → Stop auto-sync
```

### v2.0 Recommended Workflow (Token-Efficient)

```
1. Check warnings on session start
   > context_warn currentGoal: "Implement login feature"
   → ~100 tokens (previous failures, related session recommendations)

2. Search when needed (hints only)
   > context_search query: "authentication"
   → ~200 tokens ({ hints: [{ id, goal, date, hasWarnings }] })

3. Get details when needed
   > context_get id: "ctx_abc123"
   → ~500 tokens (full information)

4. Save on session end
   > context_save goal: "Login feature", summary: "JWT auth complete"
   → ~50 tokens
```

### Basic Workflow

```
1. Start work
   > context_save goal: "Implement login feature"

2. Log decisions
   > decision_log what: "Use JWT" why: "Stateless, better than sessions"

3. Log attempts
   > attempt_log approach: "Used passport.js" result: "failed" reason: "Too complex"

4. Log blockers
   > blocker_add description: "Refresh token storage location undecided"

5. Handoff to another tool
   > handoff to: "cursor" summary: "JWT login implemented, need refresh token logic"

6. Continue in another tool
   > context_load
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

## Automation Settings

Configure in `.context-sync/config.json`:

```json
{
  "automation": {
    "autoLoad": true,
    "autoSave": true,
    "autoSync": false
  }
}
```

Use `automation_config` tool to view/modify:

```
> automation_config autoLoad: true, autoSync: true
```

## Available Tools (25)

### Natural Language & Automation

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `ctx` | Natural language commands | `command` |
| `session_start` | Start session with auto-load | - |
| `automation_config` | Manage automation settings | - |

### Context Management (v2.0 Core)

| Tool | Description | Est. Tokens |
|------|-------------|-------------|
| `context_save` | Save context | ~50 |
| `context_search` | Hint-based search (token-efficient) | ~200 |
| `context_get` | Get detailed context | ~500 |
| `context_warn` | Session start warnings/recommendations | ~100 |
| `context_load` | Load context (legacy) | - |
| `context_query` | Query specific info (legacy) | - |
| `context_summarize` | Summarize context | - |

### Logging

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `decision_log` | Log decisions | `what`, `why` |
| `attempt_log` | Log attempts | `approach`, `result` |
| `blocker_add` | Add blocker | `description` |
| `blocker_resolve` | Resolve blocker | `blockerId`, `resolution` |

### Handoff & Snapshots

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `handoff` | AI agent handoff | `to`, `summary` |
| `snapshot_create` | Create snapshot | - |
| `snapshot_list` | List snapshots | - |

### Auto-Sync

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `sync_start` | Start auto-sync | - |
| `sync_stop` | Stop auto-sync | - |
| `sync_status` | Check sync status | - |

### Advanced Features (v2.0+)

| Tool | Description | Version |
|------|-------------|---------|
| `context_diff` | Compare snapshots | - |
| `context_merge` | Merge snapshots | - |
| `context_stats` | Session statistics | v2.1 |
| `context_export` | Export to Markdown/JSON/HTML | v2.1 |
| `context_recommend` | Related session recommendations | v2.1 |
| `context_archive` | Archive management (archive/restore/stats/search/list/purge) | v2.2 |
| `metrics_report` | Performance metrics report | - |

## Token Efficiency

v2.0 uses a 2-stage response pattern to save 90% tokens:

| Scenario | Before | v2.0 | Savings |
|----------|--------|------|---------|
| Search (20 results) | ~8,000 | ~400 | 95% |
| Session start warning | ~2,000 | ~150 | 92% |
| Detail view (1) | ~800 | ~500 | 37% |
| **Typical usage** | **~10,000** | **~1,000** | **90%** |

## Storage Location

Context is stored in the `.context-sync/` folder at the project root:

```
.context-sync/
├── config.json      # Configuration (including automation)
├── current.json     # Current context (Git-trackable)
├── history.db       # SQLite DB (history, search)
└── snapshots/       # Snapshots

~/.context-sync/
└── global.db        # Global DB (cross-project search)
```

> It's recommended to add `.context-sync/history.db` to your `.gitignore`.

## Development

### Requirements

- Node.js 18+
- npm or yarn

### Build

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode (watch)
npm run dev
```

### Testing

```bash
# Run tests
npm test

# With coverage
npm run test:coverage
```

### Project Structure

```
src/
├── index.ts              # MCP server entry point
├── db/
│   ├── index.ts          # DB initialization (DatabaseInstance)
│   ├── schema.ts         # Schema definitions
│   └── global-db.ts      # Global DB
├── store/
│   ├── index.ts          # ContextStore (Facade)
│   ├── context-store.ts  # JSON storage
│   └── action-store.ts   # Action logging
├── handlers/
│   ├── index.ts          # Handler registry
│   └── *.ts              # Tool handlers
├── tools/
│   └── *.ts              # v2.0 tool implementations
├── services/
│   └── archive-service.ts # Archive service
├── sync/
│   └── sync-engine.ts    # Auto-sync engine
├── diff/
│   └── context-diff.ts   # Diff/Merge engine
├── search/
│   └── context-search.ts # Search engine
├── metrics/
│   └── metrics-collector.ts # Metrics collector
├── constants/
│   ├── errors.ts         # Error messages
│   ├── limits.ts         # Limit values
│   └── valid-values.ts   # Valid value constants
├── validators/
│   └── common.ts         # Common validators
├── utils/
│   └── truncate.ts       # Server-side summary generation
└── types/
    └── context.ts        # Type definitions
```

## Tech Stack

- **sql.js**: WebAssembly-based SQLite (no native compilation required)
- **FTS5**: Full-text search support
- **MCP SDK**: Model Context Protocol
- **TypeScript**: Type safety
- **Vitest**: Test framework

## Version History

### v2.0.0 (Current)
- SQLite hybrid storage (sql.js)
- Token-efficient 2-stage response pattern
- FTS5 full-text search
- context_search, context_get, context_warn tools
- context_stats, context_export, context_recommend tools (v2.1)
- context_archive tool and archive system (v2.2)
- Cross-project search (global.db)

### v0.3.0
- Diff/Merge engine
- Context search
- Performance metrics

### v0.2.0
- Natural language commands (`ctx`)
- Automation settings
- Auto-sync engine

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Contributing

Bug reports, feature requests, and PRs are welcome!

1. Fork
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'feat: Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Create Pull Request

## Links

- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [Claude Code](https://claude.ai/code)
- [GitHub Repository](https://github.com/Liruns/context-sync-mcp)
- [v2.0 Implementation Plan](docs/v2.0-plan.md)
