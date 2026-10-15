import Link from "next/link";

import {
  getBailianApiKey,
  getTotalCostCents,
  getTotalCostCny,
  listChatRows,
  listPageRows,
  listSourceRows,
  loadGlobalConfig,
} from "@llm-wiki/core";

import { Onboarding } from "@/components/onboarding";
import { openWikiContext, resolveWikiPath } from "@/lib/server-wiki";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { needsKey?: string };
}) {
  const ctx = await openWikiContext();
  let pageCount = 0;
  let sourceCount = 0;
  let chatCount = 0;
  let costCents = 0;
  let costCny = 0;
  const topic = ctx.settings.topic;
  try {
    pageCount = listPageRows(ctx.db).length;
    sourceCount = listSourceRows(ctx.db).length;
    chatCount = listChatRows(ctx.db).length;
    costCents = getTotalCostCents(ctx.db);
    costCny = getTotalCostCny(ctx.db);
  } finally {
    ctx.db.close();
  }
  const wikiPath = resolveWikiPath();

  // First-run gate (docs/04 P0 #1). Block the dashboard until the user has
  // (a) named the wiki's topic so the LLM has scope and (b) configured an
  // OpenRouter key so any operation can actually run. Both are saved to the
  // user's own machine, no remote round-trip.
  //
  // The wizard mode (isFirstRun) vs minimal mode is decided by whether the
  // user has ever completed the welcome flow before — tracked in the global
  // config. First-ever app open gets the 4-step Welcome → Topic → Key →
  // Tour. Returning users who somehow ended up here again (new wiki without
  // a topic, key removed) get the compact single-card form.
  const [apiKeyStatus, globalCfg] = await Promise.all([
    getBailianApiKey(),
    loadGlobalConfig(),
  ]);
  const needsTopic = topic.trim().length === 0;
  const needsKey = !apiKeyStatus.key || searchParams.needsKey === "1";
  // `onboardingCompletedAt` absent means either (a) brand-new install or
  // (b) the user just clicked Settings → About → "Replay welcome tour",
  // which clears the flag. In both cases we want the 4-step wizard, even
  // when topic+key are already saved — the wizard becomes a pure walkthrough
  // and the KeyStep allows blank advance via `alreadyHasKey` downstream.
  const isFirstRun = !globalCfg.onboardingCompletedAt;
  if (needsTopic || needsKey || isFirstRun) {
    return (
      <Onboarding
        needsTopic={needsTopic}
        needsKey={needsKey}
        initialTopic={topic}
        wikiPath={wikiPath}
        isFirstRun={isFirstRun}
      />
    );
  }

  const isFresh = pageCount === 0 && sourceCount === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-12 pt-10 sm:px-8">
      <header className="mb-10">
        <p className="text-caption uppercase tracking-wider text-muted-foreground">
          {isFresh ? "欢迎回来" : "我的知识空间"}
        </p>
        <h1 className="mt-2 font-display text-display font-semibold">
          {isFresh ? "让零散资料，成为自己的知识体系。" : "我的知识工作台"}
        </h1>
        <p className="mt-3 max-w-2xl text-body text-muted-foreground">
          {isFresh
            ? "从一篇文章、一份笔记或一个链接开始。让 AI 整理观点、建立关联，沉淀为可阅读、可追溯的知识页。"
            : "收集资料、关联知识，在持续整理中形成自己的理解。"}
        </p>
        <p className="mt-2 font-mono text-caption text-muted-foreground">
          {wikiPath}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="知识页" value={pageCount.toString()} href="/wiki" />
        <StatTile label="资料管理" value={sourceCount.toString()} href="/sources" />
        <StatTile label="AI 对话" value={chatCount.toString()} href="/chats" />
        {/* LLM spend tile points at /dashboard, not /settings — dashboard
            shows this wiki's spend in context with every other wiki's, plus
            a cumulative roll-up. Settings → Models still has the per-model
            breakdown table for a deeper view. */}
        <StatTile label="美元预估" value={formatCostCents(costCents)} href="/dashboard" />
        <StatTile label="人民币预估" value={formatCostCny(costCny)} href="/dashboard" />
      </section>
      <p className="mt-2 text-right text-caption text-muted-foreground">
        金额为已知费率预估；未知模型或地域不计入。{" "}
        <Link
          href="/dashboard"
          className="hover:text-foreground"
          title="查看所有知识库的概览"
        >
          查看知识库概览 →
        </Link>
      </p>

      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          tone="primary"
          title={isFresh ? "添加第一份资料" : "添加资料"}
          body="上传文档、粘贴笔记或导入网页，生成相互关联的知识草稿。"
          cta="添加资料 →"
          href="/sources"
        />
        <ActionCard
          title="向知识库提问"
          body="围绕已有知识提问，查看引用来源，将有价值的回答保存为知识页。"
          cta="开始提问 →"
          href="/query"
        />
        <ActionCard
          title="阅读知识库"
          body={
            pageCount === 0
              ? "知识库还是空的，先添加一份资料。"
              : `已有 ${pageCount} 篇知识页，涵盖概念、实体与主题综述。`
          }
          cta={pageCount === 0 ? "先添加资料 →" : "浏览知识页 →"}
          href={pageCount === 0 ? "/sources" : "/wiki"}
        />
        <ActionCard
          title="检查知识质量"
          body={
            pageCount === 0
              ? "添加并整理资料后，即可检查知识页的质量。"
              : "发现内容矛盾、失效链接和知识缺口，持续完善知识体系。"
          }
          cta={pageCount === 0 ? "先添加资料 →" : "开始检查 →"}
          href={pageCount === 0 ? "/sources" : "/lint"}
        />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
        <MetaCard
          title="知识如何积累"
          items={[
            "保留原始资料，用知识规范指导 AI 整理出相互关联的知识页。",
            "通过资料整理、知识问答和质量检查，持续完善内容。",
            "知识以 Markdown 文件保存在本机，也可以用其他编辑器阅读和修改。",
          ]}
        />
        <MetaCard
          title="常用快捷键"
          items={[
            { kbd: "Ctrl / ⌘ + K", text: "全局搜索与快速跳转" },
            { kbd: "Ctrl / ⌘ + ,", text: "设置" },
            { kbd: "Ctrl / ⌘ + Enter", text: "提交问题或发送消息" },
            { kbd: "esc", text: "关闭对话框" },
          ]}
        />
      </section>
    </div>
  );
}

// ---- bits ---------------------------------------------------------------

function StatTile({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border/70 bg-card px-4 py-3 transition-all duration-100 hover:border-primary/40 hover:bg-accent/40 active:scale-[0.99]"
    >
      <p className="text-caption uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-h2 font-semibold tabular-nums">{value}</p>
    </Link>
  );
}

function ActionCard({
  tone = "default",
  title,
  body,
  cta,
  href,
}: {
  tone?: "default" | "primary";
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  const primary = tone === "primary";
  return (
    <Link
      href={href}
      className={
        "group flex flex-col rounded-lg border p-5 transition-all duration-100 active:scale-[0.99] " +
        (primary
          ? "border-primary/40 bg-primary/[0.04] hover:border-primary/60 hover:bg-primary/[0.07]"
          : "border-border/70 bg-card hover:border-border")
      }
    >
      <h2 className="font-display text-h3 font-semibold">{title}</h2>
      <p className="mt-2 flex-1 text-ui text-muted-foreground">{body}</p>
      <p
        className={
          "mt-4 text-ui font-medium " +
          (primary ? "text-primary" : "text-foreground/80 group-hover:text-foreground")
        }
      >
        {cta}
      </p>
    </Link>
  );
}

type MetaItem = string | { kbd: string; text: string };

function MetaCard({ title, items }: { title: string; items: MetaItem[] }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-5">
      <h2 className="font-display text-h3 font-semibold">{title}</h2>
      <ul className="mt-3 space-y-1.5 text-ui text-muted-foreground">
        {items.map((it, i) =>
          typeof it === "string" ? (
            <li key={i} className="leading-relaxed">
              · {it}
            </li>
          ) : (
            <li key={i} className="flex items-center gap-2.5">
              {/* sans font (Inter) so ⌘/↵/esc glyphs render correctly at
                  small sizes; mono fonts often miss or mis-baseline them. */}
              <kbd className="inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-md border border-border bg-muted px-2 font-sans text-[12px] font-medium leading-none text-foreground/80">
                {it.kbd}
              </kbd>
              <span>{it.text}</span>
            </li>
          ),
        )}
      </ul>
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
