import Link from 'next/link';
import { SearchBox } from '@/components/search/search-box';
import { CategoryGrid } from '@/components/home/category-grid';
import { FeaturedPackages } from '@/components/home/featured-packages';
import { ToolLogos } from '@/components/home/tool-logos';
import { ArrowRight, Package, Download, Users, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white dark:from-brand-950/20 dark:to-background">
        <div className="container mx-auto px-4 py-20 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Discover and Install{' '}
              <span className="text-brand-600 dark:text-brand-400">MCP Servers</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
              The registry for Model Context Protocol servers. Find tools to supercharge
              your AI coding workflow in Claude Code, Cursor, Windsurf, and more.
            </p>

            {/* Search Box */}
            <div className="mt-10">
              <SearchBox size="lg" placeholder="Search for MCP packages..." />
            </div>

            {/* Quick Links */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link
                href="/search?category=utilities"
                className="text-muted-foreground hover:text-foreground"
              >
                Utilities
              </Link>
              <span className="text-muted-foreground/50">·</span>
              <Link
                href="/search?category=database"
                className="text-muted-foreground hover:text-foreground"
              >
                Database
              </Link>
              <span className="text-muted-foreground/50">·</span>
              <Link
                href="/search?category=api"
                className="text-muted-foreground hover:text-foreground"
              >
                APIs
              </Link>
              <span className="text-muted-foreground/50">·</span>
              <Link
                href="/search?category=productivity"
                className="text-muted-foreground hover:text-foreground"
              >
                Productivity
              </Link>
              <span className="text-muted-foreground/50">·</span>
              <Link href="/categories" className="text-brand-600 hover:text-brand-700">
                All Categories <ArrowRight className="ml-1 inline h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-brand-100/50 blur-3xl dark:bg-brand-900/20" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="flex items-center justify-center">
                <Package className="h-8 w-8 text-brand-600" />
              </div>
              <div className="mt-2 text-3xl font-bold">500+</div>
              <div className="text-sm text-muted-foreground">MCP Packages</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center">
                <Download className="h-8 w-8 text-brand-600" />
              </div>
              <div className="mt-2 text-3xl font-bold">1M+</div>
              <div className="text-sm text-muted-foreground">Downloads</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center">
                <Users className="h-8 w-8 text-brand-600" />
              </div>
              <div className="mt-2 text-3xl font-bold">10K+</div>
              <div className="text-sm text-muted-foreground">Developers</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center">
                <Zap className="h-8 w-8 text-brand-600" />
              </div>
              <div className="mt-2 text-3xl font-bold">4</div>
              <div className="text-sm text-muted-foreground">Tools Supported</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tool Logos */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Works with your favorite AI tools
          </h2>
          <ToolLogos className="mt-8" />
        </div>
      </section>

      {/* Featured Packages */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Featured Packages</h2>
            <p className="mt-1 text-muted-foreground">
              Popular and trending MCP servers
            </p>
          </div>
          <Link
            href="/search?sort=downloads"
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            View all <ArrowRight className="ml-1 inline h-3 w-3" />
          </Link>
        </div>
        <FeaturedPackages className="mt-8" />
      </section>

      {/* Categories */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Browse by Category</h2>
            <p className="mt-1 text-muted-foreground">
              Find the right MCP server for your use case
            </p>
          </div>
          <CategoryGrid className="mt-8" />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="rounded-2xl bg-brand-600 p-8 text-center text-white sm:p-12">
          <h2 className="text-2xl font-bold sm:text-3xl">Ready to get started?</h2>
          <p className="mt-4 text-brand-100">
            Install the MCPSearch CLI and start adding MCP servers to your workflow.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <code className="rounded-lg bg-brand-700 px-4 py-2 font-mono text-sm">
              npm install -g @mcpsearch/cli
            </code>
            <span className="text-brand-200">or</span>
            <code className="rounded-lg bg-brand-700 px-4 py-2 font-mono text-sm">
              brew install mcpsearch/tap/mcp
            </code>
          </div>
          <div className="mt-8">
            <Link
              href="/docs/getting-started"
              className="inline-flex items-center rounded-lg bg-white px-6 py-3 font-semibold text-brand-600 hover:bg-brand-50"
            >
              Read the Docs <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
