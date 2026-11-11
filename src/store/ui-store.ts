import { create } from "zustand";
import { STRINGS } from "../i18n/strings.ts";
import type { UiLanguage } from "../i18n/strings.ts";

const STORAGE_KEY = "ui-language";

/** A saved choice wins; otherwise follow the browser. Storage can be blocked (private mode), so every access is guarded. */
function initialLanguage(): UiLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en") return saved;
  } catch {
    // Storage unavailable: fall through to the browser language.
  }
  return navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
}

interface UiState {
  language: UiLanguage;
  toggleLanguage: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  language: initialLanguage(),
  toggleLanguage: () =>
    set(({ language }) => {
      const next = language === "ar" ? "en" : "ar";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Not saved, but the switch still works for this visit.
      }
      return { language: next };
    }),
}));

/** The UI text in the current language. */
export function useStrings() {
  return STRINGS[useUiStore((state) => state.language)];
}
