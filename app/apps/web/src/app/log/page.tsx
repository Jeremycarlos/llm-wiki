import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { listPageRows, WIKI_PATHS } from "@llm-wiki/core";

import { PageContainer, PageHeader } from "@/components/page-shell";
import { MarkdownView } from "@/components/wiki/markdown-view";
import { openWikiContext, requireSetup } from "@/lib/server-wiki";
import { displayLogEntry } from "@/lib/ui-text";

export const dynamic = "force-dynamic";

// Splits log.md into its intro (the "# Wiki Log" preamble) and one entry
// per "## [stamp] …" heading. Entries are returned in file order; the page
// reverses them so newest is on top.
function parseLogEntries(text: string): { intro: string; entries: string[] } {
  const lines = text.split(/\r?\n/);
  const entryStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if ((lines[i] ?? "").startsWith("## [")) entryStarts.push(i);
  }
  if (entryStarts.length === 0) {
    return { intro: text.trim(), entries: [] };
  }
  const introEnd = entryStarts[0]!;
  const intro = lines.slice(0, introEnd).join("\n").trim();
  const entries: string[] = [];
  for (let i = 0; i < entryStarts.length; i++) {
    const start = entryStarts[i]!;
    const end = i + 1 < entryStarts.length ? entryStarts[i + 1]! : lines.length;
    entries.push(lines.slice(start, end).join("\n").trim());
  }
  return { intro, entries };
}

export default async function LogPage() {
  await requireSetup();
  const ctx = await openWikiContext();
  let raw = "";
  let knownSlugs: string[] = [];
  try {
    const path = join(ctx.wikiPath, WIKI_PATHS.log);
    try {
      raw = await readFile(path, "utf8");
    } catch {
      raw = "";
    }
    knownSlugs = listPageRows(ctx.db).map((r) => r.slug);
  } finally {
    ctx.db.close();
  }

  const { entries } = parseLogEntries(raw);
  const newestFirst = [...entries].reverse();

  return (
    <PageContainer width="lg">
      <PageHeader
        eyebrow="知识整理足迹"
        title="活动记录"
        description={
          <>
            按时间查看资料整理、页面编辑、知识检查与规范修改，记录同时保存在{" "}
            <code className="font-mono">{ctx.wikiPath}/log.md</code> 中，也可以用编辑器查看。
          </>
        }
      />

      {entries.length === 0 ? (
        <p className="rounded-md border border-border/70 bg-card p-4 text-sm text-muted-foreground">
          还没有活动记录。添加资料、编辑知识页或运行检查后，记录会出现在这里。
        </p>
      ) : (
        <>
          <p className="mb-4 text-caption uppercase tracking-wider text-muted-foreground">
            {entries.length} 条记录 · 最近记录在前
          </p>
          <article className="space-y-4">
            {newestFirst.map((entry, i) => (
              <div
                key={`${entries.length - i - 1}`}
                className="rounded-md border border-border/70 bg-card p-4"
              >
                <MarkdownView content={displayLogEntry(entry)} knownSlugs={knownSlugs} />
              </div>
            ))}
          </article>
        </>
      )}
    </PageContainer>
  );
}
