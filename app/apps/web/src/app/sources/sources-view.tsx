"use client";

import Link from "next/link";
import { uiError, uiLabel } from "@/lib/ui-text";
import { useCallback, useRef, useState } from "react";

import { CostPreview } from "@/components/cost-preview";
import { Card, PageContainer, PageHeader } from "@/components/page-shell";
import { SourcesList } from "@/components/sources/sources-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWikiSettings } from "@/lib/use-wiki-settings";
import { cn } from "@/lib/utils";

type Mode = "paste" | "file" | "url";

type IngestSuccess = {
  ok: true;
  /** "applied" = wiki changes already written. "preview" = approval pending. */
  kind: "applied" | "preview";
  wikiPath: string;
  sourceId: string;
  rawFilename: string;
  model: string;
  response: {
    summary: string;
    newPages: Array<{ slug: string; title: string; type: string }>;
    pageUpdates: Array<{ slug: string; updateReason: string }>;
    contradictions: Array<{ description: string; pages: string[] }>;
  };
  /** Full IngestResponse for re-send to /api/ingest/apply when kind=preview. */
  fullResponse: unknown | null;
};

type IngestResult = IngestSuccess | { ok: false; error: string; type?: string } | { error: string };

const ACCEPTED_EXTENSIONS = ".md,.markdown,.txt,.html,.htm,.pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp";

export function SourcesView() {
  const [mode, setMode] = useState<Mode>("paste");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyBusy, setApplyBusy] = useState(false);
  const [discardBusy, setDiscardBusy] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onApplyPreview() {
    if (!result || result.kind !== "preview") return;
    setApplyBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ingest/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceId: result.sourceId,
          response: result.fullResponse,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      // Flip the local result to applied so the preview UI clears.
      setResult({ ...result, kind: "applied" });
      setRefreshNonce((n) => n + 1);
    } catch (err) {
      setError(uiError(err));
    } finally {
      setApplyBusy(false);
    }
  }

  async function onDiscardPreview() {
    if (!result || result.kind !== "preview") return;
    if (
      !confirm(
        "放弃本次知识草稿？原始资料将移入回收目录，并从待处理列表移除，可在 30 天内恢复。",
      )
    )
      return;
    setDiscardBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sources/${result.sourceId}/delete`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setResult(null);
      setRefreshNonce((n) => n + 1);
    } catch (err) {
      setError(uiError(err));
    } finally {
      setDiscardBusy(false);
    }
  }

  const canSubmit =
    !busy &&
    ((mode === "paste" && text.trim().length > 0) ||
      (mode === "url" && url.trim().length > 0) ||
      (mode === "file" && file !== null));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setResult(null);
    setError(null);

    try {
      let res: Response;
      if (mode === "file" && file) {
        const form = new FormData();
        form.append("file", file);
        if (title.trim()) form.append("title", title.trim());
        res = await fetch("/api/ingest", { method: "POST", body: form });
      } else {
        const body: Record<string, string> = {};
        if (mode === "paste") body["text"] = text;
        if (mode === "url") body["url"] = url.trim();
        if (title.trim()) body["title"] = title.trim();
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const json = (await res.json()) as IngestResult & { providerUsed?: string; modelUsed?: string };
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        const msg = "error" in json ? json.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }


      setResult(json);
      // Don't clear file/url so the user can see what they ingested.
      setText("");
      setTitle("");
      // Re-fetch the sources list above so the new ingest shows up immediately.
      setRefreshNonce((n) => n + 1);
    } catch (err) {

      setError(uiError(err));
    } finally {
      setBusy(false);
    }
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setMode("file");
    }
  }, []);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="将资料沉淀为知识"
        title="资料管理"
        description="支持粘贴文本、导入网页或上传文件。AI 会生成知识草稿，经你确认后应用。PDF 是否可直接处理取决于所选提供商。"
      />

      <ol aria-label="资料整理流程" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {["选择资料", "生成草稿", "审核内容", "确认应用"].map((label, index) => {
          const current = result?.kind === "applied" ? 3 : result?.kind === "preview" ? 2 : busy ? 1 : 0;
          return <li key={label} aria-current={index === current ? "step" : undefined} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", index === current ? "border-primary/30 bg-primary/5 font-medium text-primary" : "border-border/60 text-muted-foreground")}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{index + 1}</span>{label}</li>;
        })}
      </ol>
      <section className="mb-8 rounded-lg border border-border/70 bg-card p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-h3 font-semibold">已有资料</h2>
          <p className="text-caption text-muted-foreground">
            原始文件保存在 <code className="font-mono">raw/</code>
          </p>
        </div>
        <SourcesList refreshNonce={refreshNonce} />
      </section>

      <section
        className={cn(
          "rounded-lg border bg-card p-5 text-card-foreground transition-colors",
          dragOver ? "border-primary ring-2 ring-primary/30" : "border-border/70",
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={onDrop}
      >
        <div className="inline-flex rounded-md border border-border/70 bg-secondary/40 p-1 text-ui">
          {(["paste", "file", "url"] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded px-3 py-1 capitalize",
                mode === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {uiLabel(m)}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="title">
              资料标题（可选）
            </label>
            <Input
              id="title"
              type="text"
              placeholder="留空时使用首行文字、网页标题或文件名"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          </div>

          {mode === "paste" ? (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="text">
                内容
              </label>
              <Textarea
                id="text"
                rows={14}
                placeholder="粘贴文章、论文摘录或自己的笔记…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={busy}
                className="min-h-[280px] font-mono text-[13px] leading-relaxed"
              />
            </div>
          ) : null}

          {mode === "url" ? (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="url">
                URL
              </label>
              <Input
                id="url"
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                自动提取网页正文，去除导航和广告后整理内容。
              </p>
            </div>
          ) : null}

          {mode === "file" ? (
            <div>
              <label className="mb-1 block text-sm font-medium">文件</label>
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-background px-6 py-10 text-center",
                  dragOver ? "border-primary bg-primary/5" : null,
                )}
              >
                <p className="text-sm">
                  {file ? (
                    <>
                      已选择： <strong>{file.name}</strong>{" "}
                      <span className="text-muted-foreground">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </>
                  ) : (
                    <>
                      将文件拖到这里，或{" "}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-primary underline underline-offset-2"
                      >
                        选择文件
                      </button>
                      .
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  支持 Markdown、TXT、HTML、Office 文档及图片；PDF 支持情况取决于提供商。
                </p>
                {file ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-muted-foreground underline"
                  >
                    重新选择文件
                  </button>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  className="hidden"
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    setFile(picked);
                  }}
                />
              </div>
            </div>
          ) : null}

          <CostPreviewForSources mode={mode} text={text} file={file} url={url} />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!canSubmit}>
              {busy ? "正在生成知识草稿…" : "生成知识草稿"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {mode === "file" && file && /\.(pdf|png|jpg|jpeg|webp)$/i.test(file.name)
                ? "图片或 PDF 将使用视觉模型，百炼不支持直接传入 PDF。"
                : "使用资料整理模型，所需时间取决于资料长度与模型速度。"}
            </p>
          </div>
        </form>

        {error ? <IngestErrorBanner message={error} /> : null}

        {result ? (
          <div
            className={cn(
              "mt-6 space-y-3 rounded-md px-4 py-3 text-sm",
              result.kind === "preview"
                ? "border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
            )}
          >
            <div>
              {result.kind === "preview" ? (
                <>
                  <strong>知识草稿已准备好，请先审核</strong> 人工审批已开启。以下内容尚未应用到知识页。
                </>
              ) : (
                <>
                  <strong>资料已整理。</strong> {result.response.summary}
                </>
              )}
            </div>
            {result.kind === "preview" && result.response.summary ? (
              <div className="text-xs">
                <strong>整理摘要：</strong> {result.response.summary}
              </div>
            ) : null}
            <div className="text-xs text-muted-foreground">
              原始资料已保存为 <code>raw/{result.rawFilename}</code> 模型{" "}
              <code>{result.model}</code>.
              {result.kind === "preview"
                ? "原始资料与知识草稿分开保存。放弃草稿时，原始资料会移入可恢复的回收目录。"
                : null}
            </div>

            {result.kind === "preview" ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-amber-500/30 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void onApplyPreview()}
                  disabled={applyBusy || discardBusy}
                >
                  {applyBusy ? "应用中…" : "确认并应用"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void onDiscardPreview()}
                  disabled={applyBusy || discardBusy}
                >
                  {discardBusy ? "放弃中…" : "放弃本次草稿"}
                </Button>
                <span className="text-xs text-amber-800/70 dark:text-amber-200/70">
                  确认后将新增或更新知识页、索引与活动记录。
                </span>
              </div>
            ) : null}

            {result.response.newPages.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  新增知识页
                </h3>
                <ul className="mt-1 space-y-0.5">
                  {result.response.newPages.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/wiki/${p.slug}`} className="underline underline-offset-2">
                        {p.slug}
                      </Link>{" "}
                      — {p.title}{" "}
                      <span className="text-muted-foreground">({uiLabel(p.type)})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.response.pageUpdates.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  更新知识页
                </h3>
                <ul className="mt-1 space-y-0.5">
                  {result.response.pageUpdates.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/wiki/${p.slug}`} className="underline underline-offset-2">
                        {p.slug}
                      </Link>{" "}
                      — {p.updateReason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.response.contradictions.length > 0 ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  发现的内容矛盾
                </h3>
                <ul className="mt-1 space-y-0.5">
                  {result.response.contradictions.map((c, i) => (
                    <li key={i}>
                      {c.description}{" "}
                      <span className="text-muted-foreground">[{c.pages.join(", ")}]</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <p className="mt-6 text-caption text-muted-foreground">
        打开 <Link href="/wiki" className="underline underline-offset-2">知识库</Link> 查看从资料中整理出的知识页。
      </p>
    </PageContainer>
  );
}

// Cards make the page feel like one cohesive form. Drop the redundant <Card>
// wrapper for now — it's good enough as the single bordered section.
void Card;

// Schema-validation errors come back as a single long string from the LLM
// wrapper. Surface a friendly summary at the top with the raw detail
// collapsed underneath so power users can still see what the model returned.
function IngestErrorBanner({ message }: { message: string }) {
  const isSchemaError =
    message.includes("格式不正确") || message.includes("schema validation") || message.includes("not valid JSON");
  return (
    <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <p className="font-medium">
        {isSchemaError
          ? "模型返回的数据格式不正确。"
          : "本次资料整理未完成。"}
      </p>
      {isSchemaError ? (
        <p className="mt-1 text-destructive/85">
          可以 <strong>生成知识草稿</strong> 重试；如果仍失败，请在{" "}
          <a
            href="/settings"
            className="underline underline-offset-2 hover:text-destructive/70"
          >
            设置 → 模型 → 资料整理
          </a>{" "}
          中选择其他模型（例如 <code className="font-mono text-xs">anthropic/claude-sonnet-4.6</code> 或{" "}
          <code className="font-mono text-xs">openai/gpt-4o</code>).
        </p>
      ) : null}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-destructive/70 hover:text-destructive">
          查看技术详情
        </summary>
        <pre className="mt-2 overflow-x-auto rounded bg-background/50 p-2 font-mono text-xs text-destructive/80">
          {message}
        </pre>
      </details>
    </div>
  );
}

function CostPreviewForSources({
  mode,
  text,
  file,
  url,
}: {
  mode: Mode;
  text: string;
  file: File | null;
  url: string;
}) {
  const settings = useWikiSettings();
  if (!settings) return null;
  if (!settings.settings.showCostEstimates) return null;

  const isVision =
    mode === "file" && file !== null && /\.(pdf|png|jpg|jpeg|webp)$/i.test(file.name);
  const slot = isVision
    ? settings.settings.defaultModels.vision
    : settings.settings.defaultModels.ingest;
  const model = slot.model;

  // For files, we estimate by file size; PDFs/images ride as base64 in the
  // multimodal call, so the input token cost is roughly bytes/3 (base64 overhead).
  let estimateInput = "";
  if (mode === "paste") estimateInput = text;
  else if (mode === "url") estimateInput = url ? `Article from ${url}, est. 3000 words` : "";
  else if (mode === "file" && file) {
    if (isVision) {
      // Vision: 1 image-ish payload ≈ 1500 tokens for a typical page.
      estimateInput = "x".repeat(Math.min(file.size, 50_000));
    } else {
      // Text file: estimate from size, capped to avoid huge previews.
      estimateInput = "x".repeat(Math.min(file.size, 200_000));
    }
  }

  return <CostPreview text={estimateInput} model={model} provider={slot.provider} contextOverhead={5000} bailianBaseUrl={settings.bailianBaseUrl} />;
}
