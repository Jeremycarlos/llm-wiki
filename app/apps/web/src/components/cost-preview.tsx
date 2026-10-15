"use client";

import { estimateCost, formatCostCents, formatCostCny, formatTokens } from "@/lib/cost-estimate";

type Props = {
  text: string;
  model: string;
  provider?: string;
  /** Extra input tokens from system + index + relevant pages. */
  contextOverhead?: number;
  /** Typical response size for this operation. */
  expectedOutputTokens?: number;
  bailianBaseUrl?: string;
};

export function CostPreview({ text, model, provider, contextOverhead, expectedOutputTokens, bailianBaseUrl }: Props) {
  if (!text.trim()) {
    return (
      <p className="text-xs text-muted-foreground">
        输入内容后，可在这里查看 Token 用量估算。
      </p>
    );
  }
  const est = estimateCost(
    text,
    provider === "bailian" ? `bailian/${model}` : model,
    contextOverhead,
    expectedOutputTokens,
    bailianBaseUrl,
  );
  const displayCost = provider === "bailian" ? formatCostCny(est.costCny) : formatCostCents(est.costCents);
  return (
    <p className="text-xs text-muted-foreground">
      预计费用：{" "}
      <strong className="text-foreground">{displayCost}</strong>{" "}
      <span className="tabular-nums">
        （输入 {formatTokens(est.inputTokens)} / 输出 {formatTokens(est.outputTokens)} Token）
      </span>{" "}
      · <code>{est.model}</code>
      {est.unknownPricing ? (
        <span className="ml-1">单价未知，以提供商账单为准</span>
      ) : null}
    </p>
  );
}
