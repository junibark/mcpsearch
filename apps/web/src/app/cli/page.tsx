import { Metadata } from 'next';
import Link from 'next/link';
import { Terminal, Download, Search, Package, Trash2, List, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'CLI - MCPSearch',
  description: 'Install and manage MCP servers with the MCPSearch command-line tool',
};

export default function CLIPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 mb-6">
          <Terminal className="w-8 h-8 text-brand-600" />
        </div>
        <h1 className="text-4xl font-bold mb-4">MCPSearch CLI</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          The fastest way to discover and install MCP servers for Claude Code, Cursor, Windsurf, and more.
        </p>
      </div>

      {/* Installation */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Installation</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">npm</h3>
            <code className="block bg-muted rounded-lg p-4 text-sm font-mono">
              npm install -g @mcpsearch/cli
            </code>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-3">npx (no install)</h3>
            <code className="block bg-muted rounded-lg p-4 text-sm font-mono">
              npx @mcpsearch/cli search filesystem
            </code>
          </div>
        </div>
      </section>

      {/* Commands */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Commands</h2>
        <div className="space-y-6">
          {/* Search */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Search className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-semibold">mcp search &lt;query&gt;</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Search for MCP packages in the registry.
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <div className="text-muted-foreground"># Search for filesystem servers</div>
              <div>$ mcp search filesystem</div>
              <div className="mt-2 text-muted-foreground"># Filter by category</div>
              <div>$ mcp search database --category database</div>
              <div className="mt-2 text-muted-foreground"># Limit results</div>
              <div>$ mcp search api --limit 5</div>
            </div>
          </div>

          {/* Install */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Download className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-semibold">mcp install &lt;package&gt;</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Install an MCP server to your AI coding tool configuration.
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <div className="text-muted-foreground"># Auto-detect tool and install</div>
              <div>$ mcp install @modelcontextprotocol/server-filesystem</div>
              <div className="mt-2 text-muted-foreground"># Install for specific tool</div>
              <div>$ mcp install mongodb-mcp-server --tool cursor</div>
              <div className="mt-2 text-muted-foreground"># Install multiple packages</div>
              <div>$ mcp install @anthropic/mcp-server-fetch @anthropic/mcp-server-brave-search</div>
            </div>
          </div>

          {/* List */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <List className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-semibold">mcp list</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              List all installed MCP servers.
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <div className="text-muted-foreground"># List all installed servers</div>
              <div>$ mcp list</div>
              <div className="mt-2 text-muted-foreground"># List for specific tool</div>
              <div>$ mcp list --tool claudeCode</div>
              <div className="mt-2 text-muted-foreground"># Output as JSON</div>
              <div>$ mcp list --json</div>
            </div>
          </div>

          {/* Info */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-semibold">mcp info &lt;package&gt;</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Show detailed information about a package.
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <div>$ mcp info @modelcontextprotocol/server-filesystem</div>
            </div>
          </div>

          {/* Remove */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-semibold">mcp remove &lt;package&gt;</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Remove an MCP server from your configuration.
            </p>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <div>$ mcp remove @modelcontextprotocol/server-filesystem --tool claudeCode</div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Tools */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">Supported Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-6 text-center">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3 text-lg font-bold">
              CC
            </div>
            <h3 className="font-semibold">Claude Code</h3>
            <p className="text-sm text-muted-foreground mt-1">--tool claudeCode</p>
          </div>
          <div className="rounded-lg border bg-card p-6 text-center">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3 text-lg font-bold">
              Cu
            </div>
            <h3 className="font-semibold">Cursor</h3>
            <p className="text-sm text-muted-foreground mt-1">--tool cursor</p>
          </div>
          <div className="rounded-lg border bg-card p-6 text-center">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3 text-lg font-bold">
              WS
            </div>
            <h3 className="font-semibold">Windsurf</h3>
            <p className="text-sm text-muted-foreground mt-1">--tool windsurf</p>
          </div>
          <div className="rounded-lg border bg-card p-6 text-center">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3 text-lg font-bold">
              Cd
            </div>
            <h3 className="font-semibold">Continue.dev</h3>
            <p className="text-sm text-muted-foreground mt-1">--tool continueDev</p>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="rounded-lg border bg-gradient-to-r from-brand-50 to-brand-100 dark:from-brand-950/30 dark:to-brand-900/20 p-8">
        <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
        <div className="bg-white/80 dark:bg-black/40 rounded-lg p-6 font-mono text-sm space-y-2">
          <div className="text-muted-foreground"># 1. Search for a package</div>
          <div>$ mcp search filesystem</div>
          <div className="mt-4 text-muted-foreground"># 2. Install it</div>
          <div>$ mcp install @modelcontextprotocol/server-filesystem</div>
          <div className="mt-4 text-muted-foreground"># 3. Restart your AI tool and start using it!</div>
        </div>
        <div className="mt-6">
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            Browse Packages
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
