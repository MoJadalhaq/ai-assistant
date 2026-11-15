import type { ReactNode } from "react";
import { useChatStore } from "../store/chat-store.ts";
import { useStrings, useUiStore } from "../store/ui-store.ts";

const ICON_BUTTON =
  "press flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600";

/** Shared by both pages. `label` names the page next to the demo badge, `wide` matches the dashboard width, `children` are page-specific buttons. */
export function Header({ label, wide, children }: { label?: string; wide?: boolean; children?: ReactNode }) {
  const t = useStrings();
  const language = useUiStore((state) => state.language);
  const toggleLanguage = useUiStore((state) => state.toggleLanguage);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-surface/95 backdrop-blur">
      <div className={`mx-auto flex items-center gap-2 px-4 py-2.5 sm:gap-3 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <img src="/favicon.svg" alt="" className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base leading-tight font-semibold text-slate-900">
            {t.productName}
          </h1>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <span className="max-w-full truncate rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
              {t.demoBadge}
            </span>
            {label && (
              <span className="max-w-full truncate rounded-full bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 text-xs font-medium text-teal-900 dark:text-teal-100">
                {label}
              </span>
            )}
          </div>
        </div>
        {children}
        <ThemeButton />
        <button
          type="button"
          onClick={toggleLanguage}
          lang={language === "ar" ? "en" : "ar"}
          aria-label={t.switchLanguageLabel}
          title={t.switchLanguageLabel}
          className="press shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"
        >
          {t.switchLanguage}
        </button>
      </div>
    </header>
  );
}

/** Light/dark switch. Shows what it switches to: a moon in light mode, a sun in dark mode. */
function ThemeButton() {
  const t = useStrings();
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const label = theme === "dark" ? t.themeToLight : t.themeToDark;

  return (
    <button type="button" onClick={toggleTheme} aria-label={label} title={label} className={ICON_BUTTON}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

/** Starts a new conversation. An icon, not a text button: on a 375 px phone the words crowd out the hotel name. */
export function NewChatButton() {
  const t = useStrings();
  const reset = useChatStore((state) => state.reset);
  const hasMessages = useChatStore((state) => state.messages.length > 0);
  if (!hasMessages) return null;

  return (
    <button type="button" onClick={reset} aria-label={t.newChat} title={t.newChat} className={ICON_BUTTON}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Link between the two pages, as an icon for the same reason. */
export function PageLink({ href, label, icon }: { href: string; label: string; icon: "chat" | "staff" }) {
  return (
    <a href={href} aria-label={label} title={label} className={ICON_BUTTON}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        {icon === "chat" ? (
          <path d="M4 5h16v11H8l-4 4z" strokeLinejoin="round" />
        ) : (
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" strokeLinejoin="round" />
        )}
      </svg>
    </a>
  );
}
