import { callLlm, parseJsonLoose, usageTokens, RateLimitError, type ChatMessage, type ToolCall } from './llm';
import { PySession, RUN_TIMEOUT_MS } from './pyRunner';
import type { Lang } from './i18n';

export type Verdict = 'reproduced' | 'partial' | 'not_reproduced' | 'could_not_run';
export type StepStatus = 'waiting' | 'running' | 'done' | 'failed';

export interface Contract {
  metric: string;
  dataset: string;
  target_value: number | null;
  tolerance_pct: number;
  method: string;
  assumptions: string[];
}

export interface AuditFlag {
  type: string;
  severity: 'serious' | 'minor';
  detail: string;
}

export type TimelineEntry =
  | { kind: 'note'; turn: number; text: string }
  | { kind: 'run'; turn: number; code: string; status: 'running' | 'done'; stdout?: string; stderr?: string; elapsed_ms?: number; ok?: boolean }
  | { kind: 'finish'; turn: number; measured: number | null; summary: string }
  | { kind: 'system'; turn: number; text: string };

export interface CheckState {
  steps: { plan: StepStatus; run: StepStatus; rerun: StepStatus; audit: StepStatus; verdict: StepStatus };
  pythonLoading: boolean;
  contract: Contract | null;
  timeline: TimelineEntry[];
  measured: number | null;
  agentSummary: string;
  finalCode: string;
  rerun: { value: number | null; elapsed_ms: number; stdout: string; stderr: string; diffPct: number | null } | null;
  flags: AuditFlag[];
  auditNote: string;
  verdict: Verdict | null;
  verdictReason: string;
  tokens: number;
  elapsedMs: number;
  error: string | null;
  rateLimited: boolean;
}

export interface CheckInput {
  claim: string;
  paperLink: string;
  tolerancePct: number;
  lang: Lang;
}

export const MAX_TURNS = 10;
export const RERUN_MAX_DIFF_PCT = 1;

export function initialState(): CheckState {
  return {
    steps: { plan: 'waiting', run: 'waiting', rerun: 'waiting', audit: 'waiting', verdict: 'waiting' },
    pythonLoading: false,
    contract: null,
    timeline: [],
    measured: null,
    agentSummary: '',
    finalCode: '',
    rerun: null,
    flags: [],
    auditNote: '',
    verdict: null,
    verdictReason: '',
    tokens: 0,
    elapsedMs: 0,
    error: null,
    rateLimited: false,
  };
}

const langName = (l: Lang) => (l === 'zh' ? 'Simplified Chinese' : 'English');

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'run_python',
      description:
        'Execute Python 3 code in a Pyodide Web Worker (numpy, pandas, scipy, scikit-learn available; no internet, no pip). Returns stdout, stderr and elapsed time. Limit 60 seconds per run.',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string', description: 'Complete Python code to run.' } },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description:
        'Call once the measured value is known. The LAST run_python call must have been the complete, self-contained final script that prints "RESULT: <number>".',
      parameters: {
        type: 'object',
        properties: {
          measured_value: { type: 'number', description: 'The measured metric value printed by the final script.' },
          summary: { type: 'string', description: 'Short honest summary of what was run and found.' },
        },
        required: ['measured_value', 'summary'],
      },
    },
  },
];

export function relDiffPct(a: number, b: number): number {
  const denom = Math.abs(b) > 1e-12 ? Math.abs(b) : 1;
  return (Math.abs(a - b) / denom) * 100;
}

export function parseResultLine(stdout: string): number | null {
  const matches = [...stdout.matchAll(/RESULT:\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/g)];
  if (!matches.length) return null;
  const v = Number(matches[matches.length - 1][1]);
  return Number.isFinite(v) ? v : null;
}

/** Deterministic verdict rules applied after measurement, re-run and audit. */
export function decideVerdict(p: {
  target: number | null;
  measured: number | null;
  tolerancePct: number;
  rerunValue: number | null;
  flags: AuditFlag[];
  lang: Lang;
}): { verdict: Verdict; reason: string } {
  const zh = p.lang === 'zh';
  if (p.measured === null || p.target === null) {
    return {
      verdict: 'could_not_run',
      reason: zh ? '没有得到可用的实测值或目标值。' : 'No usable measured value or target value was obtained.',
    };
  }
  const reasons: string[] = [];
  const err = relDiffPct(p.measured, p.target);
  let level: number; // 3 reproduced, 2 partial, 1 not reproduced
  if (err <= p.tolerancePct) {
    level = 3;
    reasons.push(zh ? `实测与目标相差 ${err.toFixed(2)}%，在容差 ${p.tolerancePct}% 之内。` : `Measured is ${err.toFixed(2)}% from target, within the ${p.tolerancePct}% tolerance.`);
  } else if (err <= p.tolerancePct * 3) {
    level = 2;
    reasons.push(zh ? `实测与目标相差 ${err.toFixed(2)}%，超出容差但在 3 倍容差之内。` : `Measured is ${err.toFixed(2)}% from target: outside tolerance but within 3x tolerance.`);
  } else {
    level = 1;
    reasons.push(zh ? `实测与目标相差 ${err.toFixed(2)}%，远超容差 ${p.tolerancePct}%。` : `Measured is ${err.toFixed(2)}% from target, far outside the ${p.tolerancePct}% tolerance.`);
  }
  if (p.rerunValue === null) {
    if (level === 3) level = 2;
    reasons.push(zh ? '干净重跑未得到数值，不能判定为已复现。' : 'The clean re-run produced no value, so it cannot count as reproduced.');
  } else {
    const d = relDiffPct(p.rerunValue, p.measured);
    if (d > RERUN_MAX_DIFF_PCT) {
      if (level === 3) level = 2;
      reasons.push(zh ? `干净重跑相差 ${d.toFixed(2)}%（> 1%），不能判定为已复现。` : `The clean re-run differs by ${d.toFixed(2)}% (> 1%), so it cannot count as reproduced.`);
    }
  }
  const serious = p.flags.filter((f) => f.severity === 'serious').length;
  if (serious > 0 && level > 1) {
    level -= 1;
    reasons.push(zh ? `审查发现 ${serious} 个严重问题，判定降一级。` : `The audit found ${serious} serious issue(s); the verdict is downgraded one level.`);
  }
  const verdict: Verdict = level === 3 ? 'reproduced' : level === 2 ? 'partial' : 'not_reproduced';
  return { verdict, reason: reasons.join(' ') };
}

function planPrompt(input: CheckInput): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You turn a research claim into a short, fixed verification contract BEFORE any code runs. The check will run in a browser with Pyodide (numpy, pandas, scipy, scikit-learn; no internet downloads, so prefer sklearn built-in datasets like load_breast_cancer, load_wine, load_digits, load_iris, load_diabetes or synthetic data).
Reply with JSON only: {"metric": string, "dataset": string, "target_value": number|null, "method": string, "assumptions": string[]}.
target_value is the number stated in the claim (as a plain number, e.g. 95% -> 0.95 if the metric is a fraction). Use null only if the claim states no number. List 2-5 assumptions you must make (e.g. how labels map for anomaly detection, random seed, preprocessing). Write metric/dataset/method/assumptions text in ${langName(input.lang)}.`,
    },
    {
      role: 'user',
      content: `Claim: ${input.claim}\nPaper link: ${input.paperLink || 'none'}\nTolerance: ${input.tolerancePct}% relative (fixed by the user).`,
    },
  ];
}

function agentSystemPrompt(input: CheckInput, c: Contract): string {
  return `You are Repro Lite, an honest research-claim checking agent. You verify ONE claim by writing and running Python.
Contract (fixed, do not change): metric=${c.metric}; dataset=${c.dataset}; target=${c.target_value}; tolerance=${c.tolerance_pct}% relative; method=${c.method}; assumptions=${c.assumptions.join(' | ')}.
Rules:
- Use the run_python tool. Environment: Pyodide with numpy, pandas, scipy, scikit-learn. No network, no pip, no files. Each run is limited to 60 seconds, so keep compute small.
- Compute the metric honestly from data. Never hard-code or copy the target value, never substitute a different metric, use proper splits/CV as the claim says, and use the method the claim names.
- Use fixed random seeds (random_state=0 or 42).
- Your LAST run_python call before finish must be a COMPLETE, self-contained script (all imports, data loading, model, evaluation) that prints exactly one line "RESULT: <number>" with the measured metric. It will be re-run from scratch in a fresh interpreter.
- Then call finish(measured_value, summary). You have at most ${MAX_TURNS} turns.
- Before each tool call, write one or two short sentences explaining what you are doing. Write all explanations and the summary in ${langName(input.lang)}.`;
}

function auditPrompt(input: CheckInput, c: Contract, code: string, measured: number | null): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `You are a strict code auditor for research-claim checks. Read the final script and flag problems. Check specifically for:
- hard_coded: hard-coded result constants or values that bypass computation
- copied_number: the claimed target number (${c.target_value}) copied into the code or printed instead of computed
- proxy_metric: a different metric than the claimed one (${c.metric})
- wrong_split: evaluation on training data, leakage, or a split/CV that differs from the claim
- swapped_method: a different method/model than the claimed one (${c.method})
Severity "serious" if it can invalidate the result, otherwise "minor". Do not invent issues; an empty list is fine.
Reply with JSON only: {"flags":[{"type":"hard_coded|copied_number|proxy_metric|wrong_split|swapped_method|other","severity":"serious|minor","detail":string}],"note":string}. Write detail and note in ${langName(input.lang)}.`,
    },
    {
      role: 'user',
      content: `Claim: ${input.claim}\nMeasured value: ${measured}\n\nFinal script:\n\`\`\`python\n${code}\n\`\`\``,
    },
  ];
}

function normalizeContract(raw: Partial<Contract> | null, tol: number): Contract | null {
  if (!raw) return null;
  const tv = raw.target_value === null || raw.target_value === undefined ? null : Number(raw.target_value);
  return {
    metric: String(raw.metric ?? ''),
    dataset: String(raw.dataset ?? ''),
    target_value: tv !== null && Number.isFinite(tv) ? tv : null,
    tolerance_pct: tol,
    method: String(raw.method ?? ''),
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String) : [],
  };
}

function safeArgs(tc: ToolCall): Record<string, unknown> {
  try {
    return JSON.parse(tc.function.arguments || '{}');
  } catch {
    return {};
  }
}

/** Runs the full Plan -> Write and run -> Clean re-run -> Audit -> Verdict pipeline. */
export async function runCheck(
  input: CheckInput,
  onUpdate: (s: CheckState) => void,
  signal: AbortSignal,
): Promise<CheckState> {
  let s = initialState();
  const t0 = performance.now();
  const set = (patch: Partial<CheckState>) => {
    s = { ...s, ...patch, elapsedMs: Math.round(performance.now() - t0) };
    onUpdate(s);
  };
  const setStep = (k: keyof CheckState['steps'], v: StepStatus) => set({ steps: { ...s.steps, [k]: v } });
  const push = (e: TimelineEntry) => set({ timeline: [...s.timeline, e] });
  const replaceLast = (e: TimelineEntry) => set({ timeline: [...s.timeline.slice(0, -1), e] });
  const zh = input.lang === 'zh';

  const session = new PySession();
  const fresh = new PySession();
  const abortErr = () => new DOMException('aborted', 'AbortError');

  const finalize = (verdict: Verdict, reason: string) => {
    set({ verdict, verdictReason: reason, steps: { ...s.steps, verdict: 'done' } });
  };

  try {
    // Warm the Python runtime in parallel with planning; load time is not counted against the 60 s limit.
    set({ pythonLoading: true });
    const pyReady = session.init().finally(() => set({ pythonLoading: false }));
    pyReady.catch(() => undefined);

    // Step 1: Plan
    setStep('plan', 'running');
    const planRes = await callLlm({ messages: planPrompt(input), jsonMode: true, maxTokens: 800, signal });
    set({ tokens: s.tokens + usageTokens(planRes) });
    const contract = normalizeContract(parseJsonLoose<Partial<Contract>>(planRes.message.content), input.tolerancePct);
    if (!contract) throw new Error(zh ? '无法解析检验契约。' : 'Could not parse the verification contract.');
    set({ contract });
    setStep('plan', 'done');

    // Step 2: Agent loop
    setStep('run', 'running');
    try {
      await pyReady;
    } catch (e) {
      setStep('run', 'failed');
      set({ error: e instanceof Error ? e.message : String(e) });
      finalize('could_not_run', zh ? 'Python 运行环境加载失败。' : 'The Python runtime failed to load.');
      return s;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: agentSystemPrompt(input, contract) },
      { role: 'user', content: `Claim: ${input.claim}\nPaper: ${input.paperLink || 'none'}\nStart now.` },
    ];
    let finished = false;
    let lastRunCode = '';
    let lastRunValue: number | null = null;

    for (let turn = 1; turn <= MAX_TURNS && !finished; turn++) {
      if (signal.aborted) throw abortErr();
      const res = await callLlm({ messages, tools: TOOLS, maxTokens: 2000, signal });
      set({ tokens: s.tokens + usageTokens(res) });
      const msg = res.message;
      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls?.length ? msg.tool_calls : undefined });
      if (msg.content?.trim()) push({ kind: 'note', turn, text: msg.content.trim() });

      if (!msg.tool_calls?.length) {
        messages.push({
          role: 'user',
          content: 'Please continue by calling run_python, or call finish if the final script already printed RESULT.',
        });
        continue;
      }

      for (const tc of msg.tool_calls) {
        if (signal.aborted) throw abortErr();
        const args = safeArgs(tc);
        if (tc.function.name === 'run_python') {
          const code = String(args.code ?? '');
          push({ kind: 'run', turn, code, status: 'running' });
          const r = await session.run(code, RUN_TIMEOUT_MS);
          replaceLast({ kind: 'run', turn, code, status: 'done', ...r });
          lastRunCode = code;
          lastRunValue = r.ok ? parseResultLine(r.stdout) : null;
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: r.ok, stdout: r.stdout, stderr: r.stderr, elapsed_ms: r.elapsed_ms }),
          });
        } else if (tc.function.name === 'finish') {
          const mv = Number(args.measured_value);
          const measured = Number.isFinite(mv) ? mv : null;
          const summary = String(args.summary ?? '');
          push({ kind: 'finish', turn, measured, summary });
          messages.push({ role: 'tool', tool_call_id: tc.id, content: '{"ok":true}' });
          set({ measured, agentSummary: summary, finalCode: lastRunCode });
          finished = true;
        } else {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: '{"error":"unknown tool"}' });
        }
      }
    }
    session.terminate();

    if (!finished || !s.finalCode) {
      setStep('run', 'failed');
      push({ kind: 'system', turn: MAX_TURNS, text: zh ? '智能体在轮数上限内没有完成。' : 'The agent did not finish within the turn limit.' });
      finalize('could_not_run', zh ? `智能体在 ${MAX_TURNS} 轮内没有给出最终结果。` : `The agent did not produce a final result within ${MAX_TURNS} turns.`);
      return s;
    }
    if (lastRunValue !== null && s.measured !== null && relDiffPct(s.measured, lastRunValue) > 0.01) {
      push({
        kind: 'system',
        turn: MAX_TURNS,
        text: zh
          ? `注意：finish 报告的值 ${s.measured} 与最终脚本打印的 RESULT ${lastRunValue} 不一致，采用脚本打印的值。`
          : `Note: finish reported ${s.measured} but the final script printed RESULT ${lastRunValue}; the printed value is used.`,
      });
      set({ measured: lastRunValue });
    }
    setStep('run', 'done');

    // Step 3: Clean re-run in a fresh worker
    setStep('rerun', 'running');
    let rerunValue: number | null = null;
    try {
      const r = await fresh.run(s.finalCode, RUN_TIMEOUT_MS);
      rerunValue = r.ok ? parseResultLine(r.stdout) : null;
      set({
        rerun: {
          value: rerunValue,
          elapsed_ms: r.elapsed_ms,
          stdout: r.stdout,
          stderr: r.stderr,
          diffPct: rerunValue !== null && s.measured !== null ? relDiffPct(rerunValue, s.measured) : null,
        },
      });
      setStep('rerun', rerunValue === null ? 'failed' : 'done');
    } catch (e) {
      set({ rerun: { value: null, elapsed_ms: 0, stdout: '', stderr: e instanceof Error ? e.message : String(e), diffPct: null } });
      setStep('rerun', 'failed');
    } finally {
      fresh.terminate();
    }

    // Step 4: Audit
    setStep('audit', 'running');
    if (signal.aborted) throw abortErr();
    const auditRes = await callLlm({ messages: auditPrompt(input, contract, s.finalCode, s.measured), jsonMode: true, maxTokens: 1200, signal });
    set({ tokens: s.tokens + usageTokens(auditRes) });
    const audit = parseJsonLoose<{ flags?: AuditFlag[]; note?: string }>(auditRes.message.content);
    const flags: AuditFlag[] = (audit?.flags ?? []).map((f) => ({
      type: String(f.type ?? 'other'),
      severity: f.severity === 'serious' ? 'serious' : 'minor',
      detail: String(f.detail ?? ''),
    }));
    set({ flags, auditNote: String(audit?.note ?? '') });
    setStep('audit', audit ? 'done' : 'failed');

    // Step 5: Verdict
    const v = decideVerdict({
      target: contract.target_value,
      measured: s.measured,
      tolerancePct: input.tolerancePct,
      rerunValue,
      flags,
      lang: input.lang,
    });
    finalize(v.verdict, v.reason);
    return s;
  } catch (e) {
    session.terminate();
    fresh.terminate();
    const steps = { ...s.steps };
    (Object.keys(steps) as (keyof CheckState['steps'])[]).forEach((k) => {
      if (steps[k] === 'running') steps[k] = 'failed';
    });
    if (e instanceof RateLimitError) {
      set({ steps, rateLimited: true, error: 'rate_limited' });
    } else if (e instanceof DOMException && e.name === 'AbortError') {
      set({ steps, error: 'aborted' });
    } else {
      set({ steps, error: e instanceof Error ? e.message : String(e) });
    }
    if (s.error !== 'aborted' && !s.rateLimited) {
      finalize('could_not_run', s.error || '');
    }
    return s;
  }
}

const VERDICT_LABEL: Record<Lang, Record<Verdict, string>> = {
  en: { reproduced: 'Reproduced', partial: 'Partially reproduced', not_reproduced: 'Not reproduced', could_not_run: 'Could not run' },
  zh: { reproduced: '已复现', partial: '部分复现', not_reproduced: '未复现', could_not_run: '无法运行' },
};

export function verdictLabel(lang: Lang, v: string): string {
  return VERDICT_LABEL[lang][v as Verdict] ?? v;
}

export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '-';
  return Math.abs(v) >= 100 ? v.toFixed(2) : Number(v.toPrecision(4)).toString();
}

export function buildReport(input: CheckInput, s: CheckState): string {
  const zh = input.lang === 'zh';
  const L = (en: string, cn: string) => (zh ? cn : en);
  const c = s.contract;
  const lines: string[] = [
    `# Repro Lite ${L('report', '报告')}`,
    '',
    `**${L('Claim', '结论')}:** ${input.claim}`,
    input.paperLink ? `**${L('Paper', '论文')}:** ${input.paperLink}` : '',
    `**${L('Date', '日期')}:** ${new Date().toISOString()}`,
    '',
    `## ${L('Verdict', '判定')}: ${s.verdict ? verdictLabel(input.lang, s.verdict) : '-'}`,
    '',
    s.verdictReason,
    '',
    `| ${L('Item', '项目')} | ${L('Value', '数值')} |`,
    '|---|---|',
    `| ${L('Target', '目标值')} | ${fmtNum(c?.target_value)} |`,
    `| ${L('Measured', '实测值')} | ${fmtNum(s.measured)} |`,
    `| ${L('Clean re-run', '干净重跑')} | ${fmtNum(s.rerun?.value)} |`,
    `| ${L('Tolerance', '容差')} | ${input.tolerancePct}% |`,
    `| ${L('Tokens used', 'Token 用量')} | ${s.tokens} |`,
    `| ${L('Elapsed', '耗时')} | ${(s.elapsedMs / 1000).toFixed(1)} s |`,
    '',
    `## ${L('Contract', '检验契约')}`,
    '',
    `- ${L('Metric', '指标')}: ${c?.metric ?? '-'}`,
    `- ${L('Dataset', '数据集')}: ${c?.dataset ?? '-'}`,
    `- ${L('Method', '方法')}: ${c?.method ?? '-'}`,
    ...(c?.assumptions ?? []).map((a) => `- ${L('Assumption', '假设')}: ${a}`),
    '',
    `## ${L('Audit flags', '审查标记')}`,
    '',
    ...(s.flags.length ? s.flags.map((f) => `- [${f.severity}] ${f.type}: ${f.detail}`) : [L('No issues flagged.', '未发现问题。')]),
    s.auditNote ? `\n${s.auditNote}` : '',
    '',
    `## ${L('Agent summary', '智能体摘要')}`,
    '',
    s.agentSummary || '-',
    '',
    `## ${L('Final code', '最终代码')}`,
    '',
    '```python',
    s.finalCode || '',
    '```',
    '',
    `> ${L(
      'It checks the claim on a small scale in your browser; it does not replace a full reproduction.',
      '它只在你的浏览器中做小规模核查，不能替代完整复现。',
    )}`,
    '',
  ];
  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
