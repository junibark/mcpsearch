import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { QueryProvider } from '@/components/query-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'MCPSearch - Discover and Install MCP Servers',
    template: '%s | MCPSearch',
  },
  description:
    'Find and install Model Context Protocol (MCP) servers for Claude Code, Cursor, Windsurf, and other AI coding tools.',
  keywords: [
    'MCP',
    'Model Context Protocol',
    'Claude',
    'Cursor',
    'AI',
    'coding',
    'tools',
    'servers',
  ],
  authors: [{ name: 'MCPSearch' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://mcpsearch.com',
    siteName: 'MCPSearch',
    title: 'MCPSearch - Discover and Install MCP Servers',
    description:
      'Find and install Model Context Protocol (MCP) servers for Claude Code, Cursor, Windsurf, and other AI coding tools.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MCPSearch - Discover and Install MCP Servers',
    description:
      'Find and install Model Context Protocol (MCP) servers for Claude Code, Cursor, Windsurf, and other AI coding tools.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <div className="relative flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
