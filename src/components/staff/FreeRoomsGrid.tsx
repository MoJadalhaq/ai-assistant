import type { StaffOverview } from "../../../shared/api-types.ts";
import { formatNightHeader } from "../../lib/format.ts";
import { useStrings, useUiStore } from "../../store/ui-store.ts";

/** Hotel weekend nights in Saudi Arabia: Thursday and Friday (guests leave on Friday or Saturday). */
const WEEKEND_NIGHTS = new Set([4, 5]);

function isWeekendNight(night: string): boolean {
  return WEEKEND_NIGHTS.has(new Date(`${night}T00:00:00Z`).getUTCDay());
}

/** Red when sold out, amber when a third or less is left, green otherwise. */
function cellStyle(free: number, total: number): string {
  if (free <= 0) return "bg-red-100 text-red-800";
  if (free / total <= 1 / 3) return "bg-amber-100 text-amber-900";
  return "bg-emerald-50 text-emerald-800";
}

/**
 * Rooms free per room type for the next 14 nights: the view a revenue manager checks before
 * agreeing to a group booking or a special price. Scrolls sideways on a phone; the room names stay put.
 */
export function FreeRoomsGrid({ overview }: { overview: StaffOverview }) {
  const t = useStrings();
  const language = useUiStore((state) => state.language);

  return (
    <section>
      <p className="text-sm text-slate-600">{t.staff.grid.caption}</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky start-0 z-10 bg-white px-3 py-2 text-start font-medium text-slate-500">
                {t.staff.grid.room}
              </th>
              {overview.nights.map((night) => {
                const { weekday, day } = formatNightHeader(night, language);
                return (
                  <th
                    key={night}
                    scope="col"
                    className={`px-1 py-2 text-center font-medium whitespace-nowrap ${isWeekendNight(night) ? "bg-slate-100" : ""}`}
                  >
                    <span className="block text-xs text-slate-500">{weekday}</span>
                    {day}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {overview.rooms.map((room) => (
              <tr key={room.code} className="border-t border-slate-100">
                <th scope="row" className="sticky start-0 z-10 bg-white px-3 py-2 text-start font-medium whitespace-nowrap text-slate-900">
                  {language === "ar" ? room.nameAr : room.nameEn}
                  <span className="block text-xs font-normal text-slate-500">{t.staff.stats.ofTotal(room.totalUnits)}</span>
                </th>
                {room.freeByNight.map((free, index) => (
                  <td key={overview.nights[index]} className={`px-1 py-1 text-center ${isWeekendNight(overview.nights[index] ?? "") ? "bg-slate-100" : ""}`}>
                    <span className={`inline-flex size-8 items-center justify-center rounded-lg font-semibold ${cellStyle(free, room.totalUnits)}`}>
                      {free}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
        <Legend style={cellStyle(0, 1)} label={t.staff.grid.soldOut} />
        <Legend style={cellStyle(1, 3)} label={t.staff.grid.few} />
        <Legend style={cellStyle(3, 3)} label={t.staff.grid.available} />
      </div>
    </section>
  );
}

function Legend({ style, label }: { style: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded ${style}`} />
      {label}
    </span>
  );
}
