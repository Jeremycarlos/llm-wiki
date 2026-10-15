import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callLLM, chatComplete, createClient, usageModel, validateBailianBaseUrl } from "./client";
import { getPricing } from "./models";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function mockFetch(content = '{"message":"中文回答"}', status = 200) {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify(
          status === 200
            ? {
                model: "qwen-plus",
                choices: [{ message: { content }, finish_reason: "stop" }],
                usage: { prompt_tokens: 20, completion_tokens: 10 },
              }
            : { error: { message: "sensitive-test-value", code: "invalid_api_key" } },
        ),
        { status, headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("DASHSCOPE_API_KEY", "test-bailian-only");
  return fetch;
}

describe("百炼提供商", () => {
  it("使用独立环境密钥和业务空间地址，发送非思考 JSON 请求", async () => {
    const fetch = mockFetch();
    const client = createClient(
      "other-provider-key",
      "bailian",
      "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/",
    );
    const result = await callLLM({
      client,
      model: "qwen-plus",
      system: "请返回 JSON",
      user: "你好",
      schema: z.object({ message: z.string() }),
    });
    expect(result.data.message).toBe("中文回答");
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe(
      "https://workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
    );
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer test-bailian-only");
    expect(headers.has("http-referer")).toBe(false);
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "qwen-plus",
      enable_thinking: false,
      response_format: { type: "json_object" },
    });
    expect(JSON.parse(init.body as string)).not.toHaveProperty("extra_body");
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 10 });
  });

  it("聊天走纯文本请求，保留图片内容块", async () => {
    const fetch = mockFetch("你好");
    const client = createClient("", "bailian");
    expect(
      (
        await chatComplete({
          client,
          model: "qwen-plus",
          messages: [{ role: "user", content: "你好" }],
          maxTokens: 32,
        })
      ).text,
    ).toBe("你好");
    const body = JSON.parse(
      (fetch.mock.calls[0] as unknown as [unknown, RequestInit])[1].body as string,
    );
    expect(body).not.toHaveProperty("response_format");
    expect(body.max_tokens).toBe(32);
    mockFetch();
    const imageClient = createClient("", "bailian");
    const parts = [
      { type: "image_url" as const, image_url: { url: "data:image/png;base64,AA==" } },
    ];
    await callLLM({
      client: imageClient,
      model: "qwen3-vl-plus",
      system: "JSON",
      user: "图片",
      userParts: parts,
      schema: z.object({ message: z.string() }),
    });
    expect(getPricing(usageModel(client, "openai/gpt-4o-mini"))).toBeNull();
  });

  it("缺少百炼密钥时不借用 OpenRouter 密钥", () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "");
    expect(() => createClient("other-provider-key", "bailian")).toThrow("DASHSCOPE_API_KEY");
  });

  it("明确移除的密钥不会回退到仍存在的环境变量", () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "old-env-key");
    expect(() => createClient("", "bailian", undefined, null)).toThrow("DASHSCOPE_API_KEY");
  });

  it("发送前拒绝 OpenRouter 专用 PDF，绝不发起网络请求", async () => {
    const fetch = mockFetch();
    await expect(
      callLLM({
        client: createClient("", "bailian"),
        model: "qwen3-vl-plus",
        system: "JSON",
        user: "PDF",
        userParts: [
          {
            type: "file",
            file: { filename: "demo.pdf", file_data: "data:application/pdf;base64,AA==" },
          },
        ],
        schema: z.object({}),
      }),
    ).rejects.toThrow("不支持直接读取 PDF");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("错误信息不回显远端可能包含的凭证", async () => {
    mockFetch("", 401);
    await expect(
      chatComplete({
        client: createClient("", "bailian"),
        model: "qwen-plus",
        messages: [],
        maxRetries: 1,
      }),
    ).rejects.toThrow("HTTP 401");
    await expect(
      chatComplete({
        client: createClient("", "bailian"),
        model: "qwen-plus",
        messages: [],
        maxRetries: 1,
      }),
    ).rejects.not.toThrow("sensitive-test-value");
  });

  it("保留 OpenRouter 和 Ollama 路由", async () => {
    const fetch = mockFetch("ok");
    const or = createClient("or-test", "openrouter");
    await chatComplete({ client: or, model: "openai/gpt-4o-mini", messages: [] });
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain("openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(init.body as string)).not.toHaveProperty("enable_thinking");
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434");
    expect(createClient("", "ollama").baseURL).toBe("http://localhost:11434/v1");
  });
});

describe("百炼 API 地址校验", () => {
  it.each([
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "https://abc.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
  ])("接受官方地址 %s", (url) => expect(validateBailianBaseUrl(url)).toBe(url));
  it.each([
    "http://dashscope.aliyuncs.com/compatible-mode/v1",
    "https://evil.example/compatible-mode/v1",
    "https://dashscope.aliyuncs.com.evil.example/compatible-mode/v1",
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    "https://user:password@dashscope.aliyuncs.com/compatible-mode/v1",
    "https://dashscope.aliyuncs.com/compatible-mode/v1?key=secret",
  ])("拒绝不安全或错误地址 %s", (url) => expect(() => validateBailianBaseUrl(url)).toThrow());
});
