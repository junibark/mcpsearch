import { Metadata } from 'next';
import Link from 'next/link';
import { Book, Terminal, Package, Rocket, Code, ExternalLink } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documentation - MCPSearch',
  description: 'Learn how to use MCP servers with your AI coding tools',
};

export default function DocsPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Documentation</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Learn how to discover, install, and use MCP servers with your favorite AI coding tools.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-16">
        <Link
          href="/cli"
          className="group rounded-lg border bg-card p-6 transition-all hover:border-brand-500 hover:shadow-md"
        >
          <Terminal className="h-8 w-8 text-brand-600 mb-4" />
          <h2 className="text-lg font-semibold group-hover:text-brand-600">CLI Reference</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Install and manage MCP servers from the command line
          </p>
        </Link>

        <Link
          href="/search"
          className="group rounded-lg border bg-card p-6 transition-all hover:border-brand-500 hover:shadow-md"
        >
          <Package className="h-8 w-8 text-brand-600 mb-4" />
          <h2 className="text-lg font-semibold group-hover:text-brand-600">Browse Packages</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Search and discover MCP servers for your needs
          </p>
        </Link>

        <a
          href="https://modelcontextprotocol.io"
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-lg border bg-card p-6 transition-all hover:border-brand-500 hover:shadow-md"
        >
          <Book className="h-8 w-8 text-brand-600 mb-4" />
          <h2 className="text-lg font-semibold group-hover:text-brand-600 flex items-center gap-2">
            MCP Specification
            <ExternalLink className="h-4 w-4" />
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Learn about the Model Context Protocol
          </p>
        </a>
      </div>

      {/* Getting Started */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Rocket className="h-6 w-6 text-brand-600" />
          Getting Started
        </h2>

        <div className="prose prose-gray dark:prose-invert max-w-none">
          <div className="rounded-lg border bg-card p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">1. What is MCP?</h3>
              <p className="text-muted-foreground">
                The Model Context Protocol (MCP) is an open protocol that enables AI assistants
                to securely connect to external tools and data sources. MCP servers provide
                capabilities like file access, database queries, API integrations, and more.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">2. Install the CLI</h3>
              <code className="block bg-muted rounded-lg p-4 text-sm font-mono">
                npm install -g @mcpsearch/cli
              </code>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">3. Search for packages</h3>
              <code className="block bg-muted rounded-lg p-4 text-sm font-mono">
                mcp search filesystem
              </code>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">4. Install a package</h3>
              <code className="block bg-muted rounded-lg p-4 text-sm font-mono">
                mcp install @modelcontextprotocol/server-filesystem
              </code>
              <p className="text-sm text-muted-foreground mt-2">
                The CLI will auto-detect your AI tool (Claude Code, Cursor, etc.) and configure it automatically.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">5. Restart your AI tool</h3>
              <p className="text-muted-foreground">
                Restart Claude Code, Cursor, or your AI tool of choice to load the new MCP servers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Manual Configuration */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Code className="h-6 w-6 text-brand-600" />
          Manual Configuration
        </h2>

        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-3">Claude Code</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add to <code className="bg-muted px-1.5 py-0.5 rounded">~/.claude/settings.json</code>:
            </p>
            <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
{`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  }
}`}
            </pre>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-3">Cursor</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add to <code className="bg-muted px-1.5 py-0.5 rounded">~/.cursor/mcp.json</code>:
            </p>
            <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
{`{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  }
}`}
            </pre>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-3">VS Code / Continue.dev</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add to <code className="bg-muted px-1.5 py-0.5 rounded">~/.continue/config.json</code>:
            </p>
            <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
{`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Help */}
      <section className="rounded-lg border bg-muted/30 p-8 text-center">
        <h2 className="text-xl font-bold mb-2">Need Help?</h2>
        <p className="text-muted-foreground mb-4">
          Check out the MCP specification or join the community for support.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="https://modelcontextprotocol.io/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            MCP Docs
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href="https://github.com/modelcontextprotocol"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}
