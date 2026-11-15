import { create } from "zustand";
import { STRINGS } from "../i18n/strings.ts";
import type { UiLanguage } from "../i18n/strings.ts";

const STORAGE_KEY = "ui-language";
/** Same key as public/theme-init.js, which applies the theme before React starts. */
const THEME_KEY = "ui-theme";

export type Theme = "light" | "dark";

/** The browser bar colour on phones: the header's surface colour. */
const THEME_COLORS: Record<Theme, string> = { light: "#ffffff", dark: "#0f172a" };

function savedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Switches the theme with every colour changing at once. Buttons and links have short colour
 * transitions, which would otherwise fade while the rest of the page snaps over. The pause is a
 * class (see index.css), not an injected <style>, which the site's security policy would block.
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  void getComputedStyle(root).color; // apply the new colours now, while transitions are paused
  requestAnimationFrame(() => root.classList.remove("theme-switching"));
}

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
  /** Starts as whatever theme-init.js already applied, so React and the page agree from the first render. */
  theme: Theme;
  toggleTheme: () => void;
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
  theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  toggleTheme: () =>
    set(({ theme }) => {
      const next: Theme = theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Not saved, but the switch still works for this visit.
      }
      applyTheme(next);
      return { theme: next };
    }),
}));

// Follow the device's light/dark setting live, until the visitor picks a theme with the toggle.
try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (savedTheme() !== null) return;
    const theme: Theme = event.matches ? "dark" : "light";
    applyTheme(theme);
    useUiStore.setState({ theme });
  });
} catch {
  // Very old browsers: the theme just won't follow live changes.
}

/** The UI text in the current language. */
export function useStrings() {
  return STRINGS[useUiStore((state) => state.language)];
}
