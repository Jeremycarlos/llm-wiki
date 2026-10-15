const LABELS: Record<string, string> = {
  ingest: "资料整理",
  query: "知识问答",
  chat: "AI 对话",
  lint: "知识检查",
  vision: "图片理解",
  overview: "综述",
  concept: "概念",
  entity: "实体",
  comparison: "比较",
  source: "资料来源",
  high: "高",
  medium: "中",
  low: "低",
  excellent: "优秀",
  good: "良好",
  fair: "尚可",
  "needs-work": "需要完善",
  contradiction: "内容矛盾",
  orphan: "孤立知识页",
  "missing-page": "缺失知识页",
  "broken-link": "失效链接",
  gap: "知识缺口",
  stale: "可能过时",
  light: "浅色",
  dark: "深色",
  auto: "跟随系统",
  local: "本地检查",
  llm: "AI 检查",
  inbox: "收件箱",
  pinned: "已置顶",
  archive: "归档",
  user: "我",
  assistant: "AI 助手",
  pending: "待处理",
  paste: "粘贴文本",
  url: "网页链接",
  file: "上传文件",
  "Untitled chat": "未命名对话",
};

export function uiLabel(value: string): string {
  return LABELS[value] ?? value;
}

// 只转换应用生成的结构化记录，原始日志与自由文本不变。
export function displayLogEntry(entry: string): string {
  const operations: Record<string, string> = {
    ingest: "资料整理",
    edit: "编辑知识页",
    schema: "知识规范",
    create: "创建知识页",
    delete: "移入回收目录",
    restore: "恢复知识页",
  };
  return entry
    .replace(
      /^## \[([^\]]+)\] lint \| (\d+) issues?(?:\s*—\s*([a-z-]+))?\s*$/m,
      (_all, date: string, count: string, health?: string) =>
        `## [${date}] 知识检查 | ${count} 个问题${health ? ` — ${uiLabel(health)}` : ""}`,
    )
    .replace(
      /^- (\d+) high, (\d+) medium, (\d+) low across (\d+) pages?$/m,
      "- 高 $1 项，中 $2 项，低 $3 项；共检查 $4 篇知识页",
    )
    .replace(
      /^## (\[[^\]]+\]) (ingest|edit|schema|create|delete|restore) \| /m,
      (_all, date: string, operation: string) => `## ${date} ${operations[operation]} | `,
    );
}

export function uiError(value: unknown): string {
  const text = String(value instanceof Error ? value.message : value).replace(
    /\bsk-[A-Za-z0-9_-]+\b/g,
    "[密钥已隐藏]",
  );
  if (/[\u4e00-\u9fff]/.test(text)) return text;
  if (/429|rate.?limit/i.test(text)) return "已达到模型调用限制，请稍后重试。";
  if (/401|403|api.?key|unauthoriz/i.test(text))
    return "模型鉴权失败，请检查 API 密钥、地域和访问权限。";
  if (/json|schema validation/i.test(text)) return "模型返回的数据格式不正确，请重试或更换模型。";
  if (/context|too large|too long/i.test(text))
    return "内容超过模型可处理的长度，请拆分资料后重试。";
  if (/network|fetch|connection|timeout|HTTP 5/i.test(text))
    return "暂时无法连接服务，请检查网络后重试。";
  if (/not found|not available|unknown model|404/i.test(text))
    return "未找到所需内容或模型，请检查配置后重试。";
  if (/exists|duplicate/i.test(text)) return "相同标识的内容已存在，请换一个名称。";
  return "本次操作未完成，请检查输入和模型配置后重试。";
}
