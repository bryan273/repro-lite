import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, Loader2, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Shell, VerdictBadge } from '@/components/Shell';
import { RunView } from '@/components/RunView';
import { usePrefs } from '@/lib/i18n';
import { buildReport, downloadText, fmtNum, runCheck, verdictLabel, type CheckInput, type CheckState } from '@/lib/agent';
import { apiErrorMessage, listRecentChecks, saveCheck, type CheckRecord } from '@/lib/checksApi';

const EXAMPLES = {
  en: [
    { tag: 'breast_cancer', claim: 'Isolation Forest reaches ROC AUC about 0.95 on the breast cancer dataset (malignant as anomaly), 100 trees, 5-fold CV.' },
    { tag: 'wine', claim: 'KMeans with k=3 on standardized features of the wine dataset reaches an adjusted Rand index of about 0.90 against the true cultivars.' },
    { tag: 'digits', claim: 'Logistic regression on the digits dataset reaches about 0.96 accuracy with 5-fold cross-validation (standardized pixels).' },
  ],
  zh: [
    { tag: 'breast_cancer', claim: 'Isolation Forest 在乳腺癌数据集上（恶性视为异常）ROC AUC 约 0.95，100 棵树，5 折交叉验证。' },
    { tag: 'wine', claim: '在标准化后的 wine 数据集上，k=3 的 KMeans 与真实品种的调整兰德指数约为 0.90。' },
    { tag: 'digits', claim: '在 digits 数据集上，逻辑回归（像素标准化）5 折交叉验证准确率约 0.96。' },
  ],
};

export default function Index() {
  const { t, lang } = usePrefs();
  const [claim, setClaim] = useState('');
  const [paperLink, setPaperLink] = useState('');
  const [tolerance, setTolerance] = useState('3');
  const [formError, setFormError] = useState('');
  const [state, setState] = useState<CheckState | null>(null);
  const [running, setRunning] = useState(false);
  const [lastInput, setLastInput] = useState<CheckInput | null>(null);
  const [recent, setRecent] = useState<CheckRecord[] | null>(null);
  const [recentError, setRecentError] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [savedId, setSavedId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef<HTMLDivElement | null>(null);

  const loadRecent = useCallback(async () => {
    try {
      setRecentError(false);
      setRecent(await listRecentChecks(12));
    } catch {
      setRecentError(true);
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    loadRecent();
    return () => abortRef.current?.abort();
  }, [loadRecent]);

  const start = async () => {
    const tol = Number(tolerance);
    if (!claim.trim()) {
      setFormError(t('claimRequired'));
      return;
    }
    setFormError('');
    const input: CheckInput = {
      claim: claim.trim(),
      paperLink: paperLink.trim(),
      tolerancePct: Number.isFinite(tol) && tol > 0 ? tol : 3,
      lang,
    };
    setLastInput(input);
    setSaveStatus('idle');
    setSaveError('');
    setSavedId(null);
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTimeout(() => runRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    const final = await runCheck(input, setState, ctrl.signal);
    setRunning(false);
    if (final.verdict && !final.rateLimited && final.error !== 'aborted') {
      await persist(input, final);
    }
  };

  const persist = async (input: CheckInput, final: CheckState) => {
    setSaveStatus('saving');
    setSaveError('');
    try {
      const rec = await saveCheck(input, final);
      setSaveStatus('saved');
      setSavedId(rec?.id ?? null);
      toast.success(t('saved'));
      await loadRecent();
    } catch (e) {
      const msg = apiErrorMessage(e);
      console.error('Saving check failed:', e);
      setSaveStatus('error');
      setSaveError(msg);
      toast.error(`${t('saveFailed')} ${msg}`);
    }
  };

  const download = () => {
    if (!state || !lastInput) return;
    downloadText(`repro-lite-report-${Date.now()}.md`, buildReport(lastInput, state));
  };

  return (
    <Shell>
      <section id="check" className="grid scroll-mt-20 gap-10 py-10 sm:py-14 xl:grid-cols-12 xl:gap-12 xl:py-16">
        <div className="xl:col-span-7">
          <p className="tnum text-xs font-medium uppercase tracking-[0.14em] text-primary">{t('brand')}</p>
          <h1 className="mt-4 font-display text-[38px] leading-[1.08] tracking-tight sm:text-[52px]">{t('heroTitle')}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">{t('heroBody')}</p>
          <ol className="mt-8 grid max-w-xl grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {(['stepPlan', 'stepRun', 'stepRerun', 'stepAudit'] as const).map((k, i) => (
              <li key={k} className="flex items-center gap-3">
                <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xs font-semibold text-primary">{i + 1}</span>
                {t(k)}
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-xl border-t border-border pt-4 text-sm text-muted-foreground">{t('honesty')}</p>
        </div>

        <div className="xl:col-span-5">
          <form
            className="rounded-2xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(16,24,40,0.06)] sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!running) start();
            }}
          >
            <label htmlFor="claim" className="text-sm font-medium">{t('claimLabel')}</label>
            <Textarea
              id="claim"
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder={t('claimPlaceholder')}
              rows={5}
              disabled={running}
              className="mt-2 resize-y text-[15px]"
              aria-invalid={!!formError}
            />
            {formError && <p className="mt-2 text-sm text-destructive">{formError}</p>}

            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('examples')}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLES[lang].map((ex) => (
                  <button
                    key={ex.tag}
                    type="button"
                    disabled={running}
                    onClick={() => { setClaim(ex.claim); setFormError(''); }}
                    className="h-9 rounded-full border border-border px-3 font-code text-xs text-foreground transition-colors duration-150 hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    {ex.tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
              <div className="min-w-0">
                <label htmlFor="paper" className="text-sm font-medium">{t('paperLabel')}</label>
                <Input id="paper" type="url" value={paperLink} onChange={(e) => setPaperLink(e.target.value)} placeholder="https://arxiv.org/abs/..." disabled={running} className="mt-2" />
              </div>
              <div>
                <label htmlFor="tol" className="text-sm font-medium">{t('toleranceLabel')}</label>
                <Input id="tol" type="number" min={0.1} step={0.1} value={tolerance} onChange={(e) => setTolerance(e.target.value)} disabled={running} className="tnum mt-2" />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button type="submit" disabled={running} className="h-11 flex-1 gap-2 text-[15px]">
                {running ? <><Loader2 className="h-4 w-4 animate-spin" />{t('running')}</> : <>{t('run')}<ArrowRight className="h-4 w-4" /></>}
              </Button>
              {running && (
                <Button type="button" variant="outline" className="h-11 gap-2 !bg-transparent" onClick={() => abortRef.current?.abort()}>
                  <Square className="h-3.5 w-3.5" />{t('stop')}
                </Button>
              )}
            </div>
          </form>
        </div>
      </section>

      {state && (
        <section id="run" ref={runRef} className="scroll-mt-20 border-t border-border pt-12">
          <RunView state={state} onDownload={download} />
          {state.verdict && !running && (
            <div className="mb-12 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm shadow-[0_8px_24px_rgba(16,24,40,0.06)]">
              <Button type="button" variant="outline" className="h-10 gap-2 !bg-transparent" onClick={download}>
                <Download className="h-4 w-4" />{t('download')}
              </Button>
              {saveStatus === 'saving' && <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('saving')}</span>}
              {saveStatus === 'saved' && (
                <span className="text-muted-foreground">
                  {t('saved')}{' '}
                  {savedId !== null && <Link to={`/check/${savedId}`} className="text-primary underline-offset-4 hover:underline">{t('viewDetails')}</Link>}
                </span>
              )}
              {saveStatus === 'error' && lastInput && (
                <>
                  <span className="min-w-0 flex-1 break-words text-destructive">{t('saveFailed')} {saveError}</span>
                  <Button type="button" className="h-10" onClick={() => persist(lastInput, state)}>{t('retrySave')}</Button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <section id="recent" className="scroll-mt-20 border-t border-border pt-12">
        <h2 className="font-display text-[30px] leading-tight">{t('recent')}</h2>
        <p className="mt-2 text-muted-foreground">{t('recentDesc')}</p>
        <div className="mt-8">
          {recent === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : recentError ? (
            <p className="text-sm text-destructive">{t('loadError')}</p>
          ) : recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t('emptyGallery')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  to={`/check/${r.id}`}
                  className="group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-[0_8px_24px_rgba(16,24,40,0.06)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <VerdictBadge verdict={r.verdict} label={verdictLabel(lang, r.verdict)} />
                    <span className="text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US') : ''}</span>
                  </div>
                  <p className="mt-3 line-clamp-3 break-words text-[15px] leading-relaxed">{r.claim}</p>
                  <div className="tnum mt-auto flex gap-5 pt-4 text-sm">
                    <span><span className="text-muted-foreground">{t('measured')} </span>{fmtNum(r.measured_value)}</span>
                    <span><span className="text-muted-foreground">{t('target')} </span>{fmtNum(r.target_value)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}
