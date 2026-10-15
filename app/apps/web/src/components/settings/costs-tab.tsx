"use client";

import { useEffect, useState } from "react";
import { uiError, uiLabel } from "@/lib/ui-text";
import { formatCostCents, formatCostCny } from "@/lib/cost-estimate";

type BreakdownRow = {
  model: string;
  operation: "ingest" | "query" | "lint" | "chat";
  call_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_cents: number | null;
  total_cost_cny: number | null;
  priced_cost_cents_calls: number;
  priced_cost_cny_calls: number;
};

type UsageResponse = {
  breakdown: BreakdownRow[];
  totals: {
    cost_cents: number;
    cost_cny: number;
    calls: number;
    input_tokens: number;
    output_tokens: number;
    unknown_cost_cents_calls: number;
    unknown_cost_cny_calls: number;
  };
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function CostsTab() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as UsageResponse;
      setData(json);
    } catch (err) {
      setError(uiError(err));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (error) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!data) return <p className="text-sm text-muted-foreground">加载中…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">用量与费用</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          记录当前知识库的模型调用与 Token 用量，数据保存在{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            .llm-wiki/meta.sqlite
          </code>
          中，请勿将其删除，以免丢失用量记录。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric label="调用次数" value={data.totals.calls.toString()} />
        <Metric label="输入 Token" value={fmtTokens(data.totals.input_tokens)} />
        <Metric label="输出 Token" value={fmtTokens(data.totals.output_tokens)} />
        <Metric label="美元预估" value={formatCostCents(data.totals.cost_cents)} />
        <Metric label="人民币预估" value={formatCostCny(data.totals.cost_cny)} />
      </div>
      {data.totals.unknown_cost_cents_calls + data.totals.unknown_cost_cny_calls > 0 ? (
        <p className="text-xs text-muted-foreground">
          {data.totals.unknown_cost_cents_calls > 0 ? `美元费率未知 ${data.totals.unknown_cost_cents_calls} 次` : ""}
          {data.totals.unknown_cost_cents_calls > 0 && data.totals.unknown_cost_cny_calls > 0 ? "；" : ""}
          {data.totals.unknown_cost_cny_calls > 0 ? `人民币费率未知 ${data.totals.unknown_cost_cny_calls} 次` : ""}
          ，未计入金额；表格会单独标出。
        </p>
      ) : null}

      {data.breakdown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          还没有调用记录。整理资料或提出问题后，可以在这里查看用量。
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">模型</th>
                <th className="px-3 py-2 font-medium">操作</th>
                <th className="px-3 py-2 text-right font-medium">调用次数</th>
                <th className="px-3 py-2 text-right font-medium">输入</th>
                <th className="px-3 py-2 text-right font-medium">输出</th>
                <th className="px-3 py-2 text-right font-medium">费用</th>
              </tr>
            </thead>
            <tbody>
              {data.breakdown.map((r, i) => (
                <tr key={`${r.model}-${uiLabel(r.operation)}-${i}`} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-[12px]">{r.model}</td>
                  <td className="px-3 py-2 capitalize">{uiLabel(r.operation)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.call_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtTokens(r.total_input_tokens)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtTokens(r.total_output_tokens)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.model.startsWith("bailian/")
                      ? r.priced_cost_cny_calls === 0
                        ? "未知"
                        : `${formatCostCny(r.total_cost_cny)}${r.priced_cost_cny_calls < r.call_count ? "（部分未知）" : ""}`
                      : r.priced_cost_cents_calls === 0
                        ? "未知"
                        : `${formatCostCents(r.total_cost_cents)}${r.priced_cost_cents_calls < r.call_count ? "（部分未知）" : ""}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        金额均为预估，美元与人民币分别统计，不相加。百炼按模型、请求输入 Token 阶梯和可识别的 API 地域估算；历史记录按北京标准非思考价回填。未知模型、地域或阶梯不计入合计并显示“未知”。缓存、批量调用、免费额度、优惠及地域差异可能改变实际扣费，请以提供商账单为准。Token 用量按 API 返回记录。
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
