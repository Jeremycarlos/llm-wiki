import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { NAV_GROUPS, isCurrentRoute, pageTitle } from "../apps/web/src/lib/navigation";
import { displayLogEntry, uiError, uiLabel } from "../apps/web/src/lib/ui-text";
import { estimateCost, formatCostCents, formatCostCny } from "../apps/web/src/lib/cost-estimate";

describe("中文工作台导航", () => {
  it("详情页沿用所属模块，根路由不会误选所有页面", () => {
    expect(pageTitle("/wiki/example/history")).toBe("知识库");
    expect(pageTitle("/chats/example")).toBe("AI 对话");
    expect(isCurrentRoute("/wiki/example", "/")).toBe(false);
    expect(isCurrentRoute("/wikipedia", "/wiki")).toBe(false);
    const items = NAV_GROUPS.flatMap((group) => [...group.items]);
    expect(new Set(items.map((item) => item.href)).size).toBe(items.length);
    expect(items.every((item) => /[\u4e00-\u9fff]/.test(item.label))).toBe(true);
  });
});

describe("中文显示与数据契约分离", () => {
  it("日志只转换结构化操作名称，自由正文和原始记录保持不变", () => {
    const original =
      "## [2026-10-14 10:00] lint | 2 issues — fair\n- 1 high, 1 medium, 0 low across 3 pages\nMy own text stays unchanged.";
    const rendered = displayLogEntry(original);
    expect(rendered).toContain("知识检查 | 2 个问题 — 尚可");
    expect(rendered).toContain("My own text stays unchanged.");
    expect(original).toContain("lint | 2 issues — fair");
  });
  it("未知名称保持原样，已知状态使用中文", () => {
    expect(uiLabel("needs-work")).toBe("需要完善");
    expect(uiLabel("vision")).toBe("图片理解");
    expect(uiLabel("my-custom-folder")).toBe("my-custom-folder");
  });

  it.each([
    "apps/web/src/components/settings/models-tab.tsx",
    "apps/web/src/components/wiki/page-editor.tsx",
    "apps/web/src/components/chats/promote-message.tsx",
  ])("选择器 %s 的提交值不使用翻译后的标签", async (file) => {
    const text = await readFile(resolve(file), "utf8");
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const values: string[] = [];
    function walk(node: ts.Node) {
      if (ts.isJsxAttribute(node) && node.name.getText(ast) === "value")
        values.push(node.getText(ast));
      ts.forEachChild(node, walk);
    }
    walk(ast);
    expect(values.length).toBeGreaterThan(0);
    expect(values.some((value) => value.includes("uiLabel"))).toBe(false);
  });
});

describe("可理解的错误与未知费用", () => {
  it("鉴权、格式和网络错误提供中文恢复提示", () => {
    expect(uiError(new Error("HTTP 401"))).toContain("鉴权失败");
    expect(uiError(new Error("schema validation failed"))).toContain("格式不正确");
    expect(uiError(new Error("fetch failed"))).toContain("网络");
    expect(uiError(new Error("unrecognized exception"))).toContain("重试");
  });
  it("中文错误中也会遮盖可能回显的密钥", () => {
    const result = uiError("连接失败：sk-unit-private-value");
    expect(result).not.toContain("sk-unit-private-value");
    expect(result).toContain("密钥已隐藏");
  });
  it("百炼人民币预估与美元分开，未知模型保持未知", () => {
    expect(formatCostCents(null)).toBe("未知");
    expect(estimateCost("合成样例", "bailian/openai/gpt-4o-mini").costCents).toBeNull();
    const estimate = estimateCost("合成样例", "bailian/qwen-plus", 5000, 800);
    expect(estimate.costCents).toBeNull();
    expect(estimate.costCny).not.toBeNull();
    expect(formatCostCny(0.023988)).toBe("~¥0.0240");
    expect(estimateCost("样例", "bailian/qwen-plus", 5000, 800, "https://custom.example/compatible-mode/v1").costCny).toBeNull();
  });
});
