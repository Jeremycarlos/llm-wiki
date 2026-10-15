import { providerKeyError } from "@/lib/provider-status";
import { NextResponse } from "next/server";

import { lintWiki } from "@llm-wiki/core";
import { createClient, ContextLengthError, RateLimitError, UnknownModelError } from "@llm-wiki/llm";

import { openWikiContext } from "@/lib/server-wiki";
import { getProviderApiKey } from "@/lib/server-config";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Body = { model?: string };

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const ctx = await openWikiContext();
  const provider = ctx.settings.defaultModels.lint.provider;
  const key = await getProviderApiKey(provider);
  const keyError = providerKeyError(provider, key);
  if (keyError) {
    ctx.db.close();
    return NextResponse.json(
      { error: keyError },
      { status: 400 },
    );
  }
  const model = body.model ?? ctx.settings.defaultModels.lint.model;

  try {
    const client = createClient(key || "", provider, ctx.settings.bailianBaseUrl, key);
    const result = await lintWiki({
      wikiPath: ctx.wikiPath,
      db: ctx.db,
      client,
      model,
      outputLanguage: "zh-CN",
    });
    return NextResponse.json({ ok: true, model, result });
  } catch (err) {
    const status =
      err instanceof ContextLengthError || err instanceof UnknownModelError
        ? 400
        : err instanceof RateLimitError
          ? 429
          : 500;
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message ?? "lint failed",
        type: (err as Error).name ?? "Error",
      },
      { status },
    );
  } finally {
    ctx.db.close();
  }
}
