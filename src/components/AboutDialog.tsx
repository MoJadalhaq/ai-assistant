import { useId, useRef } from "react";
import { useStrings } from "../store/ui-store.ts";
import { Credit } from "./Credit.tsx";

const REPO_URL = "https://github.com/MoJadalhaq/ai-assistant";
const ARCHITECTURE_URL = `${REPO_URL}/blob/main/ARCHITECTURE.md`;

/**
 * "About this demo": what the project is, things to try, and how it's built, for visitors who
 * arrive from a CV or portfolio link without any context. A text button that opens a dialog.
 */
export function AboutButton({ className = "", showDashboardLink = true }: { className?: string; showDashboardLink?: boolean }) {
  const t = useStrings();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`font-medium text-teal-700 dark:text-teal-300 underline underline-offset-2 transition-colors hover:text-teal-900 dark:hover:text-teal-200 ${className}`}
      >
        {t.about.open}
      </button>

      {/* A native <dialog> opened with showModal(): focus stays inside, Esc closes it, and the page
          behind can't be clicked. A click on the dimmed backdrop lands on the dialog itself and closes it. */}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(event) => event.target === dialog.current && close()}
        className="about-dialog m-auto bg-surface w-[min(32rem,calc(100%-2rem))] rounded-2xl p-0 text-start text-sm text-slate-700 shadow-xl"
      >
        <div className="max-h-[85dvh] overflow-y-auto p-5">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {t.about.title}
          </h2>
          <p className="mt-2 leading-relaxed">{t.about.intro}</p>

          <h3 className="mt-4 font-semibold text-slate-900">{t.about.tryTitle}</h3>
          <ul className="mt-1 list-disc space-y-2 ps-5">
            {t.about.tries.map((item) => (
              <li key={item.text}>
                {item.text}
                {item.example && (
                  <bdi dir="auto" className="mt-1 block rounded-lg bg-teal-50 dark:bg-teal-950/50 px-2.5 py-1.5 text-teal-900 dark:text-teal-100">
                    {item.example}
                  </bdi>
                )}
              </li>
            ))}
          </ul>

          <h3 className="mt-4 font-semibold text-slate-900">{t.about.builtTitle}</h3>
          <p className="mt-1 leading-relaxed">{t.about.built}</p>

          <Credit className="mt-4 border-t border-slate-200 pt-3 text-slate-600" />

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href={REPO_URL} target="_blank" rel="noopener" className="font-medium text-teal-700 dark:text-teal-300 underline underline-offset-2">
              {t.about.github}
            </a>
            <a href={ARCHITECTURE_URL} target="_blank" rel="noopener" className="font-medium text-teal-700 dark:text-teal-300 underline underline-offset-2">
              {t.about.architecture}
            </a>
            {showDashboardLink && (
              <a href="/staff" className="font-medium text-teal-700 dark:text-teal-300 underline underline-offset-2">
                {t.about.dashboard}
              </a>
            )}
            <button
              type="button"
              onClick={close}
              className="press ms-auto rounded-lg bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
            >
              {t.about.close}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
