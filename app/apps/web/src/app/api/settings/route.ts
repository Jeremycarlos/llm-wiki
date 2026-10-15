import { NextResponse } from "next/server";

import {
  DEFAULT_WIKI_SETTINGS,
  loadWikiSettings,
  saveWikiSettings,
  type ModelSlotConfig,
  type WikiSettings,
} from "@llm-wiki/core";

import { resolveWikiPath } from "@/lib/server-wiki";
import { DEFAULT_BAILIAN_BASE_URL, validateBailianBaseUrl } from "@llm-wiki/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  const wikiPath = resolveWikiPath();
  const settings = await loadWikiSettings(wikiPath);
  const bailianBaseUrl = validateBailianBaseUrl(
    settings.bailianBaseUrl || process.env["DASHSCOPE_BASE_URL"] || DEFAULT_BAILIAN_BASE_URL,
  );
  return NextResponse.json({ settings, wikiPath, bailianBaseUrl });
}

type PutBody = Partial<{
  bailianBaseUrl: string;
  topic: string;
  defaultModels: Partial<Record<keyof WikiSettings["defaultModels"], Partial<ModelSlotConfig>>>;
  autoLintAfterIngest: boolean;
  showCostEstimates: boolean;
  requireApprovalForIngest: boolean;
}>;

export async function PUT(req: Request) {
  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }
  const wikiPath = resolveWikiPath();
  const current = await loadWikiSettings(wikiPath);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "expected JSON object" }, { status: 400 });
  }
  let bailianBaseUrl = current.bailianBaseUrl;
  if (body.bailianBaseUrl !== undefined) {
    try {
      if (typeof body.bailianBaseUrl !== "string") throw new Error("API 地址必须为字符串。");
      bailianBaseUrl = body.bailianBaseUrl.trim() ? validateBailianBaseUrl(body.bailianBaseUrl) : undefined;
    } catch {
      return NextResponse.json({ error: "百炼 API 地址须为阿里云官方 HTTPS 地址，以 /compatible-mode/v1 结尾。" }, { status: 400 });
    }
  }
  if (body.defaultModels !== undefined) {
    if (!body.defaultModels || typeof body.defaultModels !== "object" || Array.isArray(body.defaultModels)) {
      return NextResponse.json({ error: "defaultModels must be an object" }, { status: 400 });
    }
    for (const slot of ["ingest", "query", "chat", "lint", "vision"] as const) {
      const entry = body.defaultModels[slot];
      if (entry !== undefined && (!entry || typeof entry !== "object" || Array.isArray(entry)
        || (entry.provider !== undefined && !["openrouter", "ollama", "bailian"].includes(entry.provider))
        || (entry.model !== undefined && (typeof entry.model !== "string" || !entry.model.trim())))) {
        return NextResponse.json({ error: `invalid model configuration: ${slot}` }, { status: 400 });
      }
    }
  }
  const next: WikiSettings = {
    version: 1,
    ...(bailianBaseUrl ? { bailianBaseUrl } : {}),
    topic: typeof body.topic === "string" ? body.topic : current.topic,
    defaultModels: {
      ingest: { ...current.defaultModels.ingest, ...body.defaultModels?.ingest },
      query:  { ...current.defaultModels.query,  ...body.defaultModels?.query  },
      chat:   { ...current.defaultModels.chat,   ...body.defaultModels?.chat   },
      lint:   { ...current.defaultModels.lint,   ...body.defaultModels?.lint   },
      vision: { ...current.defaultModels.vision, ...body.defaultModels?.vision },
    },
    autoLintAfterIngest:
      typeof body.autoLintAfterIngest === "boolean"
        ? body.autoLintAfterIngest
        : current.autoLintAfterIngest,
    showCostEstimates:
      typeof body.showCostEstimates === "boolean"
        ? body.showCostEstimates
        : current.showCostEstimates,
    requireApprovalForIngest:
      typeof body.requireApprovalForIngest === "boolean"
        ? body.requireApprovalForIngest
        : current.requireApprovalForIngest,
  };
  await saveWikiSettings(wikiPath, next);
  // Return both the saved settings and the model defaults for the UI's
  // "reset to default" affordance.
  return NextResponse.json({ ok: true, settings: next, defaults: DEFAULT_WIKI_SETTINGS });
}
