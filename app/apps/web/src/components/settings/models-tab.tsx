"use client";

import Link from "next/link";
import { uiError, uiLabel } from "@/lib/ui-text";
import { useEffect, useMemo, useState } from "react";
import { BAILIAN_MODELS } from "@llm-wiki/llm";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SLOTS = ["ingest", "query", "chat", "lint", "vision"] as const;
type Slot = (typeof SLOTS)[number];

// ─── Provider types ────────────────────────────────────────────────────────────
type Provider = "openrouter" | "ollama" | "bailian";

const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama（本地）" },
  { value: "bailian", label: "阿里云百炼" },
];

// ─── OpenRouter model catalogue ────────────────────────────────────────────────
type ModelChoice = {
  id: string;
  label: string;
  notes: string;
  vision: boolean;
  /** OpenRouter `:free` route. Drives the free-tier banner + dropdown sorting. */
  free?: boolean;
};

const SUGGESTED: ReadonlyArray<ModelChoice> = [
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    notes: "快速、经济",
    vision: true,
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    label: "Claude Sonnet 4.6",
    notes: "支持图片理解",
    vision: true,
  },
  {
    id: "anthropic/claude-opus-4.7",
    label: "Claude Opus 4.7",
    notes: "能力更强、费用较高",
    vision: true,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    notes: "经济、支持 JSON",
    vision: true,
  },
  { id: "openai/gpt-4o", label: "GPT-4o", notes: "支持图片理解", vision: true },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    notes: "长上下文",
    vision: true,
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    notes: "快速、经济",
    vision: true,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    notes: "开放权重，纯文本",
    vision: false,
  },
  // OpenRouter free tier. Picks bias toward larger models — smaller free
  // models tend to fail the wiki's JSON schema. Banner explains the tradeoffs.
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    label: "Llama 3.3 70B （免费线路）",
    notes: "免费线路 · 资料整理 / 检查",
    vision: false,
    free: true,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron Super 120B （免费线路）",
    notes: "免费线路 · 长上下文 · 问答 / 对话",
    vision: false,
    free: true,
  },
  {
    id: "deepseek/deepseek-v4-flash:free",
    label: "DeepSeek V4 Flash （免费线路）",
    notes: "免费线路 · 问答 / 对话",
    vision: false,
    free: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B （免费线路）",
    notes: "免费线路 · 图片理解",
    vision: true,
    free: true,
  },
];

// ─── Ollama local model suggestions ───────────────────────────────────────────
type OllamaChoice = { id: string; label: string; notes: string; vision: boolean };

const OLLAMA_SUGGESTED: ReadonlyArray<OllamaChoice> = [
  { id: "llama3", label: "Llama 3 (8B)", notes: "Meta · 快速、通用", vision: false },
  { id: "llama3:70b", label: "Llama 3 (70B)", notes: "Meta · 能力较强", vision: false },
  { id: "mistral", label: "Mistral 7B", notes: "通用模型", vision: false },
  { id: "mixtral", label: "Mixtral 8x7B", notes: "MoE · 推理模型", vision: false },
  { id: "phi3", label: "Phi-3 Mini", notes: "Microsoft · 轻量快速", vision: false },
  { id: "phi3:medium", label: "Phi-3 Medium", notes: "Microsoft · 均衡", vision: false },
  { id: "gemma2", label: "Gemma 2 (9B)", notes: "Google · 开放模型", vision: false },
  { id: "qwen2", label: "Qwen 2 (7B)", notes: "阿里巴巴 · 多语言", vision: false },
  {
    id: "llava",
    label: "LLaVA",
    notes: "本地图片理解模型",
    vision: true,
  },
  {
    id: "moondream",
    label: "Moondream 2",
    notes: "轻量图片模型",
    vision: true,
  },
];

const CUSTOM_SENTINEL = "__custom__";

const SLOT_HINT: Record<Slot, string> = {
  ingest: "用于将新资料整理为知识草稿，可优先考虑可靠性与费用。",
  query: "用于基于知识库回答问题，建议选择理解能力较好的模型。",
  chat: "用于新建对话；已有对话会保留同一提供商下的模型设置。",
  lint: "用于检查内容矛盾、知识缺口和过时观点。",
  vision: "用于图片与支持的 PDF 输入，须选择视觉模型。",
};

// ─── State shape ───────────────────────────────────────────────────────────────
// Mirrors the server's ModelSlotConfig: each slot stores both provider + model.
type SlotConfig = { provider: Provider; model: string };
type Models = Record<Slot, SlotConfig>;

// Shared <select> className to keep all dropdowns visually identical.
const SELECT_CLS = cn(
  "h-10 min-w-0 w-full sm:w-auto sm:min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

export function ModelsTab() {
  const [models, setModels] = useState<Models | null>(null);
  const [original, setOriginal] = useState<Models | null>(null);

  // Per-slot: is this slot's value currently a custom slug (not in the relevant list)?
  const [customMode, setCustomMode] = useState<Record<Slot, boolean>>({
    ingest: false,
    query: false,
    chat: false,
    lint: false,
    vision: false,
  });

  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { settings: { defaultModels: Models } };
        const dm = data.settings.defaultModels;
        setModels(dm);
        setOriginal(dm);

        const knownOR = new Set(SUGGESTED.map((s) => s.id));
        const knownOL = new Set(OLLAMA_SUGGESTED.map((s) => s.id));
        const derivedCustom = {} as Record<Slot, boolean>;
        for (const slot of SLOTS) {
          const { provider, model } = dm[slot];
          derivedCustom[slot] =
            provider === "bailian" ? !BAILIAN_MODELS.some((m) => m.id === model) : provider === "ollama" ? !knownOL.has(model) : !knownOR.has(model);
        }
        setCustomMode(derivedCustom);
      } catch (err) {
        setError(uiError(err));
      }
    })();
  }, []);

  function updateSlot(slot: Slot, patch: Partial<SlotConfig>) {
    setModels((prev) => (prev ? { ...prev, [slot]: { ...prev[slot], ...patch } } : prev));
  }

  function onProviderChange(slot: Slot, value: Provider) {
    setCustomMode((m) => ({ ...m, [slot]: false }));
    // Reset model to a sensible default for the new provider
    const defaultModel =
      value === "bailian" ? (slot === "vision" ? "qwen3-vl-plus" : "qwen-plus") : value === "ollama"
        ? (OLLAMA_SUGGESTED.find((m) => (slot === "vision" ? m.vision : true))?.id ?? "llama3")
        : (SUGGESTED.find((s) => (slot === "vision" ? s.vision : true))?.id ?? SUGGESTED[0]?.id ?? "openai/gpt-4o-mini");
    updateSlot(slot, { provider: value, model: defaultModel });
  }

  function onModelSelectChange(slot: Slot, value: string) {
    if (value === CUSTOM_SENTINEL) {
      setCustomMode((m) => ({ ...m, [slot]: true }));
      updateSlot(slot, { model: "" });
      return;
    }
    setCustomMode((m) => ({ ...m, [slot]: false }));
    updateSlot(slot, { model: value });
  }

  async function onSave() {
    if (!models) return;
    setBusy(true);
    setFlash(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ defaultModels: models }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOriginal(models);
      setFlash("已保存，后续操作立即使用新的模型设置。");
    } catch (err) {
      setError(uiError(err));
    } finally {
      setBusy(false);
    }
  }

  const dirty = useMemo(
    () => !!models && !!original && SLOTS.some((s) => {
      return models[s].provider !== original[s].provider || models[s].model !== original[s].model;
    }),
    [models, original],
  );

  // Show the Ollama setup banner if ANY slot is currently configured to use
  // Ollama (saved state, not draft). Without local Ollama running, those slot
  // operations all fail with a generic "Connection error" — the banner makes
  // the requirement obvious before the user finds out the painful way.
  const ollamaSlots = useMemo(
    () => (original ? SLOTS.filter((s) => original[s].provider === "ollama") : []),
    [original],
  );

  // Free-tier banner trigger: any saved slot whose model slug is an
  // OpenRouter `:free` route. Distinct concern from Ollama (rate limits +
  // data-retention vs. local-install), distinct banner. Reads the *saved*
  // shape, not the draft, so editing doesn't make the banner flicker.
  const freeSlots = useMemo(
    () =>
      original
        ? SLOTS.filter(
            (s) => original[s].provider === "openrouter" && original[s].model.endsWith(":free"),
          )
        : [],
    [original],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">按用途选择模型</h2>
        <p className="mt-2 text-sm text-muted-foreground">阿里云百炼：文本推荐 qwen-plus，图片推荐 qwen3-vl-plus；也可输入已开通的模型名称。API 地址与连接测试见 API 页签。费用显示为未知，以百炼账单为准；PDF 请先转换为文本或逐页图片。</p>
        <p className="mt-1 text-sm text-muted-foreground">
          每项操作可以独立选择提供商与模型。{" "}
          <a
            href="https://openrouter.ai/models"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            OpenRouter
          </a>{" "}
          提供云端模型，{" "}
          <a
            href="https://ollama.com/library"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Ollama
          </a>{" "}
          用于本地推理，也可以使用阿里云百炼。
        </p>
      </div>

      {/* Free-tier banner — visible when one or more slots use an
          OpenRouter `:free` model. Surfaces the rate-limit + data-retention
          tradeoffs the user implicitly opted into. Same amber palette as
          the Ollama banner since both are "you made a non-default choice
          with operational caveats". */}
      {freeSlots.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            正在使用免费线路： {freeSlots.join(", ")}{" "}
            {freeSlots.length === 1 ? "（1 个用途）" : `(${freeSlots.length} slots)`}
          </p>
          <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">
            免费线路可能有更严格的额度和数据政策，请先了解：
          </p>
          <ul className="ml-4 mt-1 list-disc space-y-0.5 text-amber-900/80 dark:text-amber-200/80">
            <li>
              <strong>调用限制。</strong> 免费额度和请求频率随账户与平台政策变化，具体限制请查看官方说明。账户余额与充值（${"≥"}10 等）对额度的影响也以平台当前规则为准。
            </li>
            <li>
              <strong>数据使用。</strong> 部分线路的提供商可能保留提示词，使用 <code>:free</code> 线路前，请核对提供商的数据政策，避免提交秘密资料。
            </li>
            <li>
              <strong>JSON 可靠性。</strong> 资料整理、问答和检查需要符合约定的 JSON 数据。如果出现{" "}
              <em>schema validation failed</em> 错误，可尝试切换到更可靠的模型。
            </li>
          </ul>
          <a
            href="https://openrouter.ai/docs/api-reference/limits"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-amber-900 underline underline-offset-2 hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
          >
            查看 OpenRouter 调用限制 →
          </a>
        </div>
      ) : null}

      {/* Ollama setup banner — visible when one or more slots already use
          Ollama. Static link to /local-models with install + hardware guidance.
          Not gated on Ollama actually being reachable (would need a server-
          side ping every render); just a "did you set this up?" reminder. */}
      {ollamaSlots.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            已选择 Ollama 的用途： {ollamaSlots.length === 1 ? "1 项" : `${ollamaSlots.length} slots`}
            {ollamaSlots.length > 0 ? ` (${ollamaSlots.join(", ")})` : ""}
          </p>
          <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">
            使用本地模型前，请先安装并启动 Ollama，否则可能出现 <em>连接错误</em>。安装步骤和注意事项见本地模型指南。
          </p>
          <Link
            href="/local-models"
            className="mt-2 inline-block text-amber-900 underline underline-offset-2 hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
          >
            查看本地模型指南 →
          </Link>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {!models ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="space-y-5">
          {SLOTS.map((slot) => {
            const provider = models[slot].provider;
            const visionOnly = slot === "vision";
            const isOllama = provider === "ollama";

            // Pick which suggestion list to show
            const visibleOptions = isOllama
              ? visionOnly
                ? OLLAMA_SUGGESTED.filter((s) => s.vision)
                : OLLAMA_SUGGESTED
              : provider === "bailian"
                ? BAILIAN_MODELS.filter((s) => !visionOnly || s.vision)
              : visionOnly
                ? SUGGESTED.filter((s) => s.vision)
                : SUGGESTED;

            const knownIds = new Set(visibleOptions.map((o) => o.id));
            const isCustom = customMode[slot] || !knownIds.has(models[slot].model);

            return (
              <div key={slot}>
                <label className="mb-1.5 block text-sm font-medium capitalize" htmlFor={`m-${slot}`}>
                  {uiLabel(slot)}
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {/* ── Provider picker ─────────────────────────────────── */}
                  <select
                    id={`p-${slot}`}
                    aria-label={`${uiLabel(slot)}提供商`}
                    value={provider}
                    onChange={(e) => onProviderChange(slot, e.target.value as Provider)}
                    className={cn(SELECT_CLS, "min-w-[10rem]")}
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>

                  {/* ── Model picker ────────────────────────────────────── */}
                  <select
                    id={`m-${slot}`}
                    value={isCustom ? CUSTOM_SENTINEL : models[slot].model}
                    onChange={(e) => onModelSelectChange(slot, e.target.value)}
                    className={cn(SELECT_CLS, "min-w-0 sm:min-w-[14rem]")}
                  >
                    {visibleOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} — {o.notes}
                      </option>
                    ))}
                    <option value={CUSTOM_SENTINEL}>
                      {isOllama ? "自定义模型名称" : "自定义模型标识"}
                    </option>
                  </select>

                  {/* ── Custom model input ──────────────────────────────── */}
                  {isCustom ? (
                    <Input
                      value={models[slot].model}
                      onChange={(e) => updateSlot(slot, { model: e.target.value })}
                      placeholder={provider === "bailian" ? "例如 qwen-plus" : isOllama ? "例如 llama3:latest" : "provider/model-id"}
                      className="font-mono text-[13px] sm:flex-1"
                    />
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">{models[slot].model}</span>
                  )}
                </div>

                {/* Ollama hint */}
                {isOllama && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    请先确认{" "}
                    <code className="font-mono">ollama run {models[slot].model || "<model>"}</code> 可以在本机正常运行，再保存设置。
                  </p>
                )}

                <p className="mt-1 text-xs text-muted-foreground">{slot === "vision" && provider === "bailian" ? "百炼视觉槽位用于图片；PDF 请先转换为文本或逐页图片。" : SLOT_HINT[slot]}</p>
              </div>
            );
          })}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={onSave} disabled={!dirty || busy}>
              {busy ? "保存中…" : dirty ? "保存模型设置" : "已保存"}
            </Button>
            {flash ? <span className="text-sm text-muted-foreground">{flash}</span> : null}
          </div>
        </div>
      )}

      <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">模型可用性可能变化。</strong> 提供商可能下线旧模型。如果操作提示{" "}
        <code className="font-mono">模型不可用</code>，请重新选择可用模型。本地 Ollama 可运行{" "}
        <code className="font-mono">ollama list</code> 查看已下载的模型。
      </div>
    </div>
  );
}
