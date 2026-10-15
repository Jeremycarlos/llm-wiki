import { NextResponse } from "next/server";

import {
  deleteBailianApiKey,
  getBailianApiKeyStatus,
  setBailianApiKey,
} from "@/lib/server-config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "expected JSON body" }, { status: 400 });
  }
  const apiKey = typeof body === "object" && body !== null && "apiKey" in body
    ? (body as { apiKey?: unknown }).apiKey
    : null;
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return NextResponse.json({ error: "apiKey must be a non-empty string" }, { status: 400 });
  }
  try {
    return NextResponse.json(await setBailianApiKey(apiKey));
  } catch {
    return NextResponse.json({ error: "保存百炼 API 密钥失败。" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    return NextResponse.json(await deleteBailianApiKey());
  } catch {
    return NextResponse.json({ error: "移除百炼 API 密钥失败。" }, { status: 500 });
  }
}
