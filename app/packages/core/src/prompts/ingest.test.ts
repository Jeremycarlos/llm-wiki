import { describe, expect, it } from "vitest";

import { buildIngestPrompt } from "./ingest";

const baseOptions = {
  schema: "知识页必须使用简体中文。",
  index: "# Wiki Index",
  relevantPages: [],
  source: {
    title: "English Paper",
    format: "md" as const,
    content: "An English-language research paper.",
  },
};

describe("buildIngestPrompt", () => {
  it("forces Chinese user-facing fields when zh-CN is requested", () => {
    const prompt = buildIngestPrompt({ ...baseOptions, outputLanguage: "zh-CN" });

    expect(prompt.system).toContain("Write ALL user-facing text in Simplified Chinese");
    expect(prompt.system).toContain('"title": "中文页面标题"');
    expect(prompt.system).toContain('"summary": "从该来源提取内容的一句中文摘要。"');
    expect(prompt.system).toContain("Keep JSON property names, enum values, slugs");
  });

  it("keeps the default prompt language-neutral for non-Chinese callers", () => {
    const prompt = buildIngestPrompt(baseOptions);

    expect(prompt.system).not.toContain("Write ALL user-facing text in Simplified Chinese");
    expect(prompt.system).toContain('"title": "Display Title"');
  });
});
