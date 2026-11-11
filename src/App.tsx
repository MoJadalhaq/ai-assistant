import { useEffect } from "react";
import { GuestChat } from "./pages/GuestChat.tsx";
import { useStrings, useUiStore } from "./store/ui-store.ts";

// Two pages don't need a router: the Worker serves index.html for every path (SPA mode in
// wrangler.jsonc), and this picks the page from the URL.
export default function App() {
  const language = useUiStore((state) => state.language);
  const t = useStrings();

  // Setting dir on <html> flips the whole layout (Tailwind's start/end utilities follow it).
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.title = t.pageTitle;
  }, [language, t.pageTitle]);

  return window.location.pathname.startsWith("/staff") ? <StaffComingSoon /> : <GuestChat />;
}

/** Placeholder until the staff dashboard (Phase 4). */
function StaffComingSoon() {
  const t = useStrings();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-slate-700">{t.staffSoon}</p>
      <a href="/" className="font-medium text-teal-700 underline underline-offset-2">
        {t.backToChat}
      </a>
    </main>
  );
}
