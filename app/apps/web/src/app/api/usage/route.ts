import { NextResponse } from "next/server";

import { getTotalCostCents, getTotalCostCny, getUsageBreakdown } from "@llm-wiki/core";

import { openWikiContext } from "@/lib/server-wiki";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await openWikiContext();
  try {
    const breakdown = getUsageBreakdown(ctx.db);
    const totalCostCents = getTotalCostCents(ctx.db);
    const totalCostCny = getTotalCostCny(ctx.db);
    const totalCalls = breakdown.reduce((sum, r) => sum + r.call_count, 0);
    const totalInputTokens = breakdown.reduce((sum, r) => sum + r.total_input_tokens, 0);
    const totalOutputTokens = breakdown.reduce((sum, r) => sum + r.total_output_tokens, 0);
    return NextResponse.json({
      breakdown,
      totals: {
        cost_cents: totalCostCents,
        cost_cny: totalCostCny,
        calls: totalCalls,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        unknown_cost_cents_calls: breakdown
          .filter((row) => !row.model.startsWith("bailian/"))
          .reduce((sum, row) => sum + row.call_count - row.priced_cost_cents_calls, 0),
        unknown_cost_cny_calls: breakdown
          .filter((row) => row.model.startsWith("bailian/"))
          .reduce((sum, row) => sum + row.call_count - row.priced_cost_cny_calls, 0),
      },
    });
  } finally {
    ctx.db.close();
  }
}
