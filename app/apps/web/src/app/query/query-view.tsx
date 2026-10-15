"use client";

import Link from "next/link";
import { uiError, uiLabel } from "@/lib/ui-text";
import { useEffect, useState } from "react";

import { CostPreview } from "@/components/cost-preview";
import { PageContainer, PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownView } from "@/components/wiki/markdown-view";
import { useWikiSettings } from "@/lib/use-wiki-settings";
import { cn } from "@/lib/utils";

type QueryResponse = {
  answer: string;
  pagesUsed: string[];
  suggestedNewPage: null | {
    slug: string;
    title: string;
    content: string;
    reason: string;
  };
  confidence: "high" | "medium" | "low";
  caveats: string[];
};

type QuerySuccess = {
  ok: true;
  model: string;
  response: QueryResponse;
};

type QueryFailure = { ok?: false; error: string; type?: string };

const CONFIDENCE_STYLES: Record<QueryResponse["confidence"], string> = {
  high: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "bg-destructive/10 text-destructive",
};

export function QueryView() {
  const [question, setQuestion] = useState("");
  const [knownSlugs, setKnownSlugs] = useState<string[]>([]);
  const settings = useWikiSettings();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuerySuccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<{ slug: string } | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/pages", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { knownSlugs: string[] };
        setKnownSlugs(data.knownSlugs);
      } catch {
        // non-fatal — wikilinks just render conservatively
      }
    })();
  }, []);

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setResult(null);
    setError(null);
    setPromoteResult(null);
    setPromoteError(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = (await res.json()) as QuerySuccess | QueryFailure;
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        const msg = "error" in json ? json.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setResult(json);
    } catch (err) {
      setError(uiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onPromote() {
    if (!result?.response.suggestedNewPage) return;
    const s = result.response.suggestedNewPage;
    setPromoting(true);
    setPromoteError(null);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: s.slug,
          title: s.title,
          type: "concept",
          content: s.content,
        }),
      });
      const json = (await res.json()) as { ok?: true; slug?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPromoteResult({ slug: s.slug });
      setKnownSlugs((prev) => (prev.includes(s.slug) ? prev : [...prev, s.slug]));
    } catch (err) {
      setPromoteError(uiError(err));
    } finally {
      setPromoting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="从知识中找到答案"
        title="知识问答"
        description="围绕已有资料提问，回答会附带知识页引用。需要深入讨论时，可以使用 AI 对话。"
      />

      <form onSubmit={onAsk} className="space-y-3">
        <label className="block text-ui font-medium" htmlFor="question">
          你想了解什么？
        </label>
        <Textarea
          id="question"
          rows={3}
          placeholder="例如：这些资料中关于知识管理的方法有哪些共同点？"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy}
          className="font-serif text-body"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void onAsk(e as unknown as React.FormEvent);
            }
          }}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={!question.trim() || busy}>
            {busy ? "正在查找与思考…" : "发送问题"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Ctrl / ⌘ + Enter 提交 · 使用知识问答模型
          </p>
        </div>
        {settings?.settings.showCostEstimates && question.trim() ? (
          <CostPreview
            text={question}
            model={settings.settings.defaultModels.query.model}
            provider={settings.settings.defaultModels.query.provider}
            bailianBaseUrl={settings.bailianBaseUrl}
            contextOverhead={6000}
            expectedOutputTokens={600}
          />
        ) : null}
      </form>

      {error ? (
        <div className="mt-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {result ? (
        <section className="mt-10 space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium uppercase tracking-wide",
                CONFIDENCE_STYLES[result.response.confidence],
              )}
            >
              {uiLabel(result.response.confidence)} 置信度
            </span>
            <span className="text-muted-foreground">模型 {result.model}</span>
          </div>

          <article className="rounded-lg border border-border bg-card p-6 text-card-foreground">
            <MarkdownView content={result.response.answer} knownSlugs={knownSlugs} />
          </article>

          {result.response.caveats.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                需要留意
              </h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {result.response.caveats.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.response.pagesUsed.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                参考知识页
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {result.response.pagesUsed.map((slug) => (
                  <li key={slug}>
                    <Link
                      href={`/wiki/${slug}`}
                      className="rounded-full border border-border px-2 py-0.5 text-xs hover:bg-accent"
                    >
                      {slug}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.response.suggestedNewPage ? (
            <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                值得沉淀为知识页
              </h3>
              <p className="mt-2">
                <strong>{result.response.suggestedNewPage.title}</strong>{" "}
                <span className="text-xs text-muted-foreground">
                  ({result.response.suggestedNewPage.slug})
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.response.suggestedNewPage.reason}
              </p>

              {promoteResult ? (
                <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                  已保存。{" "}
                  <Link href={`/wiki/${promoteResult.slug}`} className="underline">
                    打开知识页 →
                  </Link>
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button onClick={onPromote} disabled={promoting} variant="outline">
                    {promoting ? "保存中…" : "保存为知识页"}
                  </Button>
                  {promoteError ? (
                    <span className="text-sm text-destructive">{promoteError}</span>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </PageContainer>
  );
}
