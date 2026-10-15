"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { uiLabel } from "@/lib/ui-text";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import { useTheme } from "@/components/theme-provider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Discriminated action type. Each kind has its own activation behavior:
//  - navigate       → router.push(href)
//  - switch-wiki    → POST /api/wikis switch + router.refresh()
//  - switch-then-open → POST switch THEN router.push to the page (cross-wiki nav)
//  - toggle-theme   → cycle light → dark → auto → light
//  - copy-text      → navigator.clipboard.writeText(value)
type Action =
  | {
      type: "navigate";
      id: string;
      label: string;
      hint?: string;
      group: "知识页" | "AI 对话" | "功能导航" | "知识库管理" | "工作台" | "其他知识库的页面";
      href: string;
    }
  | {
      type: "switch-wiki";
      id: string;
      label: string;
      hint?: string;
      group: "知识库管理";
      path: string;
    }
  | {
      type: "switch-then-open";
      id: string;
      label: string;
      hint?: string;
      group: "其他知识库的页面";
      wikiPath: string;
      pageSlug: string;
    }
  | {
      type: "toggle-theme";
      id: string;
      label: string;
      hint?: string;
      group: "工作台";
    }
  | {
      type: "copy-text";
      id: string;
      label: string;
      hint?: string;
      group: "工作台";
      value: string;
    };

const STATIC_NAV_ACTIONS: Action[] = [
  { type: "navigate", id: "go-wiki", label: "知识库", hint: "浏览知识页", group: "功能导航", href: "/wiki" },
  { type: "navigate", id: "go-graph", label: "知识图谱", hint: "探索知识关联", group: "功能导航", href: "/graph" },
  { type: "navigate", id: "go-sources", label: "资料管理", hint: "添加资料", group: "功能导航", href: "/sources" },
  { type: "navigate", id: "go-query", label: "知识问答", hint: "提出问题", group: "功能导航", href: "/query" },
  { type: "navigate", id: "go-chats", label: "AI 对话", hint: "开始或继续对话", group: "功能导航", href: "/chats" },
  { type: "navigate", id: "go-lint", label: "知识检查", hint: "检查知识质量", group: "功能导航", href: "/lint" },
  { type: "navigate", id: "go-log", label: "活动记录", hint: "查看活动记录", group: "功能导航", href: "/log" },
  { type: "navigate", id: "go-dashboard", label: "知识库概览", hint: "知识库统计与已知费用", group: "功能导航", href: "/dashboard" },
  { type: "navigate", id: "go-schema", label: "知识规范", hint: "编辑知识整理规则", group: "功能导航", href: "/schema" },
  { type: "navigate", id: "go-settings", label: "设置", hint: "模型、主题与 API 配置", group: "功能导航", href: "/settings" },
  { type: "navigate", id: "manage-wikis", label: "管理知识库…", hint: "创建、切换与管理知识库", group: "知识库管理", href: "/settings?tab=wikis" },
];

type PageItem = { slug: string; title: string };
type ChatItem = { id: string; title: string; folder: string };
type WikiItem = { path: string; topic: string | null; active: boolean };
type CrossWikiPageItem = {
  wikiPath: string;
  wikiTopic: string | null;
  isActive: boolean;
  slug: string;
  title: string;
};

export function CommandPalette() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<PageItem[]>([]);
  const [activeWikiPath, setActiveWikiPath] = useState<string | null>(null);
  const [crossWikiPages, setCrossWikiPages] = useState<CrossWikiPageItem[]>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [wikis, setWikis] = useState<WikiItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef, () => setOpen(false));
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("llm-wiki:open-search", show);
    return () => window.removeEventListener("llm-wiki:open-search", show);
  }, []);

  // Global keyboard handler: Cmd/Ctrl+K toggles, Cmd/Ctrl+, opens Settings.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (cmd && e.key === ",") {
        e.preventDefault();
        setOpen(false);
        router.push("/settings");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // Fetch on open. Cached for the rest of the session via the closure.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    void (async () => {
      try {
        const [pagesRes, chatsRes, wikisRes, crossPagesRes] = await Promise.all([
          fetch("/api/pages", { cache: "no-store" }),
          fetch("/api/chats", { cache: "no-store" }),
          fetch("/api/wikis", { cache: "no-store" }),
          fetch("/api/wikis/pages", { cache: "no-store" }),
        ]);
        if (pagesRes.ok) {
          const data = (await pagesRes.json()) as { pages: PageItem[] };
          setPages(data.pages.map((p) => ({ slug: p.slug, title: p.title })));
        }
        if (chatsRes.ok) {
          const data = (await chatsRes.json()) as { chats: ChatItem[] };
          setChats(
            data.chats.map((c) => ({ id: c.id, title: c.title, folder: c.folder })),
          );
        }
        if (wikisRes.ok) {
          const data = (await wikisRes.json()) as {
            active: { path: string };
            recents: Array<{ path: string; topic: string | null; exists: boolean }>;
          };
          setActiveWikiPath(data.active.path);
          // Non-active + on-disk wikis only — switching to a missing folder
          // would error, and switching to the already-active one is a no-op.
          setWikis(
            data.recents
              .filter((w) => w.exists && w.path !== data.active.path)
              .map((w) => ({ path: w.path, topic: w.topic, active: false })),
          );
        }
        if (crossPagesRes.ok) {
          const data = (await crossPagesRes.json()) as {
            pages: CrossWikiPageItem[];
          };
          // Drop active-wiki pages — they're already in the "知识页" group
          // above; including them again would just duplicate every active
          // page under "其他知识库的页面" too.
          setCrossWikiPages(data.pages.filter((p) => !p.isActive));
        }
      } catch {
        // ignore — input still works against the actions list
      }
      // Focus after data fetch so it doesn't steal focus from typing the user
      // started before we mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    })();
  }, [open]);

  const items = useMemo<Action[]>(() => {
    const pageActions: Action[] = pages.map((p) => ({
      type: "navigate",
      id: `page-${p.slug}`,
      label: p.title,
      hint: p.slug,
      group: "知识页",
      href: `/wiki/${p.slug}`,
    }));
    const chatActions: Action[] = chats.map((c) => ({
      type: "navigate",
      id: `chat-${c.id}`,
      label: uiLabel(c.title),
      hint: uiLabel(c.folder),
      group: "AI 对话",
      href: `/chats/${c.id}`,
    }));
    const wikiActions: Action[] = wikis.map((w) => ({
      type: "switch-wiki",
      id: `wiki-${w.path}`,
      label: `切换知识库${w.topic ?? w.path.split("/").pop() ?? w.path}`,
      hint: w.path,
      group: "知识库管理",
      path: w.path,
    }));
    const crossPageActions: Action[] = crossWikiPages.map((p) => ({
      type: "switch-then-open",
      id: `cross-${p.wikiPath}-${p.slug}`,
      label: p.title,
      hint: `${p.wikiTopic ?? p.wikiPath.split("/").pop()} → ${p.slug}`,
      group: "其他知识库的页面",
      wikiPath: p.wikiPath,
      pageSlug: p.slug,
    }));
    const appActions: Action[] = [
      {
        type: "toggle-theme",
        id: "toggle-theme",
        label: `切换主题（当前：${uiLabel(theme)}）`,
        hint: "浅色 → 深色 → 跟随系统",
        group: "工作台",
      },
      ...(activeWikiPath
        ? [
            {
              type: "copy-text" as const,
              id: "copy-wiki-path",
              label: "复制当前知识库路径",
              hint: activeWikiPath,
              group: "工作台" as const,
              value: activeWikiPath,
            },
          ]
        : []),
    ];
    const combined = [
      ...STATIC_NAV_ACTIONS,
      ...appActions,
      ...wikiActions,
      ...pageActions,
      ...chatActions,
      ...crossPageActions,
    ];
    const needle = query.trim().toLowerCase();
    if (!needle) return combined;
    return combined.filter(
      (a) =>
        a.label.toLowerCase().includes(needle) ||
        (a.hint?.toLowerCase().includes(needle) ?? false),
    );
  }, [pages, chats, query, activeWikiPath, crossWikiPages, theme, wikis]);

  const grouped = useMemo(() => {
    const map = new Map<Action["group"], Action[]>();
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [items]);

  const flatItems = items; // for index-based navigation

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  async function activate(item: Action) {
    if (item.type === "navigate") {
      close();
      router.push(item.href);
      return;
    }
    if (item.type === "toggle-theme") {
      const next = theme === "light" ? "dark" : theme === "dark" ? "auto" : "light";
      setTheme(next);
      close();
      return;
    }
    if (item.type === "copy-text") {
      try {
        await navigator.clipboard.writeText(item.value);
      } catch {
        // Clipboard API blocked (rare in localhost dev). Fall back: silently
        // close — the next user attempt is one keystroke away.
      }
      close();
      return;
    }
    if (item.type === "switch-then-open") {
      // Cross-wiki nav: switch the active wiki, THEN navigate to the page
      // in that wiki. router.push handles the navigate; the switch updates
      // server-side state so the destination route sees the right wiki.
      setBusy(true);
      try {
        const res = await fetch("/api/wikis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "switch", path: item.wikiPath }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          // eslint-disable-next-line no-alert
          alert(j.error ?? `切换失败（HTTP ${res.status}）`);
          return;
        }
        close();
        router.push(`/wiki/${item.pageSlug}`);
      } finally {
        setBusy(false);
      }
      return;
    }
    // Switch-wiki: POST then refresh the current route so the user stays
    // on the same page but sees the new wiki's data.
    setBusy(true);
    try {
      const res = await fetch("/api/wikis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "switch", path: item.path }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        // eslint-disable-next-line no-alert
        alert(j.error ?? `切换失败（HTTP ${res.status})`);
        return;
      }
      close();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, flatItems.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = flatItems[activeIndex];
      if (pick) void activate(pick);
    }
  }

  // Keep the active item in view as the user arrows down.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="全局搜索"
        className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border p-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="搜索知识页、对话或功能…"
            className="h-10 border-0 bg-transparent text-base focus-visible:ring-0"
          />
        </div>
        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {flatItems.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              没有找到匹配结果。
            </li>
          ) : (
            Array.from(grouped.entries()).map(([group, list]) => (
              <li key={group}>
                <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </div>
                <ul>
                  {list.map((item) => {
                    const idx = runningIndex++;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-idx={idx}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => void activate(item)}
                          disabled={busy}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm disabled:opacity-50",
                            activeIndex === idx ? "bg-accent" : "hover:bg-accent/60",
                          )}
                        >
                          <span className="truncate">{item.label}</span>
                          {item.hint ? (
                            <span className="shrink-0 truncate text-xs text-muted-foreground">
                              {item.hint}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          ↑↓ 选择 · Enter 打开 · Esc 关闭 · Ctrl / ⌘ + K 搜索
        </div>
      </div>
    </div>
  );
}
