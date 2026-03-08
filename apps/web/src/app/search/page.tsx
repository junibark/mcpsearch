import { Suspense } from 'react';
import { SearchBox } from '@/components/search/search-box';
import { SearchResults } from '@/components/search/search-results';
import { SearchFilters } from '@/components/search/search-filters';

interface SearchPageProps {
  searchParams: {
    q?: string;
    category?: string;
    tool?: string;
    sort?: string;
    page?: string;
  };
}

export const metadata = {
  title: 'Search',
  description: 'Search for MCP packages',
};

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q ?? '';
  const category = searchParams.category;
  const tool = searchParams.tool;
  const sort = searchParams.sort ?? 'downloads';
  const page = parseInt(searchParams.page ?? '1', 10);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <SearchBox
          size="lg"
          defaultValue={query}
          placeholder="Search for MCP packages..."
          className="mx-auto"
        />
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Filters Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
            <SearchFilters
              selectedCategory={category}
              selectedTool={tool}
              selectedSort={sort}
            />
          </Suspense>
        </aside>

        {/* Results */}
        <main className="flex-1 min-w-0">
          <Suspense
            fallback={
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            }
          >
            <SearchResults
              query={query}
              category={category}
              tool={tool}
              sort={sort}
              page={page}
            />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
