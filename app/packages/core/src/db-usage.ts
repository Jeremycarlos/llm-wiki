import { estimateCostCents, estimateCostCny } from "@llm-wiki/llm";

import type { Db } from "./db";
import { OPERATIONS, type Operation, type UsageInsert, type UsageRow } from "./types";

type UsageRowDb = {
  id: number;
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_cents: number | null;
  cost_cny: number | null;
  created_at: string;
};

function rowFromDb(r: UsageRowDb): UsageRow {
  if (!OPERATIONS.includes(r.operation as Operation)) {
    throw new Error(`usage.${r.id}: unknown operation in DB: ${r.operation}`);
  }
  return { ...r, operation: r.operation as Operation };
}

export function insertUsage(db: Db, entry: UsageInsert): number {
  const info = db
    .prepare(
      `INSERT INTO usage (operation, model, input_tokens, output_tokens, cost_cents, cost_cny, created_at)
       VALUES (@operation, @model, @input_tokens, @output_tokens, @cost_cents, @cost_cny, @created_at)`,
    )
    .run({ ...entry, cost_cny: entry.cost_cny ?? null });
  return info.lastInsertRowid as number;
}

export function listUsageRows(db: Db, limit = 100): UsageRow[] {
  const rows = db
    .prepare(`SELECT * FROM usage ORDER BY id DESC LIMIT ?`)
    .all(limit) as UsageRowDb[];
  return rows.map(rowFromDb);
}

/**
 * Backfill known USD and CNY estimates for usage rows missing them. Cheap and idempotent:
 * picks up only rows with NULL cost (caps at one pricing-table lookup
 * each), so safe to call on every DB open. Exists because pre-2026-05-24
 * builds hard-coded `cost_cents: null` at every insertUsage site — once
 * those were fixed, this backfills the historical rows so the dashboard
 * cumulative reflects real spend instead of just spend since the fix.
 *
 * Rows whose model isn't in the pricing table stay NULL (estimateCostCents
 * returns null), so a future pricing-table update can re-run the backfill
 * and pick them up too.
 */
export function backfillUsageCosts(db: Db): number {
  const rows = db
    .prepare(
      `SELECT id, model, input_tokens, output_tokens FROM usage
        WHERE (cost_cents IS NULL AND model NOT LIKE 'bailian/%')
           OR (cost_cny IS NULL AND model LIKE 'bailian/%')`,
    )
    .all() as Array<{ id: number; model: string; input_tokens: number; output_tokens: number }>;
  if (rows.length === 0) return 0;
  const update = db.prepare(
    `UPDATE usage
        SET cost_cents = COALESCE(?, cost_cents), cost_cny = COALESCE(?, cost_cny)
      WHERE id = ?`,
  );
  let updated = 0;
  const tx = db.transaction(() => {
    for (const r of rows) {
      const cents = estimateCostCents(r.model, r.input_tokens, r.output_tokens);
      const cny = r.model.startsWith("bailian/")
        ? estimateCostCny(r.model, r.input_tokens, r.output_tokens, "beijing")
        : null;
      if (cents === null && cny === null) continue;
      update.run(cents, cny, r.id);
      updated++;
    }
  });
  tx();
  return updated;
}

export function getTotalCostCents(db: Db): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(cost_cents), 0) AS total FROM usage`)
    .get() as { total: number };
  return row.total;
}

export function getTotalCostCny(db: Db): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(cost_cny), 0) AS total FROM usage`)
    .get() as { total: number };
  return row.total;
}

export type UsageBreakdownRow = {
  model: string;
  operation: Operation;
  call_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_cents: number | null;
  total_cost_cny: number | null;
  priced_cost_cents_calls: number;
  priced_cost_cny_calls: number;
};

/**
 * Aggregates usage by (model, operation) for the Costs tab. Returns rows
 * sorted by total token count descending so the heaviest hitters surface
 * first. Amounts stay null when no row in that currency has known pricing.
 */
export function getUsageBreakdown(db: Db): UsageBreakdownRow[] {
  const rows = db
    .prepare(
      `SELECT model,
              operation,
              COUNT(*) AS call_count,
              COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
              COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
              SUM(cost_cents) AS total_cost_cents,
              SUM(cost_cny) AS total_cost_cny,
              COUNT(cost_cents) AS priced_cost_cents_calls,
              COUNT(cost_cny) AS priced_cost_cny_calls
         FROM usage
        GROUP BY model, operation
        ORDER BY (total_input_tokens + total_output_tokens) DESC`,
    )
    .all() as Array<{
    model: string;
    operation: string;
    call_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost_cents: number | null;
    total_cost_cny: number | null;
    priced_cost_cents_calls: number;
    priced_cost_cny_calls: number;
  }>;
  return rows.map((r) => {
    if (!OPERATIONS.includes(r.operation as Operation)) {
      throw new Error(`usage breakdown: unknown operation ${r.operation}`);
    }
    return { ...r, operation: r.operation as Operation };
  });
}
