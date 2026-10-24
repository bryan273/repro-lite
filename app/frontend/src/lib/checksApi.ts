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

export async function saveCheck(input: CheckInput, s: CheckState): Promise<CheckRecord> {
  const res = await client.entities.checks.create({
    data: {
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
    },
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
