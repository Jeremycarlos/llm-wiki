import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { callLLM, createClient } from "@llm-wiki/llm";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DEFAULT_WIKI_SETTINGS, loadWikiSettings, saveWikiSettings } from "./config";
import { openDb } from "./db";
import { listUsageRows } from "./db-usage";
import { applyIngestResponse, ingestPastedText } from "./ingest";
import { initWikiFolder } from "./wiki";
import { queryWiki } from "./query";
import { createChat, sendChatMessage } from "./chat";
import { lintWiki } from "./lint";

// 仅显式启用时向百炼发送合成样例，绝不读取用户知识库。
describe.skipIf(process.env["BAILIAN_LIVE_TEST"] !== "1")("百炼真实联调（临时演示库）", () => {
  it("中文摄取预览、问答、聊天、检查、图片与未知费用", async () => {
    const wikiPath = await mkdtemp(join(tmpdir(), "llm-wiki-bailian-demo-"));
    await initWikiFolder(wikiPath);
    await writeFile(
      join(wikiPath, "CLAUDE.md"),
      "这是合成演示库。仅使用简体中文回答和写作，英文 kebab-case slug。内容仅限提供的资料，不添加外部事实。",
      "utf8",
    );
    const models = Object.fromEntries(
      ["ingest", "query", "chat", "lint", "vision"].map((slot) => [
        slot,
        { provider: "bailian", model: slot === "vision" ? "qwen3-vl-plus" : "qwen-plus" },
      ]),
    ) as typeof DEFAULT_WIKI_SETTINGS.defaultModels;
    await saveWikiSettings(wikiPath, {
      ...DEFAULT_WIKI_SETTINGS,
      topic: "合成演示",
      defaultModels: models,
      requireApprovalForIngest: true,
    });
    const db = openDb(wikiPath);
    const client = createClient("", "bailian");
    try {
      const source =
        "【合成演示资料】蓝叶档案是一套虚构的知识管理方法。它的三个步骤是收集、关联、复习。复习间隔固定为七天。请创建一页知识页，用简体中文写作。";
      const before = await readFile(join(wikiPath, "index.md"), "utf8");
      const result = await ingestPastedText({
        wikiPath,
        db,
        client,
        model: "qwen-plus",
        text: source,
        title: "合成演示：蓝叶档案",
        dryRun: true,
      });
      expect(result.response.newPages.length).toBeGreaterThan(0);
      expect(await readdir(join(wikiPath, "wiki"))).toEqual([]);
      expect(await readFile(join(wikiPath, "index.md"), "utf8")).toBe(before);
      // 仅在临时演示库模拟人工确认。
      await applyIngestResponse({
        response: result.response,
        wikiPath,
        db,
        sourceId: result.sourceId,
        sourceTitle: "合成演示",
        format: "txt",
      });
      const answer = await queryWiki({
        wikiPath,
        db,
        client,
        model: "qwen-plus",
        question: "蓝叶档案（Blue Leaf Archive）的复习间隔是多少？请用简体中文回答。",
      });
      expect(answer.answer).toMatch(/七|7/);
      const chat = await createChat(wikiPath, db, {
        model: "qwen-plus",
        provider: "bailian",
        title: "合成中文聊天",
      });
      const reply = await sendChatMessage({
        wikiPath,
        db,
        client,
        chatId: chat.id,
        userMessage: "请用简体中文说一句你好。",
      });
      expect(reply.assistant.content).toMatch(/[\u4e00-\u9fff]/);
      const lint = await lintWiki({ wikiPath, db, client, model: "qwen-plus" });
      expect(lint).toBeDefined();
      const image = await callLLM({
        client,
        model: "qwen3-vl-plus",
        system: '只返回 JSON：{"color":"颜色名称"}。',
        user: "图像的主要颜色是什么？",
        userParts: [
          { type: "text", text: "识别这张合成图片的主要颜色。" },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${redPng().toString("base64")}` },
          },
        ],
        schema: z.object({ color: z.string() }),
        maxRetries: 1,
      });
      expect(image.data.color).toMatch(/红|red/i);
      expect(
        listUsageRows(db).every(
          (row) => row.model.startsWith("bailian/") && row.cost_cents === null,
        ),
      ).toBe(true);
      expect((await loadWikiSettings(wikiPath)).requireApprovalForIngest).toBe(true);
    } finally {
      db.close();
      await rm(wikiPath, { recursive: true, force: true });
    }
  }, 180_000);
});

function redPng(): Buffer {
  function chunk(type: string, data: Buffer) {
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const check = Buffer.alloc(4);
    check.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, check]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(32);
  header.writeUInt32BE(32, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(32 * (1 + 32 * 3));
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) pixels[y * 97 + 1 + x * 3] = 255;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
