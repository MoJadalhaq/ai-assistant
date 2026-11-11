import type { BookingCard as Booking, ChatEvent, TicketCard as Ticket } from "../../shared/api-types.ts";
import type { Urgency } from "../../shared/types.ts";
import { formatAmount, formatDate } from "../lib/format.ts";
import { useStrings, useUiStore } from "../store/ui-store.ts";

export function EventCard({ event }: { event: ChatEvent }) {
  return event.type === "booking_created" ? <BookingCard booking={event.booking} /> : <TicketCard ticket={event.ticket} />;
}

function BookingCard({ booking }: { booking: Booking }) {
  const t = useStrings();
  const language = useUiStore((state) => state.language);
  const roomName = language === "ar" ? booking.room_name_ar : booking.room_name_en;
  const details = [
    // The arrow follows the reading direction: right to left in Arabic.
    `${formatDate(booking.check_in, language)} ${language === "ar" ? "←" : "→"} ${formatDate(booking.check_out, language)}`,
    t.booking.nights(booking.nights),
    t.booking.guests(booking.guests),
    ...(booking.rooms > 1 ? [t.booking.rooms(booking.rooms)] : []),
  ];

  return (
    <section className="w-full max-w-sm self-start rounded-2xl border border-teal-200 bg-teal-50 p-4 text-slate-800">
      <h2 className="text-sm font-semibold text-teal-800">✓ {t.booking.title}</h2>
      <p className="mt-2 text-xs text-slate-500">{t.booking.reference}</p>
      <p dir="ltr" className="text-start font-mono text-2xl font-semibold tracking-wider text-slate-900">
        {booking.reference_code}
      </p>
      <p className="mt-2 font-medium">{roomName}</p>
      <p className="text-sm text-slate-600">{details.join(" · ")}</p>
      <p className="mt-2 text-sm">
        <span className="font-semibold">
          {t.booking.total}: {formatAmount(booking.total_sar, language)} {t.currency}
        </span>{" "}
        <span className="text-slate-500">
          ({t.booking.vatIncluded(`${formatAmount(booking.vat_included_sar, language)} ${t.currency}`)})
        </span>
      </p>
      <p className="mt-3 border-t border-teal-200 pt-2 text-xs text-slate-600">{t.booking.note}</p>
    </section>
  );
}

const URGENCY_STYLE: Record<Urgency, string> = {
  high: "bg-red-100 text-red-800",
  normal: "bg-amber-100 text-amber-900",
  low: "bg-slate-200 text-slate-700",
};

function TicketCard({ ticket }: { ticket: Ticket }) {
  const t = useStrings();
  const urgency = (ticket.urgency in URGENCY_STYLE ? ticket.urgency : "normal") as Urgency;

  return (
    <section className="w-full max-w-sm self-start rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-800">
      <h2 className="text-sm font-semibold text-amber-900">↗ {t.ticket.title}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{t.ticket.number(ticket.id)}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLE[urgency]}`}>
          {t.ticket.urgency[urgency]}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-600">{t.ticket.note}</p>
    </section>
  );
}
