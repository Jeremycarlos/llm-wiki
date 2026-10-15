import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_WIKI_SETTINGS, loadWikiSettings, wikiSettingsPath } from "../packages/core/src/config";
import { initWikiFolder } from "../packages/core/src/wiki";

describe("公开发行版首次使用", () => {
  it("新知识库默认使用百炼，资料整理需审核后应用", () => {
    for (const [slot, value] of Object.entries(DEFAULT_WIKI_SETTINGS.defaultModels)) {
      expect(value).toEqual({ provider: "bailian", model: slot === "vision" ? "qwen3-vl-plus" : "qwen-plus" });
    }
    expect(DEFAULT_WIKI_SETTINGS.requireApprovalForIngest).toBe(true);
  });

  it("不覆盖已有知识库的模型和审批选择", async () => {
    const folder = await mkdtemp(join(tmpdir(), "llm-wiki-distribution-"));
    try {
      await initWikiFolder(folder);
      await writeFile(wikiSettingsPath(folder), JSON.stringify({
        topic: "演示主题",
        requireApprovalForIngest: false,
        defaultModels: { query: { provider: "ollama", model: "custom-local-model" } },
      }));
      const settings = await loadWikiSettings(folder);
      expect(settings.topic).toBe("演示主题");
      expect(settings.defaultModels.query).toEqual({ provider: "ollama", model: "custom-local-model" });
      expect(settings.requireApprovalForIngest).toBe(false);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });

});
