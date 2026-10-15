import type { Page } from "../types";

// Per docs/05. Kept as a function rather than a static string so per-wiki
// context (schema, index, top-K pages) interpolates predictably.

const SYSTEM_RULES = `You maintain an LLM Wiki following Andrej Karpathy's pattern. Read the new source and produce structured updates as a single JSON object.

Behavior rules:
- Slugs are kebab-case, lowercase, hyphens only, no special chars.
- Cross-link liberally with [[slug]] or [[slug|Display Name]].
- One entity or concept per page. Keep pages focused.
- Update existing pages rather than duplicating info.
- If new info contradicts an existing page, flag it in the contradictions array.
- Be concise. This is a personal wiki, not Wikipedia.
- Page type guidance:
  - entity: a person, organization, product, place
  - concept: an idea, technique, framework, theorem
  - source: a single-document summary (use sparingly, only for important sources)
  - comparison: two or more entities/concepts contrasted
  - overview: high-level synthesis`;

// An explicit shape example. This is the most reliable way to get smaller
// models (Haiku, GPT-4o-mini) to produce JSON that matches the zod schema.
// Without this example, weaker models tend to invent their own field names
// or repurpose `category` for the wiki topic.
const ZH_CN_OUTPUT_RULES = `Output language rules:
- Write ALL user-facing text in Simplified Chinese, including page titles, Markdown headings and bodies, summaries, update reasons, log entries, contradiction descriptions, and tags.
- Keep JSON property names, enum values, slugs, wikilink targets, URLs, quotations from the source, formulas, model identifiers, and standard acronyms unchanged.
- When a technical term first appears, use a Chinese name followed by its established English name or acronym in parentheses when helpful.
- These language rules are mandatory even when the source, existing pages, or the example shape below are written in English.`;

function jsonShape(outputLanguage?: "zh-CN"): string {
  const text =
    outputLanguage === "zh-CN"
      ? {
          summary: "从该来源提取内容的一句中文摘要。",
          title: "中文页面标题",
          content: "中文 Markdown 正文，使用 [[other-slug]] 建立交叉链接。",
          updateContent: "该页面更新后的完整中文正文（整页替换，不是差异片段）。",
          updateReason: "需要此次更新的中文说明。",
          indexSummary: "用于索引的中文单句摘要，建议 100—150 个字符，最多 200 个字符。",
          logEntry: "本次摄取的单行中文摘要。",
          contradiction: "冲突内容与位置的中文说明。",
        }
      : {
          summary: "Short, single-sentence summary of what was extracted from this source.",
          title: "Display Title",
          content: "Markdown body. Use [[other-slug]] for cross-links.",
          updateContent: "Full new body for this page (entire replacement, not a diff).",
          updateReason: "Why this update was needed.",
          indexSummary: "Short one-liner for the index — aim for 100-150 chars, hard cap 200.",
          logEntry: "Single-line summary of this ingest.",
          contradiction: "Description of what disagrees and where.",
        };

  return `Output ONLY a valid JSON object matching this exact shape. No prose, no markdown fences:

{
  "summary": "${text.summary}",
  "newPages": [
    {
      "slug": "kebab-case-slug",
      "title": "${text.title}",
      "type": "concept",
      "content": "${text.content}",
      "tags": ["tag1", "tag2"]
    }
  ],
  "pageUpdates": [
    {
      "slug": "existing-page-slug",
      "content": "${text.updateContent}",
      "updateReason": "${text.updateReason}"
    }
  ],
  "indexEntries": [
    {
      "slug": "page-slug",
      "category": "concepts",
      "summary": "${text.indexSummary}"
    }
  ],
  "logEntry": "${text.logEntry}",
  "contradictions": [
    {
      "description": "${text.contradiction}",
      "pages": ["slug-a", "slug-b"]
    }
  ]
}

Strict field rules — get any of these wrong and the JSON is rejected:
- "type" on newPages MUST be one of: "entity", "concept", "source", "comparison", "overview" (singular, lowercase).
- "category" on indexEntries MUST be one of: "entities", "concepts", "sources", "comparisons", "overviews" (PLURAL, lowercase). Do NOT use the wiki's topic name.
- "slug" everywhere MUST be kebab-case ([a-z0-9-]+), never capitalized, never spaced.
- "newPages", "pageUpdates", "indexEntries", "contradictions" are ALWAYS arrays. Use [] (not omitted, not null) when empty.
- "summary" and "logEntry" are required strings.`;
}

export type ExistingPageSnippet = {
  slug: string;
  title: string;
  type: Page["frontmatter"]["type"];
  excerpt: string;
};

export type BuildIngestPromptOpts = {
  schema: string;
  index: string;
  relevantPages: ExistingPageSnippet[];
  outputLanguage?: "zh-CN";
  source: {
    title: string;
    format: string;
    content: string;
  };
};

export function buildIngestPrompt(opts: BuildIngestPromptOpts): {
  system: string;
  user: string;
} {
  const pagesBlock =
    opts.relevantPages.length > 0
      ? opts.relevantPages
          .map(
            (p) =>
              `### ${p.title} (slug: ${p.slug}, type: ${p.type})\n${truncateToWords(p.excerpt, 1000)}`,
          )
          .join("\n\n---\n\n")
      : "(no existing pages yet — this wiki is empty)";

  const system = [
    SYSTEM_RULES,
    ...(opts.outputLanguage === "zh-CN" ? ["", ZH_CN_OUTPUT_RULES] : []),
    "",
    "User schema (CLAUDE.md) — describes the wiki's topic and editorial rules. Do NOT confuse the user's topic with the JSON schema below.",
    fenceMarkdown(opts.schema),
    "",
    "Current wiki index:",
    fenceMarkdown(opts.index),
    "",
    `Existing pages (top ${opts.relevantPages.length} most relevant):`,
    fenceMarkdown(pagesBlock),
    "",
    jsonShape(opts.outputLanguage),
  ].join("\n");

  const user = [
    `New source: "${opts.source.title}" (format: ${opts.source.format})`,
    "",
    "--- BEGIN SOURCE ---",
    opts.source.content,
    "--- END SOURCE ---",
  ].join("\n");

  return { system, user };
}

function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}\n\n[truncated: ${words.length - maxWords} more words]`;
}

// Markdown blocks inside the prompt get fenced so the LLM never confuses them
// with its own output structure. Pick a long fence so embedded triple-backticks
// in the user's schema or pages don't terminate it early.
function fenceMarkdown(text: string): string {
  return `\`\`\`\`markdown\n${text}\n\`\`\`\``;
}
