/**
 * Registry of published tools. Add a tool here only when it is live and usable;
 * the homepage, /tools/ directory, footer and sitemap all read from this list.
 *
 * Every claim below must be verifiable in the tool's source code.
 */

export type ToolStatus = 'live';

export interface Tool {
  slug: string;
  name: string;
  /** One-line summary for cards. */
  summary: string;
  category: string;
  status: ToolStatus;
  /** Where the tool itself runs. */
  appUrl: string;
  /** The tool's landing page on allofcode.com. */
  pagePath: string;
  /** Public source repository / issue tracker, if any. */
  sourceUrl?: string;
  /** Short, verified feature bullets for cards and the homepage feature. */
  highlights: string[];
  tags: string[];
}

export const tools: Tool[] = [
  {
    slug: 'sql-compare',
    name: 'SQL Compare',
    summary:
      'Compare two SQL queries or files side by side and see which differences are formatting, structural, or potentially semantic.',
    category: 'Database / SQL',
    status: 'live',
    appUrl: 'https://sql-compare.allofcode.com/',
    pagePath: '/tools/sql-compare/',
    sourceUrl: 'https://github.com/batosayjeycode/sql-compare',
    highlights: [
      'Labels every difference as formatting, structural or potentially semantic',
      'Real PostgreSQL and MySQL / MariaDB parsers, plus a Generic mode',
      'Runs entirely in your browser: no uploads, no analytics, works offline',
      'Export the difference report as Markdown, HTML or JSON',
    ],
    tags: ['PostgreSQL', 'MySQL', 'Diff', 'Browser-only'],
  },
];

export function getTool(slug: string): Tool {
  const tool = tools.find((t) => t.slug === slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return tool;
}
