import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { usePrefs } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const SUITE_LINKS = [
  { label: 'Paper Explainer', href: 'https://paperexplainer-aiid.pub.atoms.world' },
  { label: 'Paper Repro Agent', href: 'https://paperrepro-aiid.atoms.world/repro/index.html' },
  { label: 'Benchmark', href: 'https://paperrepro-aiid.atoms.world/repro/bench.html' },
  { label: 'allApps', href: 'https://reprosuite-aiid.atoms.world', i18n: true },
] as const;

const navItem =
  'flex min-h-[40px] items-center justify-between gap-2 rounded-full px-3.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Logo() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#1D1D1F] text-base font-extrabold text-white dark:bg-white dark:text-[#0B0B0E]">
      L
    </span>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { t, lang, setLang, dark, toggleDark } = usePrefs();
  const location = useLocation();
  const appLinks = [
    { label: t('newCheck'), to: '/#check', active: location.pathname === '/' && location.hash !== '#recent' },
    { label: t('recent'), to: '/#recent', active: location.pathname.startsWith('/check/') || location.hash === '#recent' },
  ];
  return (
    <div className="flex h-full flex-col">
      <Link to="/#check" onClick={onNavigate} className="flex items-center gap-3 rounded-2xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Logo />
        <span className="min-w-0">
          <span className="block font-display text-[17px] leading-tight">{t('brand')}</span>
          <span className="block text-xs text-muted-foreground">{t('partOf')}</span>
        </span>
      </Link>

      <nav aria-label={t('navigation')} className="mt-8 flex-1 space-y-7 overflow-y-auto">
        <div>
          <div className="px-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Repro Lite</div>
          <ul className="mt-2 space-y-1">
            {appLinks.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  onClick={onNavigate}
                  aria-current={l.active ? 'page' : undefined}
                  className={cn(navItem, l.active ? 'bg-accent font-medium text-primary' : 'text-foreground hover:bg-muted')}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="px-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Repro Suite</div>
          <ul className="mt-2 space-y-1">
            {SUITE_LINKS.map((l) => {
              const label = 'i18n' in l ? t(l.label) : l.label;
              return (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className={cn(navItem, 'text-foreground hover:bg-muted')}>
                    <span>{label}</span>
                    <span aria-hidden className="text-xs text-muted-foreground">↗</span>
                    <span className="sr-only">({t('newTab')})</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={toggleDark}
          aria-label={t('toggleTheme')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-base text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {dark ? '☀' : '☾'}
        </button>
        <div className="flex rounded-full border border-border bg-card p-0.5" role="group" aria-label="Language">
          {(['en', 'zh'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={cn(
                'h-9 min-w-[48px] rounded-full px-3 text-sm font-medium transition-colors duration-150',
                lang === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l === 'en' ? 'EN' : '中文'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }, [location.hash, location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground min-[900px]:flex">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-border bg-background px-4 py-6 min-[900px]:block">
        <SidebarBody />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm min-[900px]:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('openMenu')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ☰
        </button>
        <Link to="/#check" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#1D1D1F] text-sm font-extrabold text-white dark:bg-white dark:text-[#0B0B0E]">L</span>
          <span className="font-display text-base">{t('brand')}</span>
        </Link>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] border-border bg-background px-4 py-6">
          <SheetTitle className="sr-only">{t('navigation')}</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-[1120px] px-4 pb-24 sm:px-8">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-[1120px] px-4 py-8 text-sm text-muted-foreground sm:px-8">{t('honesty')}</div>
        </footer>
      </div>
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
