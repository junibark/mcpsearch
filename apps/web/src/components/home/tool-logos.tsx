import { cn } from '@/lib/utils';

const tools = [
  {
    name: 'Claude Code',
    logo: '/logos/claude-code.svg',
    fallback: 'CC',
  },
  {
    name: 'Cursor',
    logo: '/logos/cursor.svg',
    fallback: 'Cu',
  },
  {
    name: 'Windsurf',
    logo: '/logos/windsurf.svg',
    fallback: 'WS',
  },
  {
    name: 'Continue.dev',
    logo: '/logos/continue.svg',
    fallback: 'Cd',
  },
];

interface ToolLogosProps {
  className?: string;
}

export function ToolLogos({ className }: ToolLogosProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-8', className)}>
      {tools.map((tool) => (
        <div
          key={tool.name}
          className="flex flex-col items-center gap-2 opacity-60 grayscale transition-all hover:opacity-100 hover:grayscale-0"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-lg font-bold text-muted-foreground">
            {tool.fallback}
          </div>
          <span className="text-sm text-muted-foreground">{tool.name}</span>
        </div>
      ))}
    </div>
  );
}
