# mcpsearch-cli

The official CLI for [MCPSearch](https://mcpsearch.com) - discover and install MCP (Model Context Protocol) servers for your AI coding tools.

## Installation

```bash
npm install -g mcpsearch-cli
```

Or use with npx (no install required):

```bash
npx mcpsearch-cli search filesystem
```

## Supported Tools

- **Claude Code** - Anthropic's AI coding assistant
- **Cursor** - AI-powered code editor
- **Windsurf** - Codeium's AI IDE
- **Continue.dev** - Open-source AI code assistant

## Commands

### Search for packages

```bash
mcp search <query>

# Examples
mcp search filesystem
mcp search database --category database
mcp search api --limit 5
```

### Install a package

```bash
mcp install <package>

# Auto-detect your AI tool and install
mcp install @modelcontextprotocol/server-filesystem

# Install for a specific tool
mcp install mongodb-mcp-server --tool cursor

# Install multiple packages
mcp install @anthropic/mcp-server-fetch @anthropic/mcp-server-brave-search
```

### List installed packages

```bash
mcp list

# List for specific tool
mcp list --tool claudeCode

# Output as JSON
mcp list --json
```

### Show package info

```bash
mcp info <package>

# Example
mcp info @modelcontextprotocol/server-filesystem
```

### Remove a package

```bash
mcp remove <package>

# Example
mcp remove @modelcontextprotocol/server-filesystem --tool claudeCode
```

## Configuration

The CLI stores configuration in `~/.config/mcpsearch/config.json`.

### Set default tool

```bash
mcp config set defaultTool claudeCode
```

### Set custom registry URL

```bash
mcp config set registry https://api.mcpsearch.com
```

## How It Works

When you run `mcp install <package>`, the CLI:

1. Looks up the package in the MCPSearch registry
2. Detects which AI tool(s) you have installed
3. Adds the MCP server configuration to your tool's config file:
   - Claude Code: `~/.claude/settings.json`
   - Cursor: `~/.cursor/mcp.json`
   - Windsurf: `~/.windsurf/mcp.json`
   - Continue.dev: `~/.continue/config.json`
4. The server runs via `npx` when your AI tool starts

## Environment Variables

- `MCP_REGISTRY_URL` - Override the default registry URL

## Links

- [MCPSearch Website](https://mcpsearch.com)
- [Documentation](https://mcpsearch.com/docs)
- [Browse Packages](https://mcpsearch.com/search)
- [MCP Specification](https://modelcontextprotocol.io)

## License

MIT
