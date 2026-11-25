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
  {
    slug: 'js-quiz',
    name: 'JS Quiz',
    summary:
      'Predict what a JavaScript snippet prints, then run it in a sandbox and see whether you were right, with an explanation for every question.',
    category: 'JavaScript',
    status: 'live',
    appUrl: 'https://js-quiz.allofcode.com/',
    pagePath: '/tools/js-quiz/',
    sourceUrl: 'https://github.com/batosayjeycode/allofcode-js-quiz',
    highlights: [
      '10 questions on coercion, scope, closures, promises and the event loop, shuffled per session',
      'Your answer is checked against the real output of the code, not a stored string',
      'Timed: 5 minutes to read the questions, then 5, 10 or 15 minutes to answer',
      'Result with accuracy, a per-question review and a rule-based interviewer summary',
    ],
    tags: ['JavaScript', 'Event loop', 'Interview prep', 'Browser-only'],
  },
];

export function getTool(slug: string): Tool {
  const tool = tools.find((t) => t.slug === slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return tool;
}
