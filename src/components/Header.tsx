import type { ReactNode } from "react";
import { useChatStore } from "../store/chat-store.ts";
import { useStrings, useUiStore } from "../store/ui-store.ts";

const ICON_BUTTON =
  "flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600";

/** Shared by both pages. `label` names the page next to the demo badge, `wide` matches the dashboard width, `children` are page-specific buttons. */
export function Header({ label, wide, children }: { label?: string; wide?: boolean; children?: ReactNode }) {
  const t = useStrings();
  const language = useUiStore((state) => state.language);
  const toggleLanguage = useUiStore((state) => state.toggleLanguage);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className={`mx-auto flex items-center gap-3 px-4 py-2.5 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <img src="/favicon.svg" alt="" className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base leading-tight font-semibold text-slate-900">
            {t.hotelName} · {t.city}
          </h1>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <span className="rounded-full whitespace-nowrap bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              {t.demoBadge}
            </span>
            {label && (
              <span className="rounded-full whitespace-nowrap bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-900">
                {label}
              </span>
            )}
          </div>
        </div>
        {children}
        <button
          type="button"
          onClick={toggleLanguage}
          lang={language === "ar" ? "en" : "ar"}
          className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"
        >
          {t.switchLanguage}
        </button>
      </div>
    </header>
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
