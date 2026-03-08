import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Package, Review } from '@mcpsearch/shared';

// API fetch helper
async function getPackage(packageId: string): Promise<Package | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/v1/packages/${encodeURIComponent(packageId)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data;
  } catch {
    return null;
  }
}

async function getPackageReviews(packageId: string): Promise<Review[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const res = await fetch(
      `${apiUrl}/v1/packages/${encodeURIComponent(packageId)}/reviews?limit=5`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: { packageId: string };
}): Promise<Metadata> {
  const pkg = await getPackage(params.packageId);
  if (!pkg) {
    return { title: 'Package Not Found - MCPSearch' };
  }
  return {
    title: `${pkg.name} - MCPSearch`,
    description: pkg.shortDescription || pkg.description?.slice(0, 160),
  };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      ))}
    </div>
  );
}

function ToolBadge({ tool, supported }: { tool: string; supported: boolean }) {
  const toolNames: Record<string, string> = {
    claudeCode: 'Claude Code',
    cursor: 'Cursor',
    windsurf: 'Windsurf',
    continueDev: 'Continue.dev',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        supported
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {toolNames[tool] || tool}
    </span>
  );
}

function CapabilityBadge({ capability }: { capability: string }) {
  const colors: Record<string, string> = {
    tools: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    resources: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    prompts: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    sampling: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
        colors[capability] || 'bg-muted text-muted-foreground'
      }`}
    >
      {capability}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text)}
      className="absolute right-2 top-2 p-1.5 rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  );
}

function InstallationSection({ packageId, name }: { packageId: string; name: string }) {
  const serverName = name.toLowerCase().replace(/\s+/g, '-');

  // Generate config snippets for different tools
  const claudeCodeConfig = JSON.stringify({
    mcpServers: {
      [serverName]: {
        command: 'npx',
        args: ['-y', packageId],
      },
    },
  }, null, 2);

  const cursorConfig = JSON.stringify({
    mcp: {
      servers: {
        [serverName]: {
          command: 'npx',
          args: ['-y', packageId],
        },
      },
    },
  }, null, 2);

  return (
    <div className="space-y-6">
      {/* Quick Install with MCPSearch CLI */}
      <div className="border rounded-lg p-6">
        <h3 className="font-semibold mb-2">Quick Install</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Install using the MCPSearch CLI (recommended)
        </p>
        <div className="relative">
          <code className="block bg-muted px-4 py-3 rounded-lg font-mono text-sm overflow-x-auto pr-12">
            mcp install {packageId}
          </code>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Don&apos;t have the CLI?{' '}
          <Link href="/cli" className="text-primary hover:underline">
            Install it first
          </Link>
        </p>
      </div>

      {/* NPX Direct Usage */}
      <div className="border rounded-lg p-6">
        <h3 className="font-semibold mb-2">Run with npx</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Run directly without installing
        </p>
        <div className="relative">
          <code className="block bg-muted px-4 py-3 rounded-lg font-mono text-sm overflow-x-auto pr-12">
            npx -y {packageId}
          </code>
        </div>
      </div>

      {/* Manual Configuration */}
      <div className="border rounded-lg p-6">
        <h3 className="font-semibold mb-2">Manual Configuration</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Add to your MCP client configuration file
        </p>

        {/* Claude Code / Claude Desktop */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-xs font-bold text-orange-700 dark:text-orange-300">C</span>
            Claude Code / Claude Desktop
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            Add to <code className="bg-muted px-1 rounded">~/.claude/claude_desktop_config.json</code>
          </p>
          <div className="relative">
            <pre className="bg-muted px-4 py-3 rounded-lg font-mono text-xs overflow-x-auto pr-12">
              {claudeCodeConfig}
            </pre>
          </div>
        </div>

        {/* Cursor */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">Cu</span>
            Cursor
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            Add to <code className="bg-muted px-1 rounded">~/.cursor/mcp.json</code>
          </p>
          <div className="relative">
            <pre className="bg-muted px-4 py-3 rounded-lg font-mono text-xs overflow-x-auto pr-12">
              {cursorConfig}
            </pre>
          </div>
        </div>

        {/* VS Code / Continue.dev */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">VS</span>
            VS Code / Continue.dev
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            Add to <code className="bg-muted px-1 rounded">.vscode/mcp.json</code> or Continue settings
          </p>
          <div className="relative">
            <pre className="bg-muted px-4 py-3 rounded-lg font-mono text-xs overflow-x-auto pr-12">
              {claudeCodeConfig}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function PackageDetailPage({
  params,
}: {
  params: { packageId: string };
}) {
  const pkg = await getPackage(params.packageId);

  if (!pkg) {
    notFound();
  }

  const reviews = await getPackageReviews(params.packageId);

  const compatibility = pkg.compatibility || {
    claudeCode: { supported: true },
    cursor: { supported: true },
    windsurf: { supported: true },
    continueDev: { supported: true },
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/search" className="hover:text-foreground">Packages</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{pkg.packageId}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{pkg.name}</h1>
                <p className="text-muted-foreground font-mono mt-1">{pkg.packageId}</p>
              </div>
              {(pkg.verificationStatus === 'verified' || pkg.verificationStatus === 'official') && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-sm font-medium">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {pkg.verificationStatus === 'official' ? 'Official' : 'Verified'}
                </span>
              )}
            </div>

            <p className="mt-4 text-lg text-muted-foreground">
              {pkg.shortDescription || pkg.description?.slice(0, 200)}
            </p>

            {/* Stats */}
            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
              {(pkg.stats?.averageRating || 0) > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating rating={Math.round(pkg.stats?.averageRating || 0)} />
                  <span className="text-muted-foreground">
                    ({pkg.stats?.reviewCount || 0} reviews)
                  </span>
                </div>
              )}
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {(pkg.stats?.totalDownloads || 0).toLocaleString()}
                </span>{' '}
                downloads
              </div>
              <div className="text-muted-foreground">
                v{pkg.latestVersion || '0.0.0'}
              </div>
            </div>
          </div>

          {/* Capabilities */}
          {pkg.capabilities && pkg.capabilities.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Capabilities</h2>
              <div className="flex flex-wrap gap-2">
                {pkg.capabilities.map((cap) => (
                  <CapabilityBadge key={cap} capability={cap} />
                ))}
              </div>
            </div>
          )}

          {/* Installation (Mobile - shown above description on mobile) */}
          <div className="lg:hidden">
            <h2 className="text-lg font-semibold mb-4">Installation</h2>
            <InstallationSection packageId={pkg.packageId} name={pkg.name} />
          </div>

          {/* Description / README */}
          <div>
            <h2 className="text-lg font-semibold mb-3">About</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {pkg.description ? (
                <div className="whitespace-pre-wrap">{pkg.description}</div>
              ) : (
                <p className="text-muted-foreground">No description available.</p>
              )}
            </div>
          </div>

          {/* Reviews */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Reviews</h2>
              {reviews.length > 0 && (
                <Link
                  href={`/packages/${pkg.packageId}/reviews`}
                  className="text-sm text-primary hover:underline"
                >
                  See all reviews
                </Link>
              )}
            </div>

            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No reviews yet. Be the first to review this package!
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.reviewId}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{review.username}</span>
                        <StarRating rating={review.rating} />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {review.title && (
                      <h4 className="font-medium mb-1">{review.title}</h4>
                    )}
                    {review.body && (
                      <p className="text-sm text-muted-foreground">{review.body}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Installation (Desktop) */}
          <div className="hidden lg:block">
            <InstallationSection packageId={pkg.packageId} name={pkg.name} />
          </div>

          {/* Compatibility */}
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Compatible With</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(compatibility).map(([tool, config]) => (
                <ToolBadge
                  key={tool}
                  tool={tool}
                  supported={typeof config === 'object' ? config.supported : !!config}
                />
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Details</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Version</dt>
                <dd className="font-mono">{pkg.latestVersion || '0.0.0'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">License</dt>
                <dd>{pkg.license || 'Not specified'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Category</dt>
                <dd>
                  <Link
                    href={`/search?category=${pkg.category}`}
                    className="text-primary hover:underline capitalize"
                  >
                    {pkg.category || 'other'}
                  </Link>
                </dd>
              </div>
              {pkg.mcpVersion && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">MCP Version</dt>
                  <dd className="font-mono text-xs">{pkg.mcpVersion}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Published</dt>
                <dd>{new Date(pkg.createdAt).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{new Date(pkg.updatedAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          {/* Links */}
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Links</h3>
            <div className="space-y-2">
              {pkg.repository?.url && (
                <a
                  href={pkg.repository.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  Repository
                </a>
              )}
              {pkg.homepage && (
                <a
                  href={pkg.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Homepage
                </a>
              )}
              {pkg.documentation && (
                <a
                  href={pkg.documentation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Documentation
                </a>
              )}
              <a
                href={`https://www.npmjs.com/package/${pkg.packageId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z"/>
                </svg>
                npm
              </a>
            </div>
          </div>

          {/* Tags */}
          {pkg.tags && pkg.tags.length > 0 && (
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {pkg.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/search?q=${encodeURIComponent(tag)}`}
                    className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs hover:bg-muted/80"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
