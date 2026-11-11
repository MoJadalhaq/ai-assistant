import { useChatStore } from "../store/chat-store.ts";
import { useStrings, useUiStore } from "../store/ui-store.ts";

export function Header() {
  const t = useStrings();
  const language = useUiStore((state) => state.language);
  const toggleLanguage = useUiStore((state) => state.toggleLanguage);
  const reset = useChatStore((state) => state.reset);
  const hasMessages = useChatStore((state) => state.messages.length > 0);

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
        <img src="/favicon.svg" alt="" className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base leading-tight font-semibold text-slate-900">
            {t.hotelName} · {t.city}
          </h1>
          <span className="mt-0.5 inline-block rounded-full whitespace-nowrap bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            {t.demoBadge}
          </span>
        </div>
        {hasMessages && (
          // An icon, not a text button: on a 375 px phone the words crowd out the hotel name.
          <button
            type="button"
            onClick={reset}
            aria-label={t.newChat}
            title={t.newChat}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        )}
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
