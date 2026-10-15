"use client";

import Link from "next/link";
import { uiError, uiLabel } from "@/lib/ui-text";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";

import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/wiki/markdown-view";
import { PageEditor } from "@/components/wiki/page-editor";
import { cn } from "@/lib/utils";

type Backlink = { slug: string; title: string; excerpt: string };
type SourceLink = { id: string; title: string; format: string };

type Props = {
  slug: string;
  title: string;
  type: "entity" | "concept" | "source" | "comparison" | "overview";
  created: string;
  updated: string;
  tags: ReadonlyArray<string>;
  content: string;
  backlinks: ReadonlyArray<Backlink>;
  knownSlugs: ReadonlyArray<string>;
  /** Raw sources that contributed to this page (from page_sources join). */
  sources?: ReadonlyArray<SourceLink>;
};

export function PageView(props: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [backlinkCount, setBacklinkCount] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(deleteOpen, dialogRef, () => setDeleteOpen(false), deleting);

  // We already have `props.backlinks` server-rendered — surface the count
  // in the confirm dialog so the user sees the consequence ("3 other pages
  // link to this; they'll become broken links until you fix them in lint").
  function openDeleteDialog() {
    setBacklinkCount(props.backlinks.length);
    setDeleteOpen(true);
    setDeleteError(null);
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/pages/${encodeURIComponent(props.slug)}/delete`,
        { method: "POST" },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        trashFilename?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.trashFilename) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      // Redirect to /wiki with delete metadata in the query so the wiki
      // index can show an "Undo" banner with one-click restore.
      const params = new URLSearchParams({
        deleted: props.slug,
        deletedTitle: props.title,
        trash: json.trashFilename,
      });
      router.push(`/wiki?${params.toString()}`);
      // router.refresh() needed because /wiki is a server component that
      // needs to re-read the updated page list.
      router.refresh();
    } catch (err) {
      setDeleteError(uiError(err));
      setDeleting(false);
    }
  }

  return (
    // Reading view stays narrow (prose-friendly). Editing view expands to
    // give the split-pane markdown/preview room to breathe.
    <article
      className={cn(
        "mx-auto px-6 py-10",
        editing ? "max-w-[1400px]" : "max-w-3xl",
      )}
    >
      {!editing ? (
        <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{props.title}</h1>
            <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
              {uiLabel(props.type)} · 创建于 {props.created} · 更新于 {props.updated}
              {props.tags.length > 0 ? ` · ${props.tags.join(", ")}` : null}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              编辑
            </Button>
            <Link
              href={`/wiki/${props.slug}/history`}
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              title="查看历史版本与内容差异"
            >
              历史版本
            </Link>
            <Button
              variant="ghost"
              onClick={openDeleteDialog}
              className="text-muted-foreground hover:text-destructive"
            >
              删除
            </Button>
          </div>
        </header>
      ) : (
        <header className="mb-6 border-b border-border pb-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            正在编辑 {props.slug}
          </p>
        </header>
      )}

      {editing ? (
        <PageEditor
          slug={props.slug}
          initialTitle={props.title}
          initialType={props.type}
          initialContent={props.content}
          knownSlugs={props.knownSlugs}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <>
          <MarkdownView content={props.content} knownSlugs={props.knownSlugs} />

          {props.sources && props.sources.length > 0 ? (
            <section className="mt-10 border-t border-border pt-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                资料来源（{props.sources.length})
              </h2>
              <p className="mt-1 text-xs text-muted-foreground/80">
                这篇知识页所依据的原始资料。原始文件保留在本机。
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {props.sources.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/sources/${s.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-primary/40 hover:bg-accent"
                    >
                      <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        {s.format}
                      </span>
                      <span>{s.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10 border-t border-border pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              反向链接（{props.backlinks.length})
            </h2>
            {props.backlinks.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                还没有其他知识页链接到这里。
              </p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {props.backlinks.map((b) => (
                  <li key={b.slug}>
                    <a
                      href={`/wiki/${b.slug}`}
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      {b.title}
                    </a>
                    <p className="mt-0.5 text-xs text-muted-foreground">{b.excerpt}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Delete confirm dialog — bespoke modal (no shadcn Dialog installed)
          so we can show the backlinks consequence inline. */}
      {deleteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleting && setDeleteOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-page-title"
            className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-page-title" className="font-display text-h3 font-semibold">
              将此知识页移入回收目录？
            </h2>
            <p className="mt-1 text-ui text-muted-foreground">
              <strong className="text-foreground">{props.title}</strong>
            </p>

            <div className="mt-4 space-y-2 text-ui">
              <p>
                知识页文件将移至{" "}
                <code className="font-mono text-[12px]">
                  .llm-wiki/trash/wiki/
                </code>
                ，可在 30 天内恢复，并可通过 <strong>撤销</strong>{" "}
                操作会在下一页显示。
              </p>
              {backlinkCount !== null && backlinkCount > 0 ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-800 dark:text-amber-200">
                  <p>
                    <strong>{backlinkCount} 个其他知识页</strong>{" "}
                    链接 到此页面，移除后这些链接将失效，可以在知识检查中处理。
                  </p>
                  {props.backlinks.length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 text-[12px]">
                      {props.backlinks.slice(0, 3).map((b) => (
                        <li key={b.slug}>{b.title}</li>
                      ))}
                      {props.backlinks.length > 3 ? (
                        <li className="text-muted-foreground">
                          + {props.backlinks.length - 3} 更多
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>

            {deleteError ? (
              <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                取消
              </Button>
              <Button
                variant="outline"
                onClick={confirmDelete}
                disabled={deleting}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                {deleting ? "正在移入回收目录…" : "移入回收目录"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
