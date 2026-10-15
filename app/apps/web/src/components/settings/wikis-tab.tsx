"use client";

import { useRouter } from "next/navigation";
import { uiError } from "@/lib/ui-text";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Client-safe mirror of the SCHEMA_TEMPLATES metadata in
// packages/core/src/templates.ts. Importing the value from @llm-wiki/core
// here pulls the whole barrel — including secrets.ts → keytar (a Node-only
// native module) → webpack bundle error. The server-side route at
// /api/wikis (handleCreate) still imports the real SCHEMA_TEMPLATES from
// core to look up the body by id; we just need the id/label/description
// triple on the client for the dropdown. Keep this list in sync if you
// add/rename templates over there.
type SchemaTemplateId =
  | "blank"
  | "research"
  | "legal"
  | "clinical"
  | "project"
  | "personal";

type SchemaTemplateMeta = {
  id: SchemaTemplateId;
  label: string;
  description: string;
};

const SCHEMA_TEMPLATES: ReadonlyArray<SchemaTemplateMeta> = [
  {
    id: "blank",
    label: "空白模板",
    description:
      "通用写作与整理规则，之后可在知识规范中修改。",
  },
  {
    id: "research",
    label: "学术研究",
    description:
      "学术风格，强调来源、专业术语与待研究问题。",
  },
  {
    id: "legal",
    label: "法律资料",
    description:
      "强调准确引用、观点区分与失效依据提示。",
  },
  {
    id: "clinical",
    label: "临床资料",
    description:
      "强调证据层级、指南时效与剂量单位准确性。",
  },
  {
    id: "project",
    label: "项目实践",
    description:
      "面向决策与复盘，记录时间、权衡和失败经验。",
  },
  {
    id: "personal",
    label: "个人知识库",
    description:
      "适合探索学习，保留来源与未解决问题。",
  },
];

type WikiDetail = {
  path: string;
  topic: string | null;
  exists: boolean;
};

type ListResponse = {
  active: WikiDetail;
  recents: WikiDetail[];
};

// Suggests a default folder path from a topic. Matches the convention
// `~/llm-wiki-<slug>` so users have a sensible starting point without
// having to type a full path.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function suggestedPath(topic: string): string {
  const slug = slugify(topic);
  if (!slug) return "~/llm-wiki-untitled";
  return `~/llm-wiki-${slug}`;
}

export function WikisTab() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newTemplate, setNewTemplate] = useState<SchemaTemplateId>("blank");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/wikis", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ListResponse;
      setData(json);
    } catch (err) {
      setError(uiError(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function doAction(
    label: string,
    body: object,
    successFlash: string,
  ): Promise<boolean> {
    setBusyAction(label);
    setError(null);
    setFlash(null);
    try {
      const res = await fetch("/api/wikis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setFlash(successFlash);
      await refresh();
      // Re-render every server component so the new active wiki is read
      // throughout the app, not just by this tab.
      router.refresh();
      return true;
    } catch (err) {
      setError(uiError(err));
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function onSwitch(path: string) {
    await doAction(`switch:${path}`, { type: "switch", path }, `已切换到${path}`);
  }

  async function onRemove(path: string, isActive: boolean) {
    const msg = isActive
      ? "将此知识库移出列表并切换回默认库？本机文件仍然保留。"
      : "将此知识库移出列表？本机文件仍然保留。";
    if (!confirm(msg)) return;
    await doAction(`remove:${path}`, { type: "remove", path }, "已移出知识库列表");
  }

  async function onCreate() {
    const topic = newTopic.trim();
    const path = newPath.trim() || suggestedPath(topic);
    if (!topic) {
      setError("请填写知识库主题。");
      return;
    }
    const ok = await doAction(
      "create",
      { type: "create", path, topic, templateId: newTemplate },
      `已创建知识库：${path}${newTemplate !== "blank" ? `，使用“${newTemplate}”模板` : ""}`,
    );
    if (ok) {
      setNewTopic("");
      setNewPath("");
      setNewTemplate("blank");
      setCreateOpen(false);
    }
  }

  if (data === null && !error) {
    return <p className="text-sm text-muted-foreground">正在加载知识库…</p>;
  }

  if (error && data === null) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        无法加载知识库： {error}
      </p>
    );
  }

  const active = data?.active;
  const rows = data?.recents ?? [];
  const activeIsInRecents = active ? rows.some((r) => r.path === active.path) : false;

  // Stale entries left over from prior testing or removed-from-disk wikis.
  // Surface a single bulk-cleanup affordance so users don't have to click
  // Remove on each one.
  const missing = rows.filter((r) => !r.exists);

  async function onCleanMissing() {
    if (missing.length === 0) return;
    if (
      !confirm(
        `将 ${missing.length} 条无效知识库记录移出列表？本机资料不会被删除。`,
      )
    )
      return;
    setBusyAction("clean-missing");
    setError(null);
    setFlash(null);
    try {
      // Sequential — small N + we want each remove to see the prior's
      // updated config, since removing the currently-active wiki resets it.
      for (const m of missing) {
        const res = await fetch("/api/wikis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "remove", path: m.path }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
      }
      setFlash(`已清理 ${missing.length} 条无效记录。`);
      await refresh();
      router.refresh();
    } catch (err) {
      setError(uiError(err));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">知识库管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            用不同知识库管理不同主题。整个工作台始终读取当前选中的知识库，切换后无需重启。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <a
            href="/dashboard"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-primary/40 hover:bg-accent"
            title="查看各知识库的内容数量、已知费用与最近更新时间。"
          >
            查看知识库概览 →
          </a>
          {active?.exists ? (
            <a
              href="/api/wikis/export"
              download
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-primary/40 hover:bg-accent"
              title="将当前知识库的资料、知识页、对话与规范导出为 ZIP；不包含工具元数据。"
            >
              导出当前知识库
            </a>
          ) : null}
        </div>
      </div>

      {flash ? (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {flash}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {missing.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="text-amber-800 dark:text-amber-200">
            有 {missing.length} 条记录对应的目录已不存在，可以清理无效记录。
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onCleanMissing()}
            disabled={busyAction !== null}
          >
            {busyAction === "clean-missing"
              ? "清理中…"
              : `清理 ${missing.length} 条记录`}
          </Button>
        </div>
      ) : null}

      {/* If the active wiki isn't in the recents list (typical on first run —
          the default ~/llm-wiki-default), render it as its own row. We now
          use the server-enriched detail so topic + exists are correct. */}
      {active && !activeIsInRecents ? (
        <WikiRow
          path={active.path}
          topic={active.topic}
          exists={active.exists}
          isActive={true}
          busyAction={busyAction}
          onSwitch={() => Promise.resolve()}
          onRemove={() =>
            onRemove(active.path, true)
          }
        />
      ) : null}

      <ul className="space-y-2">
        {rows.map((row) => (
          <WikiRow
            key={row.path}
            path={row.path}
            topic={row.topic}
            exists={row.exists}
            isActive={active?.path === row.path}
            busyAction={busyAction}
            onSwitch={() => onSwitch(row.path)}
            onRemove={() => onRemove(row.path, active?.path === row.path)}
          />
        ))}
      </ul>

      {/* Create form, collapsed by default. */}
      <div className="rounded-md border border-border/70 bg-muted/20 p-4">
        {!createOpen ? (
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            新建知识库
          </Button>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">创建新的知识空间</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                填写主题和本机文件夹路径。目录不存在时会自动创建。
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="new-topic">
                主题
              </label>
              <Input
                id="new-topic"
                value={newTopic}
                onChange={(e) => {
                  setNewTopic(e.target.value);
                  if (!newPath) setNewPath(suggestedPath(e.target.value));
                }}
                placeholder="例如：机器学习研究与经典论文"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="new-path">
                文件夹路径
              </label>
              <Input
                id="new-path"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder={newTopic ? suggestedPath(newTopic) : "~/llm-wiki-…"}
                className="font-mono text-[13px]"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                波浪号（<code className="font-mono">~</code>）表示当前用户目录。
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="new-template">
                知识规范模板
              </label>
              <select
                id="new-template"
                value={newTemplate}
                onChange={(e) => setNewTemplate(e.target.value as SchemaTemplateId)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SCHEMA_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {SCHEMA_TEMPLATES.find((t) => t.id === newTemplate)?.description}{" "}
                预先填入 <code className="font-mono">CLAUDE.md</code> ，之后可在知识规范中修改。
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={onCreate} disabled={!newTopic.trim() || busyAction === "create"}>
                {busyAction === "create" ? "创建中…" : "创建并切换"}
              </Button>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        切换后，工作台会读取新知识库。如页面仍显示旧内容，请刷新浏览器。
      </p>
    </div>
  );
}

function WikiRow({
  path,
  topic,
  exists,
  isActive,
  busyAction,
  onSwitch,
  onRemove,
}: {
  path: string;
  topic: string | null;
  exists: boolean;
  isActive: boolean;
  busyAction: string | null;
  onSwitch: () => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const switching = busyAction === `switch:${path}`;
  const removing = busyAction === `remove:${path}`;
  return (
    <li
      className={
        "flex flex-wrap items-baseline justify-between gap-3 rounded-md border p-3 " +
        (isActive ? "border-primary/40 bg-primary/[0.04]" : "border-border/70 bg-card")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-sm font-medium">
            {topic ?? <span className="text-muted-foreground italic">未设置主题</span>}
          </p>
          {isActive ? (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs uppercase tracking-wider text-primary">
              当前使用
            </span>
          ) : null}
          {!exists ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
              目录不存在
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
          {path}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {!isActive && exists ? (
          <Button size="sm" variant="outline" onClick={() => void onSwitch()} disabled={busyAction !== null}>
            {switching ? "切换中…" : "切换"}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => void onRemove()} disabled={busyAction !== null}>
          {removing ? "移除中…" : "移除"}
        </Button>
      </div>
    </li>
  );
}
