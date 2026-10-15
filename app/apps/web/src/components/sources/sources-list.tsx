"use client";

import Link from "next/link";
import { uiError } from "@/lib/ui-text";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type SourceItem = {
  id: string;
  filename: string;
  originalName: string | null;
  format: string;
  sizeBytes: number;
  addedAt: string;
  ingestedAt: string | null;
  url: string | null;
  title: string | null;
  pageCount: number;
};

// Format icons stay in plain text — easier on the eye than emoji for a
// reading-first product, and matches the rest of the app's chrome.
const FORMAT_LABEL: Record<string, string> = {
  markdown: "MD",
  text: "TXT",
  html: "HTML",
  url: "URL",
  pdf: "PDF",
  docx: "DOCX",
  pptx: "PPTX",
  xlsx: "XLSX",
  image: "IMG",
};

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return d.toISOString().slice(0, 10);
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

type Props = {
  // Bumping this from the parent forces a re-fetch after a successful ingest.
  refreshNonce: number;
};

export function SourcesList({ refreshNonce }: Props) {
  const [sources, setSources] = useState<SourceItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionFlash, setActionFlash] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/sources", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sources: SourceItem[] };
      setSources(data.sources);
      setError(null);
    } catch (err) {
      setError(uiError(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchSources();
      void cancelled;
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchSources, refreshNonce]);

  async function onRetry(s: SourceItem) {
    setBusyId(s.id);
    setActionFlash(null);
    setError(null);

    try {
      const res = await fetch(`/api/sources/${s.id}/retry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        providerUsed?: string;
        modelUsed?: string;
        response?: {
          newPages: Array<{ slug: string; title: string }>;
          pageUpdates: Array<{ slug: string }>;
        };
      };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);


      const newN = json.response?.newPages.length ?? 0;
      const updN = json.response?.pageUpdates.length ?? 0;
      setActionFlash(
        `资料已整理。${newN}个新增知识页, ${updN}个更新。`,
      );
      await fetchSources();
    } catch (err) {

      setError(uiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(s: SourceItem) {
    const label =
      s.title?.trim() || s.originalName?.trim() || s.url?.trim() || s.filename;
    const isPending = s.ingestedAt === null;
    const cascadeNote = s.pageCount > 0
      ? ` 该资料关联 ${s.pageCount} 个知识页，这些知识页会保留，缺失来源可在后续检查中处理。`
      : "";
    const msg = isPending
      ? `移除待处理资料“${label}”？原始文件将移入回收目录，可在 30 天内恢复。`
      : `移除资料“${label}”？${cascadeNote} 原始文件将移入回收目录，可在 30 天内恢复。`;
    if (!confirm(msg)) return;

    setBusyId(s.id);
    setActionFlash(null);
    setError(null);
    try {
      const res = await fetch(`/api/sources/${s.id}/delete`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setActionFlash("已移除。");
      await fetchSources();
    } catch (err) {
      setError(uiError(err));
    } finally {
      setBusyId(null);
    }
  }

  if (error && sources === null) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        无法加载资料： {error}
      </p>
    );
  }

  if (sources === null) {
    return <p className="text-sm text-muted-foreground">正在加载资料…</p>;
  }

  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        还没有资料。使用下方表单添加第一份笔记、文档或网页。
      </p>
    );
  }

  // Newest first — most recent ingest is what the user usually wants to see.
  const sorted = [...sources].sort((a, b) =>
    a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : 0,
  );

  const pendingCount = sources.filter((s) => s.ingestedAt === null).length;

  return (
    <div className="space-y-3">
      {pendingCount > 0 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          {pendingCount} 份资料 份待处理资料，之前的整理尚未完成。可以 <strong>重试</strong> （使用资料整理模型），或 <strong>删除</strong> 将其移出列表。
        </p>
      ) : null}

      {actionFlash ? (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          {actionFlash}
        </p>
      ) : null}
      {error && sources !== null ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-border">
        {sorted.map((s) => {
          const label =
            s.title?.trim() ||
            s.originalName?.trim() ||
            s.url?.trim() ||
            s.filename;
          const formatBadge = FORMAT_LABEL[s.format] ?? s.format.toUpperCase();
          const isPending = s.ingestedAt === null;
          const isBusy = busyId === s.id;
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2.5"
            >
              <div className="min-w-0 flex-1">
                {/* Title area is a link to /sources/[id] — buttons sit
                    outside the link so clicks don't bubble. */}
                <Link
                  href={`/sources/${s.id}`}
                  prefetch
                  className="block min-w-0 hover:text-primary"
                >
                  <p className="truncate text-sm font-medium">{label}</p>
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">{formatBadge}</span>
                  {" · "}
                  {formatSize(s.sizeBytes)}
                  {"· 添加于"}
                  {relativeDate(s.addedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                {isPending ? (
                  <>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                      待处理
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void onRetry(s)}
                      disabled={busyId !== null}
                    >
                      {isBusy ? "重试中…" : "重试"}
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {s.pageCount} 个知识页
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void onDelete(s)}
                  disabled={busyId !== null}
                  title="移出列表，原始文件会移入可恢复的回收目录。"
                >
                  {isBusy && !isPending ? "移除中…" : "删除"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
