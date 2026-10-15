import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WIKI_SETTINGS,
  initWikiFolder,
  insertUsage,
  loadWikiSettings,
  openInMemoryDb,
  saveWikiSettings,
} from "@llm-wiki/core";

const state = vi.hoisted(() => ({ path: "", db: null as unknown, settings: null as unknown }));
vi.mock("@/lib/server-wiki", () => ({
  resolveWikiPath: () => state.path,
  openWikiContext: async () => ({ wikiPath: state.path, db: state.db, settings: state.settings }),
}));
vi.mock("@/lib/server-config", () => ({
  getApiKeyStatus: async () => ({ configured: true, hint: "test", source: "keychain" }),
  getBailianApiKeyStatus: async () => {
    const key = process.env["DASHSCOPE_API_KEY"]?.trim() || null;
    return {
      configured: key !== null,
      source: key ? "env" : "none",
      keychainAvailable: true,
      hint: key && key.length > 4 ? key.slice(-4) : null,
    };
  },
  getProviderApiKey: async (provider: string) =>
    provider === "bailian" ? process.env["DASHSCOPE_API_KEY"]?.trim() || null : "or-test",
  setApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  setBailianApiKey: async () => ({ configured: true, source: "keychain", keychainAvailable: true, hint: "cret" }),
  deleteBailianApiKey: async () => ({ configured: false, source: "none", keychainAvailable: true, hint: null }),
}));
vi.mock("@llm-wiki/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@llm-wiki/core")>()),
  getApiKey: async () => ({ key: "or-test" }),
}));
import { PUT } from "../apps/web/src/app/api/settings/route";
import { GET as configGET } from "../apps/web/src/app/api/config/route";
import { POST as bailianKeyPOST, DELETE as bailianKeyDELETE } from "../apps/web/src/app/api/config/bailian/route";
import { POST as testPOST } from "../apps/web/src/app/api/config/test/route";
import { POST as ingestPOST } from "../apps/web/src/app/api/ingest/route";
import { POST as queryPOST } from "../apps/web/src/app/api/query/route";
import { GET as usageGET } from "../apps/web/src/app/api/usage/route";

beforeEach(async () => {
  state.path = await mkdtemp(join(tmpdir(), "llm-wiki-bailian-routes-"));
  await initWikiFolder(state.path);
  state.db = openInMemoryDb();
  const settings = structuredClone(DEFAULT_WIKI_SETTINGS);
  for (const slot of Object.values(settings.defaultModels)) {
    slot.provider = "bailian";
    slot.model = "qwen-plus";
  }
  settings.defaultModels.vision.model = "qwen3-vl-plus";
  settings.requireApprovalForIngest = true;
  await saveWikiSettings(state.path, settings);
  state.settings = settings;
  vi.stubEnv("DASHSCOPE_API_KEY", "test-key-never-return");
});
afterEach(async () => {
  (state.db as ReturnType<typeof openInMemoryDb>).close();
  await rm(state.path, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function json(data: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
}

describe("百炼配置和路由", () => {
  it("配置保存、重载保留提供商、地址和摄取审批", async () => {
    expect(
      (
        await PUT(
          json({
            bailianBaseUrl: "https://demo.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
            defaultModels: { query: { provider: "bailian", model: "qwen-plus" } },
          }),
        )
      ).status,
    ).toBe(200);
    const settings = await loadWikiSettings(state.path);
    expect(settings.bailianBaseUrl).toContain("demo.cn-beijing");
    expect(settings.defaultModels.query.provider).toBe("bailian");
    expect(settings.requireApprovalForIngest).toBe(true);
    expect(await readFile(join(state.path, ".llm-wiki/settings.json"), "utf8")).not.toContain(
      "test-key-never-return",
    );
  });
  it("拒绝错误地址和空模型，且不改配置", async () => {
    const before = await loadWikiSettings(state.path);
    for (const data of [
      { bailianBaseUrl: "https://example.com/compatible-mode/v1" },
      { defaultModels: { ingest: { model: "" } } },
      { defaultModels: { query: { provider: "invalid" } } },
      null,
    ])
      expect((await PUT(json(data))).status).toBe(400);
    expect(await loadWikiSettings(state.path)).toEqual(before);
  });
  it("密钥状态仅返回存在与否，缺失时返回清楚错误", async () => {
    const status = await configGET();
    const text = await status.text();
    expect(text).toContain('"bailian":{"configured":true');
    expect(text).not.toContain("test-key-never-return");
    vi.stubEnv("DASHSCOPE_API_KEY", "");
    expect((await testPOST(json({ provider: "bailian" }))).status).toBe(400);
    expect((await queryPOST(json({ question: "合成问题" }))).status).toBe(400);
  });
  it("百炼设置接口保存或移除后只返回掩码状态", async () => {
    const saved = await bailianKeyPOST(json({ apiKey: "bailian-secret-that-must-not-return" }));
    const savedText = await saved.text();
    expect(saved.status).toBe(200);
    expect(savedText).toContain('"hint":"cret"');
    expect(savedText).not.toContain("bailian-secret-that-must-not-return");
    const removed = await bailianKeyDELETE();
    expect(await removed.json()).toMatchObject({ configured: false, source: "none" });
  });
  it("用量 API 分开返回美元与人民币估算，并保留未知百炼调用", async () => {
    insertUsage(state.db as ReturnType<typeof openInMemoryDb>, {
      operation: "ingest",
      model: "bailian/qwen-plus",
      input_tokens: 17_750,
      output_tokens: 4_894,
      cost_cents: null,
      cost_cny: 0.023988,
      created_at: "2026-10-14T00:00:00Z",
    });
    insertUsage(state.db as ReturnType<typeof openInMemoryDb>, {
      operation: "query",
      model: "openai/gpt-4o-mini",
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cost_cents: 75,
      cost_cny: null,
      created_at: "2026-10-14T00:00:00Z",
    });
    insertUsage(state.db as ReturnType<typeof openInMemoryDb>, {
      operation: "query",
      model: "bailian/custom-unknown",
      input_tokens: 1000,
      output_tokens: 500,
      cost_cents: null,
      cost_cny: null,
      created_at: "2026-10-14T00:00:00Z",
    });
    const response = await usageGET();
    const data = await response.json();
    expect(data.totals).toMatchObject({
      cost_cents: 75,
      cost_cny: 0.023988,
      unknown_cost_cents_calls: 0,
      unknown_cost_cny_calls: 1,
    });
    expect(data.breakdown.find((row: { model: string }) => row.model === "bailian/custom-unknown").total_cost_cny).toBeNull();
  });
  it("PDF 返回可操作的限制提示，原始目录和网络均未触及", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const form = new FormData();
    form.append("file", new File(["%PDF-1.4\nsynthetic"], "demo.pdf", { type: "application/pdf" }));
    const response = await ingestPOST(
      new Request("http://localhost/api/ingest", { method: "POST", body: form }),
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toContain("Markdown");
    expect(await readdir(join(state.path, "raw"))).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("界面连接测试使用保存的模型，返回结果不包含密钥", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            model: "qwen-plus",
            choices: [{ message: { content: "连接成功" } }],
            usage: { prompt_tokens: 5, completion_tokens: 3 },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await testPOST(json({ provider: "bailian" }));
    const data = await response.json();
    expect(data).toMatchObject({ ok: true, model: "qwen-plus" });
    expect(JSON.stringify(data)).not.toContain("test-key-never-return");
  });
});
