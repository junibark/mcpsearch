import Link from 'next/link';
import {
  Wrench,
  Database,
  Cloud,
  Code,
  Calendar,
  BarChart3,
  MessageSquare,
  Shield,
  Brain,
  Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  {
    id: 'utilities',
    name: 'Utilities',
    description: 'File system, shell, and general-purpose tools',
    icon: Wrench,
    color: 'bg-blue-500',
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Database connectors and query tools',
    icon: Database,
    color: 'bg-green-500',
  },
  {
    id: 'api',
    name: 'APIs & Integrations',
    description: 'Third-party API connectors',
    icon: Cloud,
    color: 'bg-purple-500',
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Development tools and debugging',
    icon: Code,
    color: 'bg-orange-500',
  },
  {
    id: 'productivity',
    name: 'Productivity',
    description: 'Calendar, email, and task management',
    icon: Calendar,
    color: 'bg-pink-500',
  },
  {
    id: 'data',
    name: 'Data & Analytics',
    description: 'Data processing and visualization',
    icon: BarChart3,
    color: 'bg-cyan-500',
  },
  {
    id: 'communication',
    name: 'Communication',
    description: 'Slack, Discord, and messaging',
    icon: MessageSquare,
    color: 'bg-yellow-500',
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Security tools and authentication',
    icon: Shield,
    color: 'bg-red-500',
  },
  {
    id: 'ai',
    name: 'AI & ML',
    description: 'AI model integrations',
    icon: Brain,
    color: 'bg-indigo-500',
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Miscellaneous tools',
    icon: Box,
    color: 'bg-gray-500',
  },
];

interface CategoryGridProps {
  className?: string;
}

export function CategoryGrid({ className }: CategoryGridProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5', className)}>
      {categories.map((category) => {
        const Icon = category.icon;
        return (
          <Link
            key={category.id}
            href={`/search?category=${category.id}`}
            className="group rounded-lg border bg-card p-4 transition-all hover:border-brand-500 hover:shadow-md"
          >
            <div
              className={cn(
                'mb-3 inline-flex rounded-lg p-2 text-white',
                category.color
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="font-medium group-hover:text-brand-600">{category.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {category.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
