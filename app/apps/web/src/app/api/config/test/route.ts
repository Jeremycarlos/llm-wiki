import { NextResponse } from "next/server";

import { loadWikiSettings } from "@llm-wiki/core";
import { chatComplete, createClient } from "@llm-wiki/llm";
import { resolveWikiPath } from "@/lib/server-wiki";
import { providerKeyError } from "@/lib/provider-status";
import { getProviderApiKey } from "@/lib/server-config";

export const dynamic = "force-dynamic";

// Validates the stored API key against OpenRouter's /key endpoint, which
// requires auth and echoes the account's credit limit + usage. No tokens
// are consumed.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { provider?: string } | null;
  if (body?.provider === "bailian") {
    const key = await getProviderApiKey("bailian");
    const error = providerKeyError("bailian", key);
    if (error) return NextResponse.json({ ok: false, reason: "no-key", message: error }, { status: 400 });
    const settings = await loadWikiSettings(resolveWikiPath());
    const model = settings.defaultModels.query.provider === "bailian" ? settings.defaultModels.query.model : "qwen-plus";
    try {
      const client = createClient("", "bailian", settings.bailianBaseUrl, key);
      const result = await chatComplete({ client, model, messages: [{ role: "user", content: "请只回复：连接成功" }], maxTokens: 32, maxRetries: 1, signal: AbortSignal.timeout(30_000) });
      if (!result.text.trim()) throw new Error("empty response");
      return NextResponse.json({ ok: true, model: result.model, message: "百炼连接成功，已收到模型回复。" });
    } catch {
      return NextResponse.json({ ok: false, reason: "remote-error", message: "百炼连接失败：请检查 API 地址、密钥地域、模型权限和网络。" });
    }
  }
  if (body?.provider && body.provider !== "openrouter") return NextResponse.json({ ok: false, message: "unknown provider" }, { status: 400 });
  const key = await getProviderApiKey("openrouter");
  if (!key) {
    return NextResponse.json(
      { ok: false, reason: "no-key", message: "No API key configured." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://github.com/ddsyasas/llm-wiki",
        "X-Title": "LLM Wiki",
      },
    });

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        { ok: false, reason: "invalid-key", message: "OpenRouter rejected the API key." },
        { status: 200 },
      );
    }
    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: "remote-error",
          message: `OpenRouter returned ${response.status}.`,
        },
        { status: 200 },
      );
    }
    const body = (await response.json()) as {
      data?: { label?: string; usage?: number; limit?: number | null };
    };
    return NextResponse.json({
      ok: true,
      label: body.data?.label ?? null,
      usageUsd: body.data?.usage ?? 0,
      limitUsd: body.data?.limit ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        reason: "network",
        message: `Could not reach OpenRouter: ${(err as Error).message}`,
      },
      { status: 200 },
    );
  }
}
