import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { StaffBooking, StaffOverview, StaffTicket } from "../../shared/api-types.ts";
import type { Urgency } from "../../shared/types.ts";
import type { StaffClientError } from "../api/staff-client.ts";
import { fetchOverview, resetDemoData, resolveTicket } from "../api/staff-client.ts";
import { Header, PageLink } from "../components/Header.tsx";
import { formatAmount, formatDate, formatDateTime } from "../lib/format.ts";
import { useStrings, useUiStore } from "../store/ui-store.ts";

/** How often the dashboard asks for new data. Polling, not WebSockets: simpler, and 5 s is quick enough for a demo. */
const POLL_MS = 5000;

type Tab = "tickets" | "bookings";

export function StaffDashboard() {
  const t = useStrings();
  const { overview, offline, refresh, rebaseline, isNew } = useOverview();
  const [tab, setTab] = useState<Tab>("tickets");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (!window.confirm(t.staff.confirmReset)) return;
    setResetting(true);
    const result = await resetDemoData();
    setResetting(false);
    if (!result.ok) return setNotice({ text: t.staff.errors[result.error], error: true });
    setNotice({ text: t.staff.resetDone, error: false });
    rebaseline();
    await refresh();
  }

  const openTickets = overview?.tickets.filter((ticket) => ticket.status === "open").length ?? 0;

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header label={t.staff.label} wide>
        <PageLink href="/" label={t.staff.openChat} icon="chat" />
      </Header>

      <main className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="min-w-0 flex-1 basis-60">{t.staff.demoNotice}</p>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium hover:bg-amber-100 disabled:opacity-60"
          >
            {resetting ? t.staff.resetting : t.staff.reset}
          </button>
        </div>

        {notice && (
          <p role="status" className={`mt-3 text-sm ${notice.error ? "text-red-700" : "text-teal-800"}`}>
            {notice.text}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" className="flex gap-1 rounded-xl bg-slate-200/70 p-1">
            <TabButton active={tab === "tickets"} onClick={() => setTab("tickets")}>
              {t.staff.tickets}
              {openTickets > 0 && (
                <span className="ms-1.5 rounded-full bg-red-600 px-1.5 text-xs text-white">{t.staff.openCount(openTickets)}</span>
              )}
            </TabButton>
            <TabButton active={tab === "bookings"} onClick={() => setTab("bookings")}>
              {t.staff.bookings} <span className="text-slate-500">({overview?.bookings.length ?? 0})</span>
            </TabButton>
          </div>
          <p className={`text-xs ${offline ? "text-red-700" : "text-slate-500"}`} aria-live="polite">
            <span className={`me-1 inline-block size-2 rounded-full ${offline ? "bg-red-500" : "bg-emerald-500"}`} />
            {offline ? t.staff.offline : t.staff.live}
          </p>
        </div>

        <section className="mt-3">
          {!overview ? (
            <p className="py-10 text-center text-slate-500">{t.staff.loading}</p>
          ) : tab === "tickets" ? (
            <TicketList
              tickets={overview.tickets}
              isNew={isNew}
              onResolved={refresh}
              onError={(error) => setNotice({ text: t.staff.errors[error], error: true })}
            />
          ) : (
            <BookingList overview={overview} isNew={isNew} />
          )}
        </section>
      </main>
    </div>
  );
}

/**
 * Loads the overview and polls it while the tab is visible (a hidden tab costs no database reads).
 * Also remembers what was there on the first load, so rows that arrive later can be marked "New".
 */
function useOverview() {
  const [overview, setOverview] = useState<StaffOverview | null>(null);
  const [offline, setOffline] = useState(false);
  const latestRequest = useRef(0);
  const baseline = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    // Only the newest request may update the page, so a slow poll can't undo a fresher answer.
    const request = ++latestRequest.current;
    const result = await fetchOverview();
    if (request !== latestRequest.current) return;
    if (!result.ok) return setOffline(true);
    setOffline(false);
    baseline.current ??= new Set([...result.tickets.map(ticketKey), ...result.bookings.map(bookingKey)]);
    setOverview(result);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return {
    overview,
    offline,
    refresh,
    /** After a reset every row is fresh seed data, none of it "new". */
    rebaseline: () => {
      baseline.current = null;
    },
    isNew: (key: string) => baseline.current !== null && !baseline.current.has(key),
  };
}

const ticketKey = (ticket: StaffTicket) => `ticket-${ticket.id}`;
const bookingKey = (booking: StaffBooking) => `booking-${booking.id}`;

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
    >
      {children}
    </button>
  );
}

const URGENCY_STYLE: Record<Urgency, string> = {
  high: "bg-red-100 text-red-800",
  normal: "bg-amber-100 text-amber-900",
  low: "bg-slate-200 text-slate-700",
};

function TicketList({
  tickets,
  isNew,
  onResolved,
  onError,
}: {
  tickets: StaffTicket[];
  isNew: (key: string) => boolean;
  onResolved: () => Promise<void>;
  onError: (error: StaffClientError) => void;
}) {
  const t = useStrings();
  if (tickets.length === 0) return <p className="py-10 text-center text-slate-500">{t.staff.emptyTickets}</p>;

  // Open tickets first: they are the ones that need someone.
  const sorted = [...tickets].sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved") || b.id - a.id);
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {sorted.map((ticket) => (
        <TicketItem key={ticket.id} ticket={ticket} isNew={isNew(ticketKey(ticket))} onResolved={onResolved} onError={onError} />
      ))}
    </ul>
  );
}

function TicketItem({
  ticket,
  isNew,
  onResolved,
  onError,
}: {
  ticket: StaffTicket;
  isNew: boolean;
  onResolved: () => Promise<void>;
  onError: (error: StaffClientError) => void;
}) {
  const t = useStrings();
  const language = useUiStore((state) => state.language);
  const [saving, setSaving] = useState(false);
  const resolved = ticket.status === "resolved";
  // The summary in the page's language first; the other one below for a colleague who reads the other language.
  const [mainSummary, otherSummary] = language === "ar" ? [ticket.summaryAr, ticket.summaryEn] : [ticket.summaryEn, ticket.summaryAr];

  async function handleResolve() {
    setSaving(true);
    const result = await resolveTicket(ticket.id);
    if (!result.ok) onError(result.error);
    await onResolved();
    setSaving(false);
  }

  return (
    <li
      className={`rounded-xl border bg-white p-4 ${resolved ? "border-slate-200 opacity-70" : "border-slate-300"} ${isNew ? "ring-2 ring-teal-400" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-900">#{ticket.id}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLE[ticket.urgency]}`}>
          {t.ticket.urgency[ticket.urgency]}
        </span>
        <span className="text-slate-700">{t.staff.reasons[ticket.reason]}</span>
        <Badges isNew={isNew} fromChat={ticket.fromChat} />
      </div>

      <p dir="auto" className="mt-2 text-slate-900">
        {mainSummary}
      </p>
      {otherSummary !== mainSummary && (
        <p dir="auto" className="mt-1 text-sm text-slate-500">
          {otherSummary}
        </p>
      )}

      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        {(ticket.guestName || ticket.phone) && (
          <Detail label={t.staff.guest}>
            {ticket.guestName && <bdi dir="auto">{ticket.guestName}</bdi>}
            {ticket.guestName && ticket.phone && " · "}
            {ticket.phone && <bdi dir="ltr">{ticket.phone}</bdi>}
          </Detail>
        )}
        {ticket.bookingReference && (
          <Detail label={t.staff.booking}>
            <bdi className="font-mono">{ticket.bookingReference}</bdi>
          </Detail>
        )}
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
        <span>{formatDateTime(ticket.createdAt, language)}</span>
        {resolved ? (
          <span>{t.staff.resolvedAt(ticket.resolvedAt ? formatDateTime(ticket.resolvedAt, language) : "")}</span>
        ) : (
          <button
            type="button"
            onClick={handleResolve}
            disabled={saving}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {saving ? t.staff.saving : t.staff.resolve}
          </button>
        )}
      </div>
    </li>
  );
}

function BookingList({ overview, isNew }: { overview: StaffOverview; isNew: (key: string) => boolean }) {
  const t = useStrings();
  const language = useUiStore((state) => state.language);
  if (overview.bookings.length === 0) return <p className="py-10 text-center text-slate-500">{t.staff.emptyBookings}</p>;

  const roomName = (code: string) => {
    const room = overview.rooms.find((entry) => entry.code === code);
    return room ? (language === "ar" ? room.nameAr : room.nameEn) : code;
  };

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {overview.bookings.map((booking) => {
        const fresh = isNew(bookingKey(booking));
        const details = [
          `${formatDate(booking.checkIn, language)} ${language === "ar" ? "←" : "→"} ${formatDate(booking.checkOut, language)}`,
          t.booking.nights(booking.nights),
          t.booking.guests(booking.guests),
          ...(booking.rooms > 1 ? [t.booking.rooms(booking.rooms)] : []),
        ];
        return (
          <li key={booking.id} className={`rounded-xl border border-slate-300 bg-white p-4 ${fresh ? "ring-2 ring-teal-400" : ""}`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <bdi className="font-mono text-base font-semibold tracking-wide text-slate-900">{booking.referenceCode}</bdi>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                {t.staff.bookingStatus[booking.status]}
              </span>
              <Badges isNew={fresh} fromChat={booking.fromChat} />
            </div>
            <p className="mt-2 font-medium text-slate-900">{roomName(booking.roomCode)}</p>
            <p className="text-sm text-slate-600">{details.join(" · ")}</p>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <Detail label={t.staff.guest}>
                <bdi dir="auto">{booking.guestName}</bdi> · <bdi dir="ltr">{booking.phone}</bdi>
              </Detail>
            </dl>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
              <span className="text-sm font-semibold text-slate-900">
                {formatAmount(booking.totalHalalas / 100, language)} {t.currency}
              </span>
              <span>{formatDateTime(booking.createdAt, language)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Badges({ isNew, fromChat }: { isNew: boolean; fromChat: boolean }) {
  const t = useStrings();
  return (
    <>
      {isNew && <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-medium text-white">{t.staff.isNew}</span>}
      <span className="ms-auto text-xs text-slate-500">{fromChat ? t.staff.fromChat : t.staff.sample}</span>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-1">
      <dt className="text-slate-500">{label}:</dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}
