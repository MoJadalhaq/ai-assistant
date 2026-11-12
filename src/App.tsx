import { useEffect } from "react";
import { GuestChat } from "./pages/GuestChat.tsx";
import { StaffDashboard } from "./pages/StaffDashboard.tsx";
import { useStrings, useUiStore } from "./store/ui-store.ts";

// Two pages don't need a router: the Worker serves index.html for every path (SPA mode in
// wrangler.jsonc), and this picks the page from the URL.
export default function App() {
  const language = useUiStore((state) => state.language);
  const t = useStrings();
  const isStaff = window.location.pathname.startsWith("/staff");

  // Setting dir on <html> flips the whole layout (Tailwind's start/end utilities follow it).
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.title = isStaff ? `${t.staff.label} · ${t.hotelName}` : t.pageTitle;
  }, [language, isStaff, t.pageTitle, t.staff.label, t.hotelName]);

  return isStaff ? <StaffDashboard /> : <GuestChat />;
}
