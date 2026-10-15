"use client";

import Link from "next/link";
import { uiError } from "@/lib/ui-text";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PageSummary = {
  slug: string;
  title: string;
  type: string;
  updated_at: string;
};

const TYPE_ORDER = ["overview", "concept", "entity", "comparison", "source"];
const TYPE_LABEL: Record<string, string> = {
  overview: "综述",
  concept: "概念",
  entity: "实体",
  comparison: "比较",
  source: "资料管理",
};

export function WikiSidebar() {
  const [pages, setPages] = useState<PageSummary[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        const res = await fetch("/api/pages", { cache: "no-store" });
        if (!res.ok) throw new Error(`/api/pages returned ${res.status}`);
        const data = (await res.json()) as { pages: PageSummary[] };
        if (!cancelled) setPages(data.pages);
      } catch (err) {
        if (!cancelled) setError(uiError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const grouped = useMemo(() => {
    if (!pages) return null;
    const needle = filter.trim().toLowerCase();
    const filtered = needle
      ? pages.filter(
          (p) => p.slug.includes(needle) || p.title.toLowerCase().includes(needle),
        )
      : pages;
    const byType = new Map<string, PageSummary[]>();
    for (const p of filtered) {
      const list = byType.get(p.type) ?? [];
      list.push(p);
      byType.set(p.type, list);
    }
    for (const list of byType.values()) list.sort((a, b) => a.title.localeCompare(b.title));
    return byType;
  }, [pages, filter]);

  const activeSlug = pathname.startsWith("/wiki/") ? pathname.slice("/wiki/".length) : null;
  const isIndex = pathname === "/wiki";

  return (
    <aside className="flex w-[228px] shrink-0 flex-col self-stretch border-r border-border bg-secondary">
      <div className="px-4 pb-2 pt-4">
        <Input
          type="search"
          placeholder="搜索知识页…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 border-border/70 bg-background/60 text-ui"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 text-ui">
        <Link
          href="/wiki"
          className={cn(
            "mx-2 mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 font-medium",
            isIndex ? "bg-primary/10 text-foreground" : "text-foreground/70 hover:bg-accent/60",
          )}
        >
          <span className="font-mono text-xs text-primary">¶</span>
          知识目录
        </Link>

        {error ? (
          <p className="px-3 text-caption text-destructive">{error}</p>
        ) : null}
        {!pages && !error ? (
          <p className="px-3 text-caption text-muted-foreground">加载中…</p>
        ) : null}
        {pages && pages.length === 0 ? (
          <div className="mx-2 mt-2 rounded-md border border-dashed border-border/70 bg-background/40 px-3 py-3 text-caption text-muted-foreground">
            还没有知识页，前往{" "}
            <Link href="/sources" className="text-foreground underline underline-offset-2">
              资料管理
            </Link>{" "}
            添加第一份资料。
          </div>
        ) : null}
        {pages && pages.length > 0 && grouped?.size === 0 ? <div className="px-3 py-4 text-sm text-muted-foreground"><p>没有找到匹配的知识页。</p><button type="button" onClick={() => setFilter("")} className="mt-2 text-primary hover:underline">清空搜索</button></div> : null}

        {grouped
          ? TYPE_ORDER.filter((t) => grouped.has(t)).map((type) => {
              const items = grouped.get(type)!;
              return (
                <section key={type} className="mb-3">
                  <h3 className="mt-3 px-3 pb-1 text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                    {TYPE_LABEL[type] ?? type}
                  </h3>
                  <ul>
                    {items.map((p) => (
                      <li key={p.slug}>
                        <Link
                          href={`/wiki/${p.slug}`}
                          className={cn(
                            "mx-2 block truncate rounded-md px-2 py-1",
                            activeSlug === p.slug
                              ? "bg-primary/10 text-foreground"
                              : "text-foreground/70 hover:bg-accent/60",
                          )}
                          title={p.title}
                        >
                          {p.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          : null}
      </nav>
    </aside>
  );
}
