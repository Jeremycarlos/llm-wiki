import { describe, expect, it } from "vitest";

import {
  estimateCostCents,
  estimateCostCny,
  getPricing,
  inferBailianPricingRegion,
  normalizeModelSlug,
} from "./models";

describe("normalizeModelSlug", () => {
  it("strips Anthropic's 8-digit date suffix", () => {
    expect(normalizeModelSlug("anthropic/claude-4.6-sonnet-20260217")).toBe(
      "anthropic/claude-4.6-sonnet",
    );
  });

  it("strips OpenAI's hyphenated date suffix", () => {
    expect(normalizeModelSlug("openai/gpt-4o-2024-08-06")).toBe("openai/gpt-4o");
  });

  it("leaves slugs without a date suffix alone", () => {
    expect(normalizeModelSlug("google/gemini-2.5-pro")).toBe("google/gemini-2.5-pro");
    expect(normalizeModelSlug("anthropic/claude-sonnet-4.6")).toBe("anthropic/claude-sonnet-4.6");
  });
});

describe("getPricing", () => {
  it("resolves OpenRouter's reordered Anthropic slug", () => {
    // Our canonical: anthropic/claude-sonnet-4.6
    // OpenRouter returns: anthropic/claude-4.6-sonnet (sometimes dated)
    expect(getPricing("anthropic/claude-4.6-sonnet")).not.toBeNull();
    expect(getPricing("anthropic/claude-4.6-sonnet-20260217")).not.toBeNull();
  });

  it("resolves the legacy Claude 3.5 family", () => {
    expect(getPricing("anthropic/claude-3-5-haiku")).not.toBeNull();
    expect(getPricing("anthropic/claude-3-5-sonnet")).not.toBeNull();
  });

  it("returns null for unknown models rather than guessing", () => {
    expect(getPricing("fictitious/model-1.0")).toBeNull();
  });
});

describe("estimateCostCents", () => {
  it("multiplies tokens by the per-million price and converts USD → cents", () => {
    // gpt-4o-mini: $0.15 in / $0.60 out per million
    // 1M in + 1M out = $0.15 + $0.60 = $0.75 = 75 cents
    expect(estimateCostCents("openai/gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(75, 5);
  });

  it("returns null for unknown models", () => {
    expect(estimateCostCents("fictitious/model-1.0", 1000, 1000)).toBeNull();
  });
});

describe("百炼人民币费用估算", () => {
  it("按单次请求输入 Token 落入的北京 qwen-plus 阶梯计价", () => {
    expect(estimateCostCny("bailian/qwen-plus", 128_000, 0, "beijing")).toBeCloseTo(0.1024, 8);
    expect(estimateCostCny("bailian/qwen-plus", 128_001, 0, "beijing")).toBeCloseTo(0.3072024, 8);
    expect(estimateCostCny("qwen-plus", 256_000, 0, "beijing")).toBeCloseTo(0.6144, 8);
    expect(estimateCostCny("qwen-plus", 256_001, 0, "beijing")).toBeCloseTo(1.2288048, 8);
    expect(estimateCostCny("qwen-plus", 1_000_001, 0, "beijing")).toBeNull();
  });

  it("回算已知示例的小额费用，不与美元单价混用", () => {
    expect(estimateCostCny("bailian/qwen-plus", 17_750, 4_894, "beijing")).toBeCloseTo(0.023988, 10);
    expect(estimateCostCents("bailian/qwen-plus", 17_750, 4_894)).toBeNull();
  });

  it("支持视觉模型和新加坡地域费率", () => {
    expect(estimateCostCny("qwen3-vl-plus", 32_001, 0, "beijing")).toBeCloseTo(0.0480015, 8);
    expect(estimateCostCny("qwen3-vl-plus", 32_001, 0, "singapore")).toBeCloseTo(0.070466202, 8);
    expect(estimateCostCny("qwen-plus", 128_000, 0, "singapore")).toBeCloseTo(0.375808, 8);
  });

  it("未知模型、地域或超出已知阶梯保留未知", () => {
    expect(estimateCostCny("qwen-unknown", 100, 100, "beijing")).toBeNull();
    expect(estimateCostCny("qwen-plus", 100, 100, null)).toBeNull();
    expect(estimateCostCny("qwen3-vl-plus", 256_001, 100, "beijing")).toBeNull();
  });

  it("只从受支持的官方地址推断费用地域", () => {
    expect(inferBailianPricingRegion("https://dashscope.aliyuncs.com/compatible-mode/v1")).toBe("beijing");
    expect(inferBailianPricingRegion("https://dashscope-intl.aliyuncs.com/compatible-mode/v1")).toBe("singapore");
    expect(inferBailianPricingRegion("https://dashscope-us.aliyuncs.com/compatible-mode/v1")).toBeNull();
    expect(inferBailianPricingRegion("not a URL")).toBeNull();
  });
});
