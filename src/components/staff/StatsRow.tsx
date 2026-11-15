import type { ReactNode } from "react";
import type { StaffOverview } from "../../../shared/api-types.ts";
import type { Language } from "../../../shared/types.ts";
import { riyadhDate } from "../../lib/format.ts";
import { useStrings } from "../../store/ui-store.ts";

const LANGUAGES: Language[] = ["ar", "en", "mixed"];

/**
 * Four numbers a front-desk manager would glance at first. Worked out in the browser from the
 * overview the page already polls, so they cost no extra request.
 */
export function StatsRow({ overview }: { overview: StaffOverview }) {
  const t = useStrings();
  const open = overview.tickets.filter((ticket) => ticket.status === "open");
  const highPriority = open.filter((ticket) => ticket.urgency === "high").length;
  const holdsToday = overview.bookings.filter(
    (booking) => booking.fromChat && riyadhDate(booking.createdAt) === overview.today,
  ).length;
  const freeTonight = overview.rooms.reduce((sum, room) => sum + (room.freeByNight[0] ?? 0), 0);
  const totalRooms = overview.rooms.reduce((sum, room) => sum + room.totalUnits, 0);

  // Which language guests wrote in, for everything that came from the chat.
  const fromChat = [...overview.tickets, ...overview.bookings].filter((item) => item.fromChat);
  const byLanguage = LANGUAGES.map((language) => ({
    language,
    count: fromChat.filter((item) => item.language === language).length,
  })).filter((entry) => entry.count > 0);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label={t.staff.stats.openTickets} value={open.length}>
        {highPriority > 0 && <span className="text-red-700">{t.staff.stats.highPriority(highPriority)}</span>}
      </Stat>
      <Stat label={t.staff.stats.holdsToday} value={holdsToday} />
      <Stat label={t.staff.stats.freeTonight} value={freeTonight}>
        {t.staff.stats.ofTotal(totalRooms)}
      </Stat>
      <Stat label={t.staff.stats.chatLanguages}>
        {byLanguage.length === 0
          ? t.staff.stats.none
          : byLanguage.map((entry) => `${t.staff.stats.languages[entry.language]} ${entry.count}`).join(" · ")}
      </Stat>
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value?: number; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      {value !== undefined && <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>}
      {children && <p className={`text-xs text-slate-600 ${value === undefined ? "mt-2 text-sm" : ""}`}>{children}</p>}
    </div>
  );
}
