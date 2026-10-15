import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { LlmClient } from "@llm-wiki/llm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openInMemoryDb, type Db } from "./db";
import { indexPageForSearch, upsertPage } from "./db-pages";
import { removeBrokenLink } from "./editor";
import { getLastLintSummary, getLintHistory, lintWiki } from "./lint";
import { LintResponseSchema, type LintResponse } from "./schema";
import { appendLog, initWikiFolder, readPage, writePage } from "./wiki";

function stubClient(responses: LintResponse[]): LlmClient {
  const queue = [...responses];
  return {
    chat: {
      completions: {
        create: vi.fn(async () => {
          const next = queue.shift();
          if (!next) throw new Error("stub LLM: no canned response left");
          return {
            id: "stub",
            model: "stub/lint",
            choices: [
              { index: 0, message: { role: "assistant", content: JSON.stringify(next) }, finish_reason: "stop" },
            ],
            usage: { prompt_tokens: 3500, completion_tokens: 400 },
          };
        }),
      },
    },
  } as unknown as LlmClient;
}

let wikiPath: string;
let db: Db;

beforeEach(async () => {
  wikiPath = await mkdtemp(join(tmpdir(), "llm-wiki-lint-test-"));
  await initWikiFolder(wikiPath);
  db = openInMemoryDb();
});

afterEach(async () => {
  db.close();
  await rm(wikiPath, { recursive: true, force: true });
});

async function seed(
  slug: string,
  title: string,
  body: string,
  type: "concept" | "entity" | "overview" = "concept",
) {
  await writePage(wikiPath, {
    slug,
    frontmatter: {
      title,
      slug,
      type,
      created: "2026-01-01",
      updated: "2026-01-01",
    },
    content: body,
  });
  upsertPage(db, {
    slug,
    title,
    type,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    word_count: body.split(/\s+/).length,
    tags: [],
  });
  indexPageForSearch(db, { slug, title, content: body, tags: [] });
}

const noopLlmResponse: LintResponse = {
  issues: [],
  suggestedQuestions: [],
  overallHealth: "good",
};

describe("lintWiki — local checks", () => {
  it("supports Chinese findings without translating machine-readable fields", async () => {
    await seed("demo", "演示知识页", "引用 [[missing-demo]]。");
    const client = stubClient([noopLlmResponse]);
    const result = await lintWiki({ wikiPath, db, client, model: "stub/lint", outputLanguage: "zh-CN" });
    const finding = result.issues.find((issue) => issue.type === "broken-link");
    expect(finding?.description).toContain("尚不存在的知识页 [[missing-demo]]");
    expect(finding?.source).toBe("local");
    expect(finding?.suggestedFix).toContain("移除");
    expect(client.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ role: "system", content: expect.stringContaining("Simplified Chinese") })]) }), undefined);
    expect(client.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ role: "system", content: expect.stringContaining('"missingSlug"') })]) }), undefined);
  });
  it("returns an empty-but-healthy result on an empty wiki without calling the LLM", async () => {
    const create = vi.fn();
    const client = { chat: { completions: { create } } } as unknown as LlmClient;
    const r = await lintWiki({ wikiPath, db, client, model: "stub/lint" });
    expect(r.issues).toEqual([]);
    expect(r.overallHealth).toBe("excellent");
    expect(create).not.toHaveBeenCalled();
  });

  it("flags broken-link issues for every [[slug]] that doesn't exist", async () => {
    await seed("a", "A", "Links to [[bogus-slug]] and [[also-missing]].");
    await seed("b", "B", "Links to [[a]] — fine.");
    const r = await lintWiki({
      wikiPath,
      db,
      client: stubClient([noopLlmResponse]),
      model: "stub/lint",
    });
    const broken = r.issues.filter((i) => i.type === "broken-link");
    expect(broken).toHaveLength(2);
    expect(broken.every((b) => b.source === "local")).toBe(true);
    expect(broken.map((b) => b.affectedPages[0])).toEqual(["a", "a"]);
  });

  it("flags orphans but skips overview pages", async () => {
    await seed("a", "A", "Standalone with no inbound or outbound links.");
    await seed("b", "B", "Links to [[a]]."); // so 'a' is no longer orphan
    await seed("c", "C", "Unlinked.");
    await seed("home", "Home", "Welcome.", "overview"); // also unlinked but overview
    const r = await lintWiki({
      wikiPath,
      db,
      client: stubClient([noopLlmResponse]),
      model: "stub/lint",
    });
    const orphans = r.issues.filter((i) => i.type === "orphan");
    const orphanSlugs = orphans.map((o) => o.affectedPages[0]).sort();
    expect(orphanSlugs).toEqual(["b", "c"]);
  });
});

describe("lintWiki — LLM pass", () => {
  it("merges deterministic findings with LLM-returned issues and uses LLM's overallHealth", async () => {
    await seed("a", "A", "Links to [[missing-page]].");
    const llmResp: LintResponse = {
      issues: [
        {
          severity: "high",
          type: "contradiction",
          description: "Page A and Page B disagree about X.",
          affectedPages: ["a"],
          suggestedFix: "Reconcile via a fresh source.",
          missingSlug: null,
        },
      ],
      suggestedQuestions: ["What's the source for X?"],
      overallHealth: "needs-work",
    };
    const r = await lintWiki({
      wikiPath,
      db,
      client: stubClient([llmResp]),
      model: "stub/lint",
    });
    expect(r.issues.some((i) => i.type === "broken-link" && i.source === "local")).toBe(true);
    expect(r.issues.some((i) => i.type === "contradiction" && i.source === "llm")).toBe(true);
    expect(r.suggestedQuestions).toEqual(["What's the source for X?"]);
    expect(r.overallHealth).toBe("needs-work");
  });

  it("preserves a structured missing-page target in Chinese output", async () => {
    await seed("axpo", "AXPO", "正文提到了 GRPO。");
    const llmResp: LintResponse = {
      issues: [
        {
          severity: "medium",
          type: "missing-page",
          description: "知识库缺少 GRPO 的独立知识页。",
          affectedPages: ["axpo"],
          suggestedFix: "创建 GRPO 起始知识页。",
          missingSlug: "grpo",
        },
      ],
      suggestedQuestions: [],
      overallHealth: "fair",
    };

    const result = await lintWiki({
      wikiPath,
      db,
      client: stubClient([llmResp]),
      model: "stub/lint",
      outputLanguage: "zh-CN",
    });

    expect(result.issues.find((issue) => issue.type === "missing-page")?.missingSlug).toBe("grpo");
  });
});

describe("LintResponseSchema", () => {
  it("requires a structured slug for missing-page issues", () => {
    const parsed = LintResponseSchema.safeParse({
      issues: [
        {
          severity: "medium",
          type: "missing-page",
          description: "知识库缺少 GRPO 的独立知识页。",
          affectedPages: ["axpo"],
          suggestedFix: "创建 GRPO 起始知识页。",
        },
      ],
      suggestedQuestions: [],
      overallHealth: "fair",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("removeBrokenLink", () => {
  it("strips [[bad]] and keeps the display text from [[bad|Display]]", async () => {
    await seed(
      "a",
      "A",
      "Refs: [[bogus]] in body and [[bogus|the bogus thing]] later. Also fine: [[other]].",
    );
    await seed("other", "Other", "Just here so [[a]]'s [[other]] link resolves.");
    const r = await removeBrokenLink(wikiPath, db, "a", "bogus");
    expect(r.page.content).not.toContain("[[bogus]]");
    expect(r.page.content).not.toContain("[[bogus|");
    expect(r.page.content).toContain("the bogus thing");
    expect(r.page.content).toContain("bogus in body"); // bare slug substitution
    // The good [[other]] link survives.
    expect(r.page.content).toContain("[[other]]");

    const onDisk = await readPage(wikiPath, "a");
    expect(onDisk.content).toBe(r.page.content);
  });

  it("throws when the page doesn't actually contain the broken link", async () => {
    await seed("a", "A", "no links at all");
    await expect(removeBrokenLink(wikiPath, db, "a", "bogus")).rejects.toThrow(/doesn't contain/);
  });
});

describe("getLastLintSummary", () => {
  it("returns null when log.md doesn't exist", async () => {
    expect(await getLastLintSummary(wikiPath)).toBeNull();
  });

  it("returns null when log.md has no lint entries", async () => {
    await appendLog(wikiPath, `## [2026-05-24 01:00] ingest | Some source (md)\n- created pages: foo`);
    expect(await getLastLintSummary(wikiPath)).toBeNull();
  });

  it("parses the most recent lint heading and returns the count + health", async () => {
    await appendLog(wikiPath, `## [2026-05-24 01:00] lint | 19 issues — needs-work\n- 9 high, 7 medium, 3 low across 10 pages`);
    await appendLog(wikiPath, `## [2026-05-24 02:00] ingest | New source (md)\n- created pages: bar`);
    await appendLog(wikiPath, `## [2026-05-24 03:00] lint | 4 issues — fair\n- 1 high, 2 medium, 1 low across 11 pages`);
    const r = await getLastLintSummary(wikiPath);
    expect(r).not.toBeNull();
    expect(r?.totalIssues).toBe(4);
    expect(r?.health).toBe("fair");
    expect(r?.stamp).toBe("2026-05-24 03:00");
  });

  it("returns null health when the heading omits the health suffix", async () => {
    await appendLog(wikiPath, `## [2026-05-24 04:00] lint | 0 issues`);
    const r = await getLastLintSummary(wikiPath);
    expect(r?.totalIssues).toBe(0);
    expect(r?.health).toBeNull();
  });
});

describe("getLintHistory", () => {
  it("returns empty array when no lint entries exist", async () => {
    expect(await getLintHistory(wikiPath, 5)).toEqual([]);
  });

  it("returns the N most-recent lint entries newest-first", async () => {
    await appendLog(wikiPath, `## [2026-05-24 01:00] lint | 20 issues — needs-work\n- 10 high, 7 medium, 3 low across 10 pages`);
    await appendLog(wikiPath, `## [2026-05-24 02:00] lint | 15 issues — needs-work\n- 6 high, 6 medium, 3 low across 10 pages`);
    await appendLog(wikiPath, `## [2026-05-24 03:00] lint | 4 issues — fair\n- 1 high, 2 medium, 1 low across 10 pages`);
    const r = await getLintHistory(wikiPath, 10);
    expect(r.map((h) => h.totalIssues)).toEqual([4, 15, 20]);
    expect(r[0]?.stamp).toBe("2026-05-24 03:00");
  });

  it("caps the result at the requested limit", async () => {
    for (let i = 0; i < 6; i++) {
      await appendLog(wikiPath, `## [2026-05-24 0${i}:00] lint | ${i} issues — good`);
    }
    const r = await getLintHistory(wikiPath, 3);
    expect(r).toHaveLength(3);
  });
});

describe("lintWiki — log append + previousRun delta", () => {
  it("appends a one-line lint summary to log.md after every run", async () => {
    await seed("a", "A", "[[bogus]]");
    const client = stubClient([noopLlmResponse]);
    await lintWiki({ wikiPath, db, client, model: "stub/lint" });
    const { readFile } = await import("node:fs/promises");
    const log = await readFile(join(wikiPath, "log.md"), "utf8");
    expect(log).toMatch(/## \[.+\] lint \| \d+ issue/);
  });

  it("returns previousRun on the second run, null on the first", async () => {
    await seed("a", "A", "[[bogus]]");
    const client1 = stubClient([noopLlmResponse]);
    const first = await lintWiki({ wikiPath, db, client: client1, model: "stub/lint" });
    expect(first.previousRun).toBeNull();
    const client2 = stubClient([noopLlmResponse]);
    const second = await lintWiki({ wikiPath, db, client: client2, model: "stub/lint" });
    expect(second.previousRun).not.toBeNull();
    expect(second.previousRun?.totalIssues).toBe(first.issues.length);
  });
});
