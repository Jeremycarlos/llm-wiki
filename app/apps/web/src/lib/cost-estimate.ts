import {
  DEFAULT_BAILIAN_BASE_URL,
  estimateCostCents as estimateUsdCostCents,
  estimateCostCny,
  getPricing as getUsdPricing,
  inferBailianPricingRegion,
  type ModelPricing,
} from "@llm-wiki/llm";

export type { ModelPricing };

export function getPricing(model: string): ModelPricing | null {
  if (model.startsWith("bailian/")) return null;
  return getUsdPricing(model);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type CostEstimate = {
  inputTokens: number;
  outputTokens: number;
  costCents: number | null;
  costCny: number | null;
  model: string;
  unknownPricing: boolean;
};

export function estimateCost(
  sourceText: string,
  model: string,
  contextOverhead = 5000,
  expectedOutputTokens = 800,
  bailianBaseUrl = DEFAULT_BAILIAN_BASE_URL,
): CostEstimate {
  const inputTokens = estimateTokens(sourceText) + contextOverhead;
  const isBailian = model.startsWith("bailian/");
  const costCny = isBailian
    ? estimateCostCny(
        model,
        inputTokens,
        expectedOutputTokens,
        inferBailianPricingRegion(bailianBaseUrl),
      )
    : null;
  const costCents = isBailian
    ? null
    : estimateUsdCostCents(model, inputTokens, expectedOutputTokens);
  return {
    inputTokens,
    outputTokens: expectedOutputTokens,
    costCents,
    costCny,
    model,
    unknownPricing: costCents === null && costCny === null,
  };
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatCostCents(cents: number | null): string {
  if (cents === null) return "未知";
  const dollars = cents / 100;
  return `~$${dollars.toFixed(dollars < 1 ? 4 : dollars < 100 ? 3 : 2)}`;
}

export function formatCostCny(yuan: number | null): string {
  if (yuan === null) return "未知";
  return `~¥${yuan.toFixed(yuan < 1 ? 4 : 2)}`;
}
