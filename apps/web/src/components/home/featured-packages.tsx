import Link from 'next/link';
import { Star, Download, CheckCircle } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import type { Package } from '@mcpsearch/shared';

// Fetch featured packages from API
async function getFeaturedPackages(): Promise<Package[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/v1/packages/featured?limit=6`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch featured packages:', error);
    return [];
  }
}

interface FeaturedPackagesProps {
  className?: string;
}

export async function FeaturedPackages({ className }: FeaturedPackagesProps) {
  const packages = await getFeaturedPackages();

  if (packages.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <p>No packages available. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {packages.map((pkg) => (
        <Link
          key={pkg.packageId}
          href={`/packages/${encodeURIComponent(pkg.packageId)}`}
          className="group rounded-lg border bg-card p-4 transition-all hover:border-brand-500 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate group-hover:text-brand-600">
                  {pkg.name}
                </h3>
                {(pkg.verificationStatus === 'verified' || pkg.verificationStatus === 'official') && (
                  <CheckCircle className="h-4 w-4 flex-shrink-0 text-blue-500" />
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground truncate">{pkg.packageId}</p>
            </div>
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              v{pkg.latestVersion || '0.0.0'}
            </span>
          </div>

          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {pkg.shortDescription || pkg.description?.slice(0, 100)}
          </p>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Download className="h-3.5 w-3.5" />
                {formatNumber(pkg.stats?.totalDownloads || 0)}
              </span>
              {(pkg.stats?.averageRating || 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {(pkg.stats?.averageRating || 0).toFixed(1)}
                </span>
              )}
            </div>
            <span className="text-muted-foreground capitalize">{pkg.category || 'other'}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
