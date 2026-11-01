import type { ReactNode } from 'react';
import { AlertTriangle, Check, Download, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePrefs, type TKey } from '@/lib/i18n';
import { fmtNum, verdictLabel, type CheckState, type StepStatus } from '@/lib/agent';
import { cn } from '@/lib/utils';
import { CodeBlock, Stat, VerdictBadge, verdictTone } from './Shell';

function StatusDot({ status, n }: { status: StepStatus; n: number }) {
  const base = 'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold';
  if (status === 'running') return <span className={cn(base, 'border-primary bg-card text-primary')}><Loader2 className="h-4 w-4 animate-spin" /></span>;
  if (status === 'done') return <span className={cn(base, 'border-primary bg-primary text-primary-foreground')}><Check className="h-4 w-4" /></span>;
  if (status === 'failed') return <span className={cn(base, 'border-destructive bg-card text-destructive')}><X className="h-4 w-4" /></span>;
  return <span className={cn(base, 'border-border bg-card text-muted-foreground')}>{n}</span>;
}

function Step({ n, status, title, desc, children, last }: { n: number; status: StepStatus; title: string; desc: string; children?: ReactNode; last?: boolean }) {
  const { t } = usePrefs();
  const statusKey: Record<StepStatus, TKey> = { waiting: 'waiting', running: 'inProgress', done: 'done', failed: 'failed' };
  return (
    <section className="relative flex gap-4 sm:gap-5">
      {!last && <span className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-border" aria-hidden />}
      <StatusDot status={status} n={n} />
      <div className="min-w-0 flex-1 pb-10">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-xl">{title}</h3>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t(statusKey[status])}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
        {children && <div className="mt-4 space-y-3">{children}</div>}
      </div>
    </section>
  );
}

const card = 'rounded-2xl border border-border bg-card p-4 shadow-[0_8px_24px_rgba(16,24,40,0.06)] sm:p-5';

export function RunView({ state, onDownload }: { state: CheckState; onDownload: () => void }) {
  const { t, lang } = usePrefs();
  const c = state.contract;
  return (
    <div>
      {state.rateLimited && (
        <div className="mb-8 flex gap-3 rounded-2xl border border-[#B45309]/30 bg-[#B45309]/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
          <span>{t('rateLimited')}</span>
        </div>
      )}
      {state.error && !state.rateLimited && state.error === 'aborted' && (
        <div className="mb-8 rounded-2xl border border-border bg-muted p-4 text-sm">{t('stopped')}</div>
      )}

      <Step n={1} status={state.steps.plan} title={t('stepPlan')} desc={t('stepPlanDesc')}>
        {c && (
          <div className={card}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label={t('metric')} value={c.metric || '-'} />
              <Stat label={t('dataset')} value={c.dataset || '-'} />
              <Stat label={t('target')} value={fmtNum(c.target_value)} />
              <Stat label={t('tolerance')} value={`${c.tolerance_pct}%`} />
            </div>
            {c.method && <p className="mt-4 text-sm"><span className="text-muted-foreground">{t('method')}: </span>{c.method}</p>}
            {c.assumptions.length > 0 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('assumptions')}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {c.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Step>

      <Step n={2} status={state.steps.run} title={t('stepRun')} desc={t('stepRunDesc')}>
        {state.pythonLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('loadingPython')}</div>
        )}
        {state.timeline.map((e, i) => {
          if (e.kind === 'note') return (
            <div key={i} className="text-sm leading-relaxed"><span className="mr-2 text-xs uppercase tracking-wide text-muted-foreground">{t('turn')} {e.turn}</span><span className="whitespace-pre-wrap">{e.text}</span></div>
          );
          if (e.kind === 'system') return <div key={i} className="rounded-lg border border-border bg-muted p-3 text-sm">{e.text}</div>;
          if (e.kind === 'finish') return (
            <div key={i} className={cn(card, 'border-primary/40')}>
              <div className="font-code text-xs text-primary">finish(measured_value={fmtNum(e.measured)})</div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{e.summary}</p>
            </div>
          );
          return (
            <div key={i} className={card}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-code text-xs text-primary">run_python</span>
                <span className="tnum text-xs text-muted-foreground">
                  {e.status === 'running' ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />{t('inProgress')}</span> : `${t('elapsed')} ${((e.elapsed_ms ?? 0) / 1000).toFixed(2)} s`}
                </span>
              </div>
              <details open={i === state.timeline.length - 1 || e.status === 'running'}>
                <summary className="cursor-pointer text-xs uppercase tracking-wide text-muted-foreground">{t('code')}</summary>
                <CodeBlock code={e.code} className="mt-2" />
              </details>
              {e.status === 'done' && (
                <div className="mt-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('output')}</div>
                  <CodeBlock code={e.stdout || (e.stderr ? '' : t('noOutput'))} className={cn('mt-2 bg-background', !e.stdout && !e.stderr && 'text-muted-foreground', !e.stdout && e.stderr && 'hidden')} />
                  {e.stderr && <CodeBlock code={e.stderr} className="mt-2 bg-background text-[#C62828] dark:text-[#EF7A73]" />}
                </div>
              )}
            </div>
          );
        })}
      </Step>

      <Step n={3} status={state.steps.rerun} title={t('stepRerun')} desc={t('stepRerunDesc')}>
        {state.rerun && (
          <div className={card}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label={t('measured')} value={fmtNum(state.measured)} />
              <Stat label={t('rerun')} value={fmtNum(state.rerun.value)} />
              <Stat label={t('rerunDiff')} value={state.rerun.diffPct === null ? '-' : `${state.rerun.diffPct.toFixed(3)}%`} />
              <Stat label={t('elapsed')} value={`${(state.rerun.elapsed_ms / 1000).toFixed(2)} s`} />
            </div>
            <p className="mt-4 text-sm">
              {state.rerun.value === null ? t('rerunNoValue') : (state.rerun.diffPct ?? 0) > 1 ? t('rerunMismatch') : t('rerunOk')}
            </p>
            {state.rerun.value === null && state.rerun.stderr && <CodeBlock code={state.rerun.stderr} className="mt-3 text-[#C62828] dark:text-[#EF7A73]" />}
          </div>
        )}
      </Step>

      <Step n={4} status={state.steps.audit} title={t('stepAudit')} desc={t('stepAuditDesc')}>
        {state.steps.audit === 'done' || state.steps.audit === 'failed' ? (
          <div className={card}>
            <FlagList flags={state.flags} />
            {state.auditNote && <p className="mt-3 text-sm text-muted-foreground">{state.auditNote}</p>}
          </div>
        ) : null}
      </Step>

      <Step n={5} status={state.steps.verdict} title={t('stepVerdict')} desc="" last>
        {state.verdict && (
          <div className={cn('rounded-2xl border-2 bg-card p-5 sm:p-6', verdictTone(state.verdict).split(' ').filter((x) => x.includes('border')).join(' '))}>
            <VerdictBadge verdict={state.verdict} label={verdictLabel(lang, state.verdict)} large />
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label={t('measured')} value={fmtNum(state.measured)} />
              <Stat label={t('target')} value={fmtNum(c?.target_value)} />
              <Stat label={t('tolerance')} value={`${c?.tolerance_pct ?? '-'}%`} />
              <Stat label={t('tokens')} value={state.tokens.toLocaleString()} />
              <Stat label={t('totalTime')} value={`${(state.elapsedMs / 1000).toFixed(1)} s`} />
            </div>
            {state.verdictReason && (
              <div className="mt-5">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('reason')}</div>
                <p className="mt-1 text-sm">{state.verdictReason}</p>
              </div>
            )}
            {state.flags.length > 0 && <div className="mt-4"><FlagList flags={state.flags} /></div>}
            <Button onClick={onDownload} className="mt-6 h-10 gap-2"><Download className="h-4 w-4" />{t('download')}</Button>
          </div>
        )}
      </Step>
    </div>
  );
}

export function FlagList({ flags }: { flags: CheckState['flags'] }) {
  const { t } = usePrefs();
  if (!flags.length) return <p className="text-sm">{t('noFlags')}</p>;
  return (
    <ul className="space-y-2">
      {flags.map((f, i) => (
        <li key={i} className="flex flex-wrap items-start gap-2 text-sm">
          <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', f.severity === 'serious' ? verdictTone('not_reproduced') : verdictTone('partial'))}>
            {f.severity === 'serious' ? t('serious') : t('minor')}
          </span>
          <span className="font-code text-xs leading-6 text-muted-foreground">{f.type}</span>
          <span className="min-w-0 flex-1 basis-full sm:basis-auto">{f.detail}</span>
        </li>
      ))}
    </ul>
  );
}
