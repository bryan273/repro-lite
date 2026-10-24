import { client } from './api';
import type { AuditFlag, CheckInput, CheckState } from './agent';

export interface CheckRecord {
  id: number;
  claim: string;
  paper_link?: string | null;
  verdict: string;
  metric?: string | null;
  dataset?: string | null;
  target_value?: number | null;
  measured_value?: number | null;
  rerun_value?: number | null;
  tolerance_pct?: number | null;
  flags?: string | null;
  code?: string | null;
  summary?: string | null;
  tokens_used?: number | null;
  elapsed_ms?: number | null;
  lang?: string | null;
  created_at?: string;
}

export function parseFlags(raw: string | null | undefined): AuditFlag[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as AuditFlag[]) : [];
  } catch {
    return [];
  }
}

/**
 * The generated backend schema rejects explicit nulls for optional fields (HTTP 422),
 * so empty or non-finite values are omitted from the payload instead of sent as null.
 */
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    out[k] = typeof v === 'number' && (k === 'tokens_used' || k === 'elapsed_ms') ? Math.round(v) : v;
  }
  return out;
}

export function apiErrorMessage(e: unknown): string {
  const err = e as { data?: { detail?: unknown }; response?: { data?: { detail?: unknown } }; message?: string };
  const detail = err?.data?.detail ?? err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join('.')}: ${d.msg ?? ''}`).join('; ');
  }
  return err?.message || String(e);
}

export async function saveCheck(input: CheckInput, s: CheckState): Promise<CheckRecord> {
  const res = await client.entities.checks.create({
    data: compact({
      claim: input.claim,
      paper_link: input.paperLink || null,
      verdict: s.verdict ?? 'could_not_run',
      metric: s.contract?.metric ?? null,
      dataset: s.contract?.dataset ?? null,
      target_value: s.contract?.target_value ?? null,
      measured_value: s.measured,
      rerun_value: s.rerun?.value ?? null,
      tolerance_pct: input.tolerancePct,
      flags: JSON.stringify(s.flags),
      code: s.finalCode || null,
      summary: [s.verdictReason, s.agentSummary].filter(Boolean).join('\n\n') || null,
      tokens_used: s.tokens,
      elapsed_ms: s.elapsedMs,
      lang: input.lang,
    }),
  });
  return res.data as CheckRecord;
}

export async function listRecentChecks(limit = 12): Promise<CheckRecord[]> {
  const res = await client.entities.checks.query({ sort: '-created_at', limit });
  return (res.data?.items ?? []) as CheckRecord[];
}

export async function getCheck(checkId: string): Promise<CheckRecord> {
  const res = await client.entities.checks.get({ id: checkId });
  return res.data as CheckRecord;
}
