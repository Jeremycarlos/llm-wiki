import { describe, expect, it } from "vitest";

import { resolveMissingPageSlug } from "./lint-fix-target";

describe("resolveMissingPageSlug", () => {
  it("uses the structured slug for localized descriptions", () => {
    expect(resolveMissingPageSlug("grpo", "知识库缺少 GRPO 的独立知识页。")).toBe("grpo");
  });

  it("normalizes a legacy wikilink when structured data is absent", () => {
    expect(
      resolveMissingPageSlug(null, "AXPO 页面引用了 [[Qwen3-VL-Thinking]]，但对应页面不存在。"),
    ).toBe("qwen3-vl-thinking");
  });

  it("does not guess from unrelated localized prose", () => {
    expect(resolveMissingPageSlug(null, "知识库可能缺少一个相关概念页面。")).toBeNull();
  });
});
