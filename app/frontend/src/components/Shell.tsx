import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import SuiteTopBar from '@/components/SuiteTopBar';
import { SuiteFooter } from '@/components/SuiteFooter';
import { usePrefs } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function Shell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, dark, toggleDark } = usePrefs();
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }, [location.hash, location.pathname]);

  const nav = [
    { label: t('newCheck'), to: '/#check', active: location.pathname === '/' && location.hash !== '#recent' },
    { label: t('recent'), to: '/#recent', active: location.pathname.startsWith('/check/') || location.hash === '#recent' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SuiteTopBar appId="lite" brand={t('brand')} letter="L" homeTo="/#check" nav={nav} dark={dark} onToggleDark={toggleDark} lang={lang} onLang={setLang} />
      <main id="top" className="mx-auto max-w-[1160px] px-4 pb-24 sm:px-8">{children}</main>
      <SuiteFooter lang={lang} appId="lite" note={t('honesty')} />
    </div>
  );
}

const VERDICT_STYLE: Record<string, string> = {
  reproduced: 'bg-[#15803D]/10 text-[#15803D] border-[#15803D]/30 dark:text-[#4ADE80] dark:bg-[#4ADE80]/10 dark:border-[#4ADE80]/30',
  partial: 'bg-[#B45309]/10 text-[#B45309] border-[#B45309]/30 dark:text-[#F0A94B] dark:bg-[#F0A94B]/10 dark:border-[#F0A94B]/30',
  not_reproduced: 'bg-[#C62828]/10 text-[#C62828] border-[#C62828]/30 dark:text-[#EF7A73] dark:bg-[#EF7A73]/10 dark:border-[#EF7A73]/30',
  could_not_run: 'bg-muted text-muted-foreground border-border',
};

export function verdictTone(v: string): string {
  return VERDICT_STYLE[v] ?? VERDICT_STYLE.could_not_run;
}

export function VerdictBadge({ verdict, label, large }: { verdict: string; label: string; large?: boolean }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border font-semibold', large ? 'px-4 py-1.5 text-base' : 'px-2.5 py-0.5 text-xs', verdictTone(verdict))}>
      {label}
    </span>
  );
}

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <pre className={cn('max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted p-3 font-code text-[13px] leading-[1.55]', className)}>
      {code}
    </pre>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tnum mt-1 break-words text-base font-medium">{value}</div>
    </div>
  );
}
