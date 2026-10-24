import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createElement } from 'react';

export type Lang = 'en' | 'zh';

const dict = {
  en: {
    brand: 'Repro Lite',
    tagline: 'An honest, small-scale check of one research claim, run in your own browser.',
    heroTitle: 'Check a research claim by actually running it.',
    heroBody: 'An AI agent turns your claim into a fixed contract, writes Python, runs it with Pyodide in this tab, re-runs it clean, audits its own code, and gives a plain verdict.',
    honesty: 'It checks the claim on a small scale in your browser; it does not replace a full reproduction.',
    claimLabel: 'Claim to check',
    claimPlaceholder: 'e.g. Isolation Forest reaches ROC AUC about 0.95 on the breast cancer dataset, 100 trees, 5-fold CV',
    paperLabel: 'Paper link (optional)',
    toleranceLabel: 'Tolerance (% relative)',
    examples: 'Try an example',
    run: 'Run check',
    running: 'Checking...',
    stop: 'Stop',
    newCheck: 'New check',
    claimRequired: 'Please enter a claim.',
    rateLimited: 'The AI service is busy or you have reached the usage limit for now. Please wait a minute and try again.',
    stepPlan: 'Plan',
    stepPlanDesc: 'The claim becomes a contract. Target and tolerance are fixed before any code runs.',
    stepRun: 'Write and run',
    stepRunDesc: 'Agent loop: up to 10 turns, 60 s per code run, Python in a Web Worker.',
    stepRerun: 'Clean re-run',
    stepRerunDesc: 'The final script runs again from scratch in a fresh worker.',
    stepAudit: 'Audit',
    stepAuditDesc: 'A second review looks for shortcuts and mistakes in the final code.',
    stepVerdict: 'Verdict',
    waiting: 'Waiting',
    inProgress: 'Running',
    done: 'Done',
    failed: 'Failed',
    loadingPython: 'Loading Python runtime (numpy, pandas, scipy, scikit-learn). The first load can take up to a minute.',
    metric: 'Metric',
    dataset: 'Dataset',
    target: 'Target',
    tolerance: 'Tolerance',
    assumptions: 'Assumptions',
    method: 'Method',
    turn: 'Turn',
    agentNote: 'Agent note',
    code: 'Code',
    output: 'Output',
    noOutput: '(no output)',
    elapsed: 'Elapsed',
    finishCall: 'finish',
    measured: 'Measured',
    rerun: 'Clean re-run',
    rerunDiff: 'Difference',
    rerunOk: 'The clean re-run matches the agent run.',
    rerunMismatch: 'The clean re-run differs by more than 1%; the result is not stable.',
    rerunNoValue: 'The clean re-run did not print a RESULT line.',
    noFlags: 'No issues flagged.',
    flags: 'Audit flags',
    serious: 'serious',
    minor: 'minor',
    tokens: 'Tokens used',
    totalTime: 'Total time',
    download: 'Download report (Markdown)',
    summary: 'Summary',
    reason: 'Why this verdict',
    v_reproduced: 'Reproduced',
    v_partial: 'Partially reproduced',
    v_not_reproduced: 'Not reproduced',
    v_could_not_run: 'Could not run',
    recent: 'Recent checks',
    recentDesc: 'Public results from other visitors. Each was run in their browser.',
    emptyGallery: 'No checks yet. Run the first one above.',
    loadError: 'Could not load recent checks.',
    saved: 'Saved to Recent checks.',
    saveFailed: 'The result could not be saved to history.',
    viewDetails: 'View details',
    back: 'Back',
    notFound: 'This check was not found.',
    paper: 'Paper',
    stopped: 'Stopped by user.',
    toggleTheme: 'Toggle dark mode',
    finalCode: 'Final code',
  },
  zh: {
    brand: 'Repro Lite',
    tagline: '在你自己的浏览器中，对一条研究结论做诚实的小规模核查。',
    heroTitle: '用真正运行代码的方式核查研究结论。',
    heroBody: 'AI 智能体把你的结论转成固定的检验契约，编写 Python，在本页面用 Pyodide 运行，从零重跑一次，审查自己的代码，再给出明确判定。',
    honesty: '它只在你的浏览器中做小规模核查，不能替代完整复现。',
    claimLabel: '要核查的结论',
    claimPlaceholder: '例如：Isolation Forest 在乳腺癌数据集上 ROC AUC 约 0.95，100 棵树，5 折交叉验证',
    paperLabel: '论文链接（可选）',
    toleranceLabel: '容差（相对 %）',
    examples: '试试示例',
    run: '开始核查',
    running: '核查中...',
    stop: '停止',
    newCheck: '新的核查',
    claimRequired: '请输入要核查的结论。',
    rateLimited: 'AI 服务繁忙或你已达到当前使用上限，请稍等一分钟后再试。',
    stepPlan: '计划',
    stepPlanDesc: '把结论转成契约。目标值与容差在运行任何代码之前就已固定。',
    stepRun: '编写并运行',
    stepRunDesc: '智能体循环：最多 10 轮，每次运行限时 60 秒，Python 在 Web Worker 中执行。',
    stepRerun: '干净重跑',
    stepRerunDesc: '在全新的 Worker 中从零重新运行最终脚本。',
    stepAudit: '审查',
    stepAuditDesc: '第二次审查最终代码，寻找捷径和错误。',
    stepVerdict: '判定',
    waiting: '等待中',
    inProgress: '进行中',
    done: '完成',
    failed: '失败',
    loadingPython: '正在加载 Python 运行环境（numpy、pandas、scipy、scikit-learn），首次加载可能需要一分钟。',
    metric: '指标',
    dataset: '数据集',
    target: '目标值',
    tolerance: '容差',
    assumptions: '假设',
    method: '方法',
    turn: '第几轮',
    agentNote: '智能体说明',
    code: '代码',
    output: '输出',
    noOutput: '（无输出）',
    elapsed: '耗时',
    finishCall: 'finish',
    measured: '实测值',
    rerun: '干净重跑',
    rerunDiff: '差异',
    rerunOk: '干净重跑结果与智能体运行一致。',
    rerunMismatch: '干净重跑相差超过 1%，结果不稳定。',
    rerunNoValue: '干净重跑没有输出 RESULT 行。',
    noFlags: '未发现问题。',
    flags: '审查标记',
    serious: '严重',
    minor: '轻微',
    tokens: '使用的 Token',
    totalTime: '总耗时',
    download: '下载报告（Markdown）',
    summary: '摘要',
    reason: '判定依据',
    v_reproduced: '已复现',
    v_partial: '部分复现',
    v_not_reproduced: '未复现',
    v_could_not_run: '无法运行',
    recent: '最近的核查',
    recentDesc: '其他访客公开的结果，均在他们的浏览器中运行。',
    emptyGallery: '还没有核查记录，在上方运行第一条吧。',
    loadError: '无法加载最近的核查。',
    saved: '已保存到最近的核查。',
    saveFailed: '结果未能保存到历史记录。',
    viewDetails: '查看详情',
    back: '返回',
    notFound: '未找到这条核查记录。',
    paper: '论文',
    stopped: '已被用户停止。',
    toggleTheme: '切换深色模式',
    finalCode: '最终代码',
  },
} as const;

export type TKey = keyof typeof dict.en;

interface PrefsValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
  dark: boolean;
  toggleDark: () => void;
}

const PrefsContext = createContext<PrefsValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem('repro-lite-lang') === 'zh' ? 'zh' : 'en'));
  const [dark, setDark] = useState<boolean>(() => {
    const s = localStorage.getItem('repro-lite-theme');
    if (s) return s === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('repro-lite-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem('repro-lite-lang', l);
    setLangState(l);
  }, []);

  const value = useMemo<PrefsValue>(
    () => ({
      lang,
      setLang,
      t: (k) => dict[lang][k],
      dark,
      toggleDark: () => setDark((d) => !d),
    }),
    [lang, setLang, dark],
  );

  return createElement(PrefsContext.Provider, { value }, children);
}

export function usePrefs(): PrefsValue {
  const v = useContext(PrefsContext);
  if (!v) throw new Error('usePrefs must be used inside PrefsProvider');
  return v;
}

export function translate(lang: Lang, k: TKey): string {
  return dict[lang][k];
}
