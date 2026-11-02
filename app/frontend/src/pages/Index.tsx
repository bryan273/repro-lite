import { FeatureBento, GradLast, type Feature } from '@/components/SuiteUI';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, Loader2, Square } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Shell, VerdictBadge } from '@/components/Shell';
import { SuiteFaq, SuiteCta } from '@/components/SuiteFooter';
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


const FAQ = {
  en: [
    { q: 'What does Repro Lite actually do?', a: 'It turns your claim into a fixed contract (data, method, metric), writes Python, runs it, re-runs it from a clean start, audits its own code and gives a plain verdict: reproduced, partly reproduced, not reproduced, or could not run.' },
    { q: 'Where does the code run?', a: 'In this browser tab, using Pyodide (Python compiled to WebAssembly). Nothing is installed and your claim is only sent to the AI model that writes the plan and code.' },
    { q: 'Does it replace a full reproduction?', a: 'No. It checks a claim on a small public dataset and at small scale. For a full paper, use the Paper Repro Agent, or ask Repro Desk for a human-checked report.' },
    { q: 'What does the tolerance mean?', a: 'The relative gap, in percent, between your number and the measured number that still counts as reproduced. The default is 3%. It is fixed before the code runs, so it cannot be tuned after seeing the result.' },
    { q: 'Who can see my check?', a: 'Finished checks are saved and shown in Recent checks to other visitors. Do not paste private or unpublished material.' },
  ],
  zh: [
    { q: 'Repro Lite 具体做什么？', a: '它把你的结论变成固定的契约（数据、方法、指标），编写并运行 Python，再从干净环境重新运行，审查自己的代码，最后给出明确结论：已复现、部分复现、未复现或无法运行。' },
    { q: '代码在哪里运行？', a: '就在当前浏览器标签页，使用 Pyodide（编译成 WebAssembly 的 Python）。无需安装；你的结论只会发送给负责写计划和代码的 AI 模型。' },
    { q: '它能替代完整复现吗？', a: '不能。它只在小型公开数据集上、以小规模核验一个结论。完整论文请用 Paper Repro Agent，或向 Repro Desk 申请人工核对的报告。' },
    { q: '容差是什么意思？', a: '你给出的数字与实测数字之间，仍算作“已复现”的相对差距（百分比），默认 3%。它在运行代码之前就固定，不能看到结果后再调整。' },
    { q: '别人能看到我的核验吗？', a: '完成的核验会保存，并显示在“最近核验”中供其他访客查看。请勿粘贴私密或未发表的内容。' },
  ],
};

const LITE_STEPS: Record<'en' | 'zh', Feature[]> = {
  en: [
    { t: 'Plan', p: 'Your claim becomes a contract: the metric, the dataset, the target and the tolerance, all fixed before any code runs.', d: 'M9 5H5v14h14v-4M9 5V3h6v2M9 5h6M9 12l2 2 4-4' },
    { t: 'Write and run', p: 'The agent writes Python and runs it with Pyodide inside this tab, up to 10 turns and 60 seconds per run.', d: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12' },
    { t: 'Clean re-run', p: 'The final script runs again from scratch in a fresh worker. The measured value comes from this second run.', d: 'M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5' },
    { t: 'Audit', p: 'A second review looks for shortcuts: a pasted-in number, a swapped method, leaked test data. Serious findings lower the verdict.', d: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4' },
  ],
  zh: [
    { t: '制定计划', p: '你的结论会变成一份契约：指标、数据集、目标值和容差，全部在运行前写定。', d: 'M9 5H5v14h14v-4M9 5V3h6v2M9 5h6M9 12l2 2 4-4' },
    { t: '编写并运行', p: '智能体在本页内用 Pyodide 编写并运行 Python，最多 10 轮，每次运行不超过 60 秒。', d: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12' },
    { t: '干净重跑', p: '最终脚本在全新的 worker 中从零再运行一次，测得的数值来自这第二次运行。', d: 'M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5' },
    { t: '审计', p: '再用第二次审阅查找捷径：直接写入的数字、被替换的方法、泄露的测试数据。严重问题会降低结论等级。', d: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4' },
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
      setRecent((await listRecentChecks(24)).filter((c) => c.verdict !== 'could_not_run').slice(0, 12));
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
    if (final.verdict && final.verdict !== 'could_not_run' && !final.rateLimited && final.error !== 'aborted') {
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
          <span className="su-pill"><i />{t('brand')}</span>
          <h1 className="mt-4 font-display text-[38px] leading-[1.08] tracking-tight sm:text-[52px]"><GradLast text={t('heroTitle')} /></h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">{t('heroBody')}</p>
          <ol className="mt-8 grid max-w-xl grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {(['stepPlan', 'stepRun', 'stepRerun', 'stepAudit'] as const).map((k, i) => (
              <li key={k} className="flex items-center gap-3">
                <span className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xs font-semibold text-primary">{i + 1}</span>
                {t(k)}
              </li>
            ))}
          </ol>
          <figure className="sfm mt-8" aria-label={lang === 'zh' ? '示例结果' : 'Example result'}>
            <div className="sfm-top"><span className="sfm-chip">{lang === 'zh' ? '示例结果' : 'Example result'}</span><span className="sfm-dots" aria-hidden><i /><i /><i /></span></div>
            <p className="sfm-claim">{lang === 'zh' ? '结论：Isolation Forest 在乳腺癌数据集上 ROC AUC 约 0.85。' : 'Claim: Isolation Forest reaches ROC AUC about 0.85 on the breast cancer dataset.'}</p>
            <dl className="sfm-nums">
              <div><dt>{lang === 'zh' ? '论文报告' : 'Reported'}</dt><dd>0.85</dd></div>
              <div className="hi"><dt>{lang === 'zh' ? '实测' : 'Measured'}</dt><dd>0.849</dd></div>
              <div><dt>{lang === 'zh' ? '容差' : 'Tolerance'}</dt><dd>±3%</dd></div>
            </dl>
            <span className="sfm-ok">✓ {lang === 'zh' ? '已复现' : 'Reproduced'}</span>
            <figcaption className="sfm-cap">{lang === 'zh' ? '仅为界面示例，非真实运行结果。' : 'Illustration of the result format, not a real run.'}</figcaption>
          </figure>
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
              maxLength={1000}
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
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">{t('emptyGallery')}</p>
              <button type="button" className="mt-4 h-10 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:border-primary hover:text-primary" onClick={() => document.getElementById('claim')?.focus()}>
                {lang === 'zh' ? '运行第一个核验' : 'Run the first check'}
              </button>
            </div>
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

      <FeatureBento
        id="how"
        eyebrow={lang === 'zh' ? '一次核查如何进行' : 'How a check works'}
        title={lang === 'zh' ? '四步，每一步都留下证据。' : 'Four steps, each one leaves evidence.'}
        lead={lang === 'zh' ? '全部在你的浏览器里运行，代码和结果都能查看。' : 'It all runs in your browser, so you can read the code and the result.'}
        items={LITE_STEPS[lang]}
      />

      <SuiteFaq lang={lang} id="faq" items={FAQ[lang]} />
      <SuiteCta
        title={lang === 'zh' ? '准备好核验一个结论了吗？' : 'Have a number you want to test?'}
        body={lang === 'zh' ? '写下结论，约 40 秒后得到结果。' : 'Write the claim. Get a verdict in about 40 seconds.'}
        label={lang === 'zh' ? '开始核验' : 'Start a check'}
        href="#check"
        onClick={() => document.getElementById('check')?.scrollIntoView({ behavior: 'smooth' })}
      />
    </Shell>
  );
}
