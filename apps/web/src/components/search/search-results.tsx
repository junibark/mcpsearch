import Link from 'next/link';
import { Star, Download, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatNumber, formatRelativeDate } from '@/lib/utils';
import type { Package } from '@mcpsearch/shared';

interface SearchResultsProps {
  query: string;
  category?: string;
  tool?: string;
  sort: string;
  page: number;
}

interface SearchResponse {
  success: boolean;
  data: {
    packages: Package[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    };
    facets?: {
      categories?: Record<string, number>;
    };
    queryTime?: number;
  };
}

async function searchPackages(params: SearchResultsProps): Promise<SearchResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // Build query string
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('q', params.query);
  if (params.category) searchParams.set('category', params.category);
  if (params.tool) searchParams.set('tool', params.tool);
  if (params.sort) searchParams.set('sort', params.sort === 'downloads' ? 'downloads' : params.sort === 'rating' ? 'rating' : params.sort === 'recent' ? 'recent' : 'relevance');
  searchParams.set('page', String(params.page));
  searchParams.set('limit', '20');

  try {
    const res = await fetch(`${apiUrl}/v1/search?${searchParams.toString()}`, {
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      console.error('Search API error:', res.status, res.statusText);
      return {
        success: false,
        data: {
          packages: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
        },
      };
    }

    return res.json();
  } catch (error) {
    console.error('Failed to search packages:', error);
    return {
      success: false,
      data: {
        packages: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
      },
    };
  }
}

export async function SearchResults({
  query,
  category,
  tool,
  sort,
  page,
}: SearchResultsProps) {
  const response = await searchPackages({ query, category, tool, sort, page });
  const { packages, pagination } = response.data;
  const { total, totalPages } = pagination;

  if (packages.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg font-medium">No packages found</p>
        <p className="mt-2 text-muted-foreground">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Results count */}
      <div className="mb-4 text-sm text-muted-foreground">
        {query ? (
          <span>
            Found <strong>{total}</strong> packages for &quot;{query}&quot;
          </span>
        ) : (
          <span>
            Showing <strong>{total}</strong> packages
          </span>
        )}
      </div>

      {/* Results list */}
      <div className="space-y-4">
        {packages.map((pkg) => (
          <Link
            key={pkg.packageId}
            href={`/packages/${encodeURIComponent(pkg.packageId)}`}
            className="block rounded-lg border bg-card p-4 transition-all hover:border-brand-500 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{pkg.name}</h3>
                  {(pkg.verificationStatus === 'verified' || pkg.verificationStatus === 'official') && (
                    <CheckCircle className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{pkg.packageId}</p>
              </div>
              <span className="flex-shrink-0 rounded-full bg-muted px-3 py-1 text-sm">
                v{pkg.latestVersion || '0.0.0'}
              </span>
            </div>

            <p className="mt-3 text-muted-foreground line-clamp-2">
              {pkg.shortDescription || pkg.description?.slice(0, 150)}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Download className="h-4 w-4" />
                {formatNumber(pkg.stats?.totalDownloads || 0)}
              </span>
              {(pkg.stats?.averageRating || 0) > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {(pkg.stats?.averageRating || 0).toFixed(1)} ({pkg.stats?.reviewCount || 0})
                </span>
              )}
              <span className="text-muted-foreground">by {pkg.publisherName || 'Unknown'}</span>
              <span className="text-muted-foreground">
                Updated {formatRelativeDate(pkg.updatedAt)}
              </span>
            </div>

            {pkg.tags && pkg.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pkg.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <PaginationLink
            page={page - 1}
            disabled={page <= 1}
            query={query}
            category={category}
            tool={tool}
            sort={sort}
          >
            <ChevronLeft className="h-4 w-4" />
          </PaginationLink>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
            if (pageNum > totalPages) return null;
            return (
              <PaginationLink
                key={pageNum}
                page={pageNum}
                active={pageNum === page}
                query={query}
                category={category}
                tool={tool}
                sort={sort}
              >
                {pageNum}
              </PaginationLink>
            );
          })}

          <PaginationLink
            page={page + 1}
            disabled={page >= totalPages}
            query={query}
            category={category}
            tool={tool}
            sort={sort}
          >
            <ChevronRight className="h-4 w-4" />
          </PaginationLink>
        </div>
      )}
    </div>
  );
}

function PaginationLink({
  page,
  active,
  disabled,
  query,
  category,
  tool,
  sort,
  children,
}: {
  page: number;
  active?: boolean;
  disabled?: boolean;
  query?: string;
  category?: string;
  tool?: string;
  sort?: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground opacity-50">
        {children}
      </span>
    );
  }

  // Build the full query string preserving all filters
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category) params.set('category', category);
  if (tool) params.set('tool', tool);
  if (sort) params.set('sort', sort);
  params.set('page', String(page));

  return (
    <Link
      href={`/search?${params.toString()}`}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors',
        active
          ? 'bg-brand-600 text-white'
          : 'hover:bg-muted'
      )}
    >
      {children}
    </Link>
  );
}
