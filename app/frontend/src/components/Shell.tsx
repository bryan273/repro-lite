import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { usePrefs } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function Shell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, dark, toggleDark } = usePrefs();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary font-display text-sm font-semibold text-primary">R</span>
            <span className="font-display text-xl font-semibold tracking-tight">{t('brand')}</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Language">
              {(['en', 'zh'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={cn(
                    'h-9 min-w-[44px] rounded-md px-2.5 text-sm font-medium transition-colors duration-150',
                    lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {l === 'en' ? 'EN' : '中文'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggleDark}
              aria-label={t('toggleTheme')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-6">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1120px] px-4 py-8 text-sm text-muted-foreground sm:px-6">{t('honesty')}</div>
      </footer>
    </div>
  );
}

const VERDICT_STYLE: Record<string, string> = {
  reproduced: 'bg-[#1E7A4F]/10 text-[#1E7A4F] border-[#1E7A4F]/30 dark:text-[#5CC492] dark:bg-[#5CC492]/10 dark:border-[#5CC492]/30',
  partial: 'bg-[#A66A00]/10 text-[#A66A00] border-[#A66A00]/30 dark:text-[#E3A940] dark:bg-[#E3A940]/10 dark:border-[#E3A940]/30',
  not_reproduced: 'bg-[#B4372F]/10 text-[#B4372F] border-[#B4372F]/30 dark:text-[#EE7D74] dark:bg-[#EE7D74]/10 dark:border-[#EE7D74]/30',
  could_not_run: 'bg-muted text-muted-foreground border-border',
};

export function verdictTone(v: string): string {
  return VERDICT_STYLE[v] ?? VERDICT_STYLE.could_not_run;
}

export function VerdictBadge({ verdict, label, large }: { verdict: string; label: string; large?: boolean }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border font-medium', large ? 'px-4 py-1.5 text-base' : 'px-2.5 py-0.5 text-xs', verdictTone(verdict))}>
      {label}
    </span>
  );
}

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <pre className={cn('max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/60 p-3 font-code text-[13px] leading-[1.55]', className)}>
      {code}
    </pre>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tnum mt-1 break-words text-lg font-medium">{value}</div>
    </div>
  );
}
