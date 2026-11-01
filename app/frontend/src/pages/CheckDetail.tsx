import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeBlock, Shell, Stat, VerdictBadge } from '@/components/Shell';
import { FlagList } from '@/components/RunView';
import { usePrefs } from '@/lib/i18n';
import { downloadText, fmtNum, verdictLabel } from '@/lib/agent';
import { getCheck, parseFlags, type CheckRecord } from '@/lib/checksApi';

function recordReport(r: CheckRecord, lang: 'en' | 'zh'): string {
  const flags = parseFlags(r.flags);
  return [
    '# Repro Lite report',
    '',
    `**Claim:** ${r.claim}`,
    r.paper_link ? `**Paper:** ${r.paper_link}` : '',
    `**Verdict:** ${verdictLabel(lang, r.verdict)}`,
    '',
    `- Metric: ${r.metric ?? '-'}`,
    `- Dataset: ${r.dataset ?? '-'}`,
    `- Target: ${fmtNum(r.target_value)}`,
    `- Measured: ${fmtNum(r.measured_value)}`,
    `- Clean re-run: ${fmtNum(r.rerun_value)}`,
    `- Tolerance: ${r.tolerance_pct ?? '-'}%`,
    `- Tokens used: ${r.tokens_used ?? '-'}`,
    `- Elapsed: ${((r.elapsed_ms ?? 0) / 1000).toFixed(1)} s`,
    '',
    '## Audit flags',
    '',
    ...(flags.length ? flags.map((f) => `- [${f.severity}] ${f.type}: ${f.detail}`) : ['None']),
    '',
    '## Summary',
    '',
    r.summary ?? '-',
    '',
    '## Final code',
    '',
    '```python',
    r.code ?? '',
    '```',
    '',
    '> It checks the claim on a small scale in your browser; it does not replace a full reproduction.',
    '',
  ].join('\n');
}

export default function CheckDetail() {
  const { id } = useParams();
  const { t, lang } = usePrefs();
  const [rec, setRec] = useState<CheckRecord | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    if (!id) return;
    getCheck(id)
      .then((r) => {
        if (r) {
          setRec(r);
          setStatus('ok');
        } else setStatus('missing');
      })
      .catch(() => setStatus('missing'));
  }, [id]);

  return (
    <Shell>
      <div className="py-10">
        <Link to="/" className="inline-flex h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />{t('back')}
        </Link>
        {status === 'loading' && <div className="mt-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {status === 'missing' && <p className="mt-8 text-muted-foreground">{t('notFound')}</p>}
        {status === 'ok' && rec && (
          <article className="mt-6 space-y-8">
            <div>
              <VerdictBadge verdict={rec.verdict} label={verdictLabel(lang, rec.verdict)} large />
              <h1 className="mt-4 break-words font-display text-[28px] leading-tight sm:text-[34px]">{rec.claim}</h1>
              {rec.paper_link && (
                <a href={rec.paper_link} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-sm text-primary underline-offset-4 hover:underline">
                  {t('paper')}: {rec.paper_link}
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-5 rounded-2xl border border-border bg-card p-5 sm:grid-cols-4 shadow-[0_8px_24px_rgba(16,24,40,0.06)]">
              <Stat label={t('measured')} value={fmtNum(rec.measured_value)} />
              <Stat label={t('target')} value={fmtNum(rec.target_value)} />
              <Stat label={t('rerun')} value={fmtNum(rec.rerun_value)} />
              <Stat label={t('tolerance')} value={`${rec.tolerance_pct ?? '-'}%`} />
              <Stat label={t('metric')} value={rec.metric || '-'} />
              <Stat label={t('dataset')} value={rec.dataset || '-'} />
              <Stat label={t('totalTime')} value={`${((rec.elapsed_ms ?? 0) / 1000).toFixed(1)} s`} />
            </div>
            <section>
              <h2 className="font-display text-xl">{t('flags')}</h2>
              <div className="mt-3"><FlagList flags={parseFlags(rec.flags)} /></div>
            </section>
            {rec.summary && (
              <section>
                <h2 className="font-display text-xl">{t('summary')}</h2>
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{rec.summary}</p>
              </section>
            )}
            {rec.code && (
              <section>
                <h2 className="font-display text-xl">{t('finalCode')}</h2>
                <CodeBlock code={rec.code} className="mt-3" />
              </section>
            )}
            <Button className="h-10 gap-2" onClick={() => downloadText(`repro-lite-check-${rec.id}.md`, recordReport(rec, lang))}>
              <Download className="h-4 w-4" />{t('download')}
            </Button>
          </article>
        )}
      </div>
    </Shell>
  );
}
