# Context Sync MCP

Automatic context synchronization MCP server for AI agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Overview

Context Sync MCP is an MCP (Model Context Protocol) server that enables seamless sharing of work context across multiple AI coding tools like Cursor, Claude Code, and Windsurf.

### Why do you need this?

- **Prevent context loss when switching agents**: Maintain work context when switching from Claude Code to Cursor
- **Decision logging**: Allow other AIs to understand why certain approaches were chosen
- **Failure logging**: Share failed attempts to prevent repeating the same mistakes
- **Work continuity**: Restore state to specific points using snapshots

## Key Features

| Feature | Description |
|---------|-------------|
| Context Save/Load | Manage work goals, status, and next steps |
| Decision Logging | Record decisions with rationale |
| Approach Logging | Track successful/failed attempts |
| Blocker Management | Track blockers and their resolutions |
| Agent Handoff | Seamless handoff between AI agents |
| Snapshots | Save and restore state at specific points |

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

### Basic Workflow

```
1. Start work
   > Save the goal "Implement login feature" with context_save

2. Log decisions
   > Log the decision "Use JWT" with decision_log. Reason: "Stateless, better than sessions"

3. Log attempts
   > Log the attempt "Used passport.js" with attempt_log. Result: failed, reason: "Too complex"

4. Log blockers
   > Add blocker "Refresh token storage location undecided" with blocker_add

5. Handoff to another tool
   > Handoff to Cursor. Summary: "JWT login implemented, need refresh token logic"

6. Continue in another tool
   > Load previous context with context_load
```

### Available Tools

#### Context Management

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `context_save` | Save/update context | `goal` |
| `context_load` | Load context | - |
| `context_query` | Query specific info | `query` |

#### Logging

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `decision_log` | Log decisions | `what`, `why` |
| `attempt_log` | Log attempts | `approach`, `result` |
| `blocker_add` | Add blocker | `description` |
| `blocker_resolve` | Resolve blocker | `blockerId`, `resolution` |

#### Handoff

| Tool | Description | Required Parameters |
|------|-------------|---------------------|
| `handoff` | AI agent handoff | `to`, `summary` |
| `snapshot_create` | Create snapshot | - |
| `snapshot_list` | List snapshots | - |

## Storage Location

Context is stored in the `.context-sync/` folder at the project root:

```
.context-sync/
├── config.json      # Configuration
├── current.json     # Current context
└── snapshots/       # Snapshots
```

> It's recommended to add `.context-sync/` to your `.gitignore`.

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
├── store/
│   └── context-store.ts  # Context store
└── types/
    └── context.ts        # Type definitions

tests/
├── context-store.test.ts # Store unit tests
└── mcp-tools.test.ts     # MCP tools integration tests
```

## Roadmap

### v1.0 (Planned)
- [ ] Automatic editor switch detection
- [ ] Dedicated Cursor/Windsurf adapters
- [ ] Seamless mode (auto-load)

### v2.0 (Planned)
- [ ] Team sync (Git-based)
- [ ] Cloud backup
- [ ] Conflict resolution UI

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
