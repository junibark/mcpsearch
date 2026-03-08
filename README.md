# MCPSearch

Professional MCP (Model Context Protocol) discovery and installation platform.

## Overview

MCPSearch is a comprehensive platform for discovering, installing, and publishing MCP servers. It provides:

- **Web Interface**: Search and browse MCP servers at [mcpsearch.com](https://mcpsearch.com)
- **CLI Tool**: Install and manage MCPs from the command line
- **API**: RESTful API for programmatic access
- **Publishing**: Publish your own MCP servers to the registry

## Quick Start

### Install the CLI

```bash
# Using npm
npm install -g @mcpsearch/cli

# Using Homebrew (macOS)
brew install mcpsearch/tap/mcp
```

### Search for MCPs

```bash
mcp search filesystem
```

### Install an MCP

```bash
# Auto-detects your AI tool (Claude Code, Cursor, etc.)
mcp install @anthropic/mcp-server-filesystem

# Or specify the tool
mcp install @anthropic/mcp-server-filesystem --tool=cursor
```

### List Installed MCPs

```bash
mcp list
```

## Supported Tools

MCPSearch supports automatic configuration for:

- **Claude Code** - Anthropic's official CLI
- **Cursor** - AI-first code editor
- **Windsurf** - Codeium's IDE
- **Continue.dev** - Open-source AI assistant

## Project Structure

```
mcpsearch/
├── apps/
│   ├── api/          # Express API service
│   ├── web/          # Next.js frontend
│   └── worker/       # Background job processor
├── packages/
│   ├── cli/          # CLI tool
│   └── shared/       # Shared types & utilities
└── infrastructure/
    ├── docker/       # Docker configurations
    └── terraform/    # AWS infrastructure
```

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for local services)

### Setup

```bash
# Clone the repository
git clone https://github.com/mcpsearch/mcpsearch.git
cd mcpsearch

# Install dependencies
pnpm install

# Copy environment files
cp .env.example .env.local

# Start local services (LocalStack, Redis, OpenSearch)
docker-compose up -d

# Start development servers
pnpm dev
```

### Available Scripts

```bash
pnpm dev          # Start all services in development mode
pnpm build        # Build all packages
pnpm test         # Run tests
pnpm test:unit    # Run unit tests
pnpm lint         # Run linter
pnpm typecheck    # Run type checking
pnpm format       # Format code with Prettier
```

## API Documentation

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/packages` | List/search packages |
| GET | `/v1/packages/:id` | Get package details |
| GET | `/v1/packages/:id/versions` | List package versions |
| GET | `/v1/search` | Full-text search |
| GET | `/v1/search/suggest` | Autocomplete suggestions |
| GET | `/v1/categories` | List categories |

### Authenticated Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/packages` | Publish a package |
| PATCH | `/v1/packages/:id` | Update package metadata |
| DELETE | `/v1/packages/:id` | Deprecate a package |
| POST | `/v1/packages/:id/versions` | Publish a new version |
| GET | `/v1/users/me` | Get current user |
| POST | `/v1/packages/:id/reviews` | Create a review |

## Infrastructure

MCPSearch is deployed on AWS using:

- **ECS Fargate** - Container orchestration
- **DynamoDB** - Database (with global tables for DR)
- **OpenSearch** - Full-text search
- **ElastiCache** - Redis caching
- **CloudFront** - CDN
- **Cognito** - Authentication
- **S3** - Package storage

### Deploying Infrastructure

```bash
# First-time setup: create state backend
cd infrastructure/terraform/bootstrap
terraform init && terraform apply

# Deploy to an environment
cd infrastructure/terraform/environments/dev
terraform init && terraform apply
```

## CLI Commands

```bash
# Discovery
mcp search <query>         # Search packages
mcp info <package>         # Get package details

# Installation
mcp install <package>      # Install MCP
mcp update [package]       # Update packages
mcp remove <package>       # Remove package
mcp list                   # List installed

# Configuration
mcp init                   # Initialize config
mcp config get <key>       # Get config value
mcp config set <key> <val> # Set config value

# Publishing
mcp login                  # Authenticate
mcp publish                # Publish package
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pnpm test`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- **Website**: [mcpsearch.com](https://mcpsearch.com)
- **Documentation**: [docs.mcpsearch.com](https://docs.mcpsearch.com)
- **CLI Package**: [@mcpsearch/cli](https://www.npmjs.com/package/@mcpsearch/cli)
- **GitHub**: [github.com/mcpsearch/mcpsearch](https://github.com/mcpsearch/mcpsearch)
