'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CATEGORIES, SUPPORTED_TOOLS } from '@mcpsearch/shared';
import { cn } from '@/lib/utils';

interface SearchFiltersProps {
  selectedCategory?: string;
  selectedTool?: string;
  selectedSort: string;
}

export function SearchFilters({
  selectedCategory,
  selectedTool,
  selectedSort,
}: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset to page 1
    router.push(`/search?${params.toString()}`);
  };

  const sortOptions = [
    { value: 'downloads', label: 'Most Downloads' },
    { value: 'recent', label: 'Recently Updated' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'relevance', label: 'Most Relevant' },
  ];

  return (
    <div className="space-y-6">
      {/* Sort */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Sort By</h3>
        <div className="space-y-1">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateFilter('sort', option.value)}
              className={cn(
                'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                selectedSort === option.value
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                  : 'hover:bg-muted'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Category</h3>
        <div className="space-y-1">
          <button
            onClick={() => updateFilter('category', null)}
            className={cn(
              'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
              !selectedCategory
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                : 'hover:bg-muted'
            )}
          >
            All Categories
          </button>
          {Object.values(CATEGORIES).map((category) => (
            <button
              key={category.id}
              onClick={() => updateFilter('category', category.id)}
              className={cn(
                'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                selectedCategory === category.id
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                  : 'hover:bg-muted'
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Compatible With</h3>
        <div className="space-y-1">
          <button
            onClick={() => updateFilter('tool', null)}
            className={cn(
              'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
              !selectedTool
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                : 'hover:bg-muted'
            )}
          >
            All Tools
          </button>
          {Object.values(SUPPORTED_TOOLS).map((tool) => (
            <button
              key={tool.id}
              onClick={() => updateFilter('tool', tool.id)}
              className={cn(
                'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                selectedTool === tool.id
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                  : 'hover:bg-muted'
              )}
            >
              {tool.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
