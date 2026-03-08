'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBoxProps {
  size?: 'sm' | 'md' | 'lg';
  placeholder?: string;
  className?: string;
  defaultValue?: string;
}

export function SearchBox({
  size = 'md',
  placeholder = 'Search packages...',
  className,
  defaultValue = '',
}: SearchBoxProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router]
  );

  const sizeClasses = {
    sm: 'h-9 text-sm',
    md: 'h-10',
    lg: 'h-12 text-lg',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <form onSubmit={handleSubmit} className={cn('relative w-full max-w-2xl', className)}>
      <div className="relative">
        <Search
          className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground',
            iconSizes[size]
          )}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-lg border bg-background pl-10 pr-4 outline-none transition-all',
            'placeholder:text-muted-foreground',
            'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
            sizeClasses[size]
          )}
        />
      </div>
    </form>
  );
}
