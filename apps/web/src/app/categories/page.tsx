import { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Categories - MCPSearch',
  description: 'Browse MCP servers by category',
};

const categories = [
  {
    id: 'utilities',
    name: 'Utilities',
    description: 'File system, shell, and general-purpose utilities',
    icon: Wrench,
    color: 'bg-blue-500',
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Database connectors and query tools for PostgreSQL, MongoDB, MySQL, and more',
    icon: Database,
    color: 'bg-green-500',
  },
  {
    id: 'api',
    name: 'APIs & Integrations',
    description: 'Third-party API integrations and connectors for popular services',
    icon: Cloud,
    color: 'bg-purple-500',
  },
  {
    id: 'development',
    name: 'Development',
    description: 'Development tools, debugging, testing, and code analysis',
    icon: Code,
    color: 'bg-orange-500',
  },
  {
    id: 'productivity',
    name: 'Productivity',
    description: 'Calendar, email, notes, and task management integrations',
    icon: Calendar,
    color: 'bg-pink-500',
  },
  {
    id: 'data',
    name: 'Data & Analytics',
    description: 'Data processing, analysis, visualization, and reporting tools',
    icon: BarChart3,
    color: 'bg-cyan-500',
  },
  {
    id: 'communication',
    name: 'Communication',
    description: 'Slack, Discord, Teams, and messaging platform integrations',
    icon: MessageSquare,
    color: 'bg-indigo-500',
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Security tools, authentication, secrets management, and encryption',
    icon: Shield,
    color: 'bg-red-500',
  },
  {
    id: 'ai',
    name: 'AI & ML',
    description: 'AI model integrations, embeddings, and machine learning tools',
    icon: Brain,
    color: 'bg-violet-500',
  },
  {
    id: 'other',
    name: 'Other',
    description: 'Miscellaneous tools and integrations',
    icon: Box,
    color: 'bg-gray-500',
  },
];

async function getCategoryCounts(): Promise<Record<string, number>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    // Fetch counts for each category
    const counts: Record<string, number> = {};
    await Promise.all(
      categories.map(async (cat) => {
        const res = await fetch(`${apiUrl}/v1/search?category=${cat.id}&limit=1`, {
          next: { revalidate: 60 },
        });
        if (res.ok) {
          const data = await res.json();
          counts[cat.id] = data.data?.pagination?.total || 0;
        }
      })
    );
    return counts;
  } catch {
    return {};
  }
}

export default async function CategoriesPage() {
  const counts = await getCategoryCounts();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Browse by Category</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Explore MCP servers organized by use case and functionality
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const Icon = category.icon;
          const count = counts[category.id] || 0;

          return (
            <Link
              key={category.id}
              href={`/search?category=${category.id}`}
              className="group rounded-lg border bg-card p-6 transition-all hover:border-brand-500 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg ${category.color} text-white`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold group-hover:text-brand-600">
                      {category.name}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      {count} {count === 1 ? 'package' : 'packages'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {category.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
