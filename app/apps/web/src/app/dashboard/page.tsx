import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import Link from "next/link";

import {
  backfillUsageCosts,
  getTotalCostCents,
  getTotalCostCny,
  listChatRows,
  listPageRows,
  listSourceRows,
  loadGlobalConfig,
  loadWikiSettings,
  openDb,
  WIKI_PATHS,
} from "@llm-wiki/core";

import { PageContainer, PageHeader } from "@/components/page-shell";
import { SwitchWikiButton } from "@/components/dashboard/switch-wiki-button";
import { requireSetup } from "@/lib/server-wiki";

export const dynamic = "force-dynamic";

type WikiHealth = {
  path: string;
  topic: string | null;
  exists: boolean;
  initialized: boolean;
  isActive: boolean;
  pageCount: number;
  sourceCount: number;
  chatCount: number;
  costCents: number;
  costCny: number;
  lastTouchedMs: number | null;
};

function defaultWikiPath(): string {
  return join(homedir(), "llm-wiki-default");
}

async function gatherHealth(path: string, isActive: boolean): Promise<WikiHealth> {
  let exists = false;
  let lastTouchedMs: number | null = null;
  try {
    const s = await stat(path);
    exists = s.isDirectory();
    lastTouchedMs = s.mtimeMs;
  } catch {
    exists = false;
  }
  if (!exists) {
    return {
      path,
      topic: null,
      exists: false,
      initialized: false,
      isActive,
      pageCount: 0,
      sourceCount: 0,
      chatCount: 0,
      costCents: 0,
      costCny: 0,
      lastTouchedMs: null,
    };
  }

  let topic: string | null = null;
  try {
    const settings = await loadWikiSettings(path);
    topic = settings.topic.trim() || null;
  } catch {
    topic = null;
  }

  // Skip DB open for wikis that exist on disk but haven't been opened by
  // the app yet — openDb() creates .llm-wiki/ as a side effect, which we
  // don't want on a read-only page.
  let initialized = false;
  try {
    await stat(join(path, WIKI_PATHS.tooling));
    initialized = true;
  } catch {
    initialized = false;
  }

  if (!initialized) {
    return {
      path,
      topic,
      exists: true,
      initialized: false,
      isActive,
      pageCount: 0,
      sourceCount: 0,
      chatCount: 0,
      costCents: 0,
      costCny: 0,
      lastTouchedMs,
    };
  }

  const db = openDb(path);
  try {
    backfillUsageCosts(db);
    return {
      path,
      topic,
      exists: true,
      initialized: true,
      isActive,
      pageCount: listPageRows(db).length,
      sourceCount: listSourceRows(db).length,
      chatCount: listChatRows(db).length,
      costCents: getTotalCostCents(db),
      costCny: getTotalCostCny(db),
      lastTouchedMs,
    };
  } finally {
    db.close();
  }
}

export default async function DashboardPage() {
  await requireSetup();

  const cfg = await loadGlobalConfig();
  const activePath = cfg.activeWiki ?? defaultWikiPath();
  const all = Array.from(new Set([activePath, ...cfg.recentWikis]));
  const wikis = await Promise.all(all.map((p) => gatherHealth(p, p === activePath)));
  wikis.sort((a, b) => (b.lastTouchedMs ?? 0) - (a.lastTouchedMs ?? 0));

  const totals = wikis.reduce(
    (acc, w) => ({
      pageCount: acc.pageCount + w.pageCount,
      sourceCount: acc.sourceCount + w.sourceCount,
      chatCount: acc.chatCount + w.chatCount,
      costCents: acc.costCents + w.costCents,
      costCny: acc.costCny + w.costCny,
    }),
    { pageCount: 0, sourceCount: 0, chatCount: 0, costCents: 0, costCny: 0 },
  );

  return (
    <PageContainer width="xl">
      <PageHeader
        eyebrow="所有知识空间"
        title="知识库概览"
        description="查看各知识库的内容、资料与对话数量，以及美元和人民币费用预估。未知模型或地域不计入金额。"
      />

      {/* Roll-up across every wiki. Useful for the "how much have I actually
          spent on this app" question that doesn't have a clean answer when
          each wiki tracks cost independently. */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <RollupTile label="知识库数量" value={wikis.length.toString()} />
        <RollupTile label="知识页总数" value={totals.pageCount.toString()} />
        <RollupTile label="资料总数" value={totals.sourceCount.toString()} />
        <RollupTile label="美元预估" value={formatCostCents(totals.costCents)} />
        <RollupTile label="人民币预估" value={formatCostCny(totals.costCny)} />
      </section>

      <ul className="space-y-3">
        {wikis.map((w) => (
          <li key={w.path}>
            <WikiCard wiki={w} />
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}

function WikiCard({ wiki }: { wiki: WikiHealth }) {
  const title = wiki.topic ?? "（未设置主题）";

  return (
    <article
      className={
        "rounded-lg border bg-card p-5 transition-colors " +
        (wiki.isActive
          ? "border-primary/40 bg-primary/[0.04]"
          : "border-border/70 hover:border-border")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-display text-h3 font-semibold">{title}</h2>
            {wiki.isActive ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
                当前使用
              </span>
            ) : null}
            {!wiki.exists ? (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-destructive">
                目录不存在
              </span>
            ) : !wiki.initialized ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                尚未初始化
              </span>
            ) : null}
          </div>
          <p className="mt-1 break-all font-mono text-caption text-muted-foreground">{wiki.path}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {wiki.exists && wiki.isActive ? (
            <Link
              href="/"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-primary/40 hover:bg-accent"
            >
              打开 →
            </Link>
          ) : wiki.exists ? (
            <SwitchWikiButton path={wiki.path} />
          ) : null}
        </div>
      </div>

      {wiki.initialized ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Stat label="知识页" value={wiki.pageCount.toString()} />
          <Stat label="资料管理" value={wiki.sourceCount.toString()} />
          <Stat label="AI 对话" value={wiki.chatCount.toString()} />
          <Stat label="美元预估" value={formatCostCents(wiki.costCents)} />
          <Stat label="人民币预估" value={formatCostCny(wiki.costCny)} />
          <Stat label="最近更新" value={formatRelative(wiki.lastTouchedMs)} />
        </dl>
      ) : wiki.exists ? (
        <p className="mt-4 text-ui text-muted-foreground">
          目录已存在，切换到该知识库后即可开始使用。
        </p>
      ) : (
        <p className="mt-4 text-ui text-muted-foreground">
          找不到该知识库的目录，请前往{" "}
          <Link href="/settings?tab=wikis" className="text-primary underline underline-offset-2">
            设置 → 知识库管理
          </Link>{" "}
          整理最近使用列表。
        </p>
      )}
    </article>
  );
}

function RollupTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-4 py-3">
      <p className="text-caption uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-h2 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-h3 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function formatCostCents(cents: number): string {
  const dollars = cents / 100;
  return `~$${dollars.toFixed(dollars < 1 ? 4 : dollars < 100 ? 3 : 2)}`;
}

function formatCostCny(yuan: number): string {
  return `~¥${yuan.toFixed(yuan < 1 ? 4 : 2)}`;
}

function formatRelative(ms: number | null): string {
  if (ms === null) return "—";
  const diffMs = Date.now() - ms;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "刚刚";
  if (diffMs < hour) return `${Math.round(diffMs / minute)}分钟前`;
  if (diffMs < day) return `${Math.round(diffMs / hour)}小时前`;
  if (diffMs < 30 * day) return `${Math.round(diffMs / day)}天前`;
  return new Date(ms).toISOString().slice(0, 10);
}
