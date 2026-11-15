import { useEffect, useState } from "react";
import type { TranscriptMessage } from "../../../shared/api-types.ts";
import type { StaffClientError } from "../../api/staff-client.ts";
import { fetchConversation } from "../../api/staff-client.ts";
import { formatDateTime } from "../../lib/format.ts";
import { useStrings, useUiStore } from "../../store/ui-store.ts";

type State = { status: "loading" } | { status: "error"; error: StaffClientError } | { status: "ready"; messages: TranscriptMessage[] };

/**
 * The chat that led to a ticket, loaded when staff open it. Shows which tools the assistant used
 * before each reply, so staff can see what it already checked (availability, a booking) before handing off.
 */
export function ConversationView({ ticketId }: { ticketId: number }) {
  const t = useStrings();
  const language = useUiStore((state) => state.language);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    // Ignore a late answer if the ticket was closed or changed in the meantime.
    let current = true;
    void fetchConversation(ticketId).then((result) => {
      if (!current) return;
      setState(result.ok ? { status: "ready", messages: result.messages } : { status: "error", error: result.error });
    });
    return () => {
      current = false;
    };
  }, [ticketId]);

  if (state.status === "loading") return <p className="mt-2 text-sm text-slate-500">{t.staff.conversation.loading}</p>;
  if (state.status === "error") return <p className="mt-2 text-sm text-red-700 dark:text-red-300">{t.staff.errors[state.error]}</p>;
  if (state.messages.length === 0) return <p className="mt-2 text-sm text-slate-500">{t.staff.conversation.empty}</p>;

  return (
    <ol className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 transition-opacity duration-150 ease-out starting:opacity-0">
      {state.messages.map((message, index) => (
        <li key={index} className={`rounded-lg p-2 text-sm ${message.role === "guest" ? "bg-surface" : "bg-teal-50 dark:bg-teal-950/50"}`}>
          <p className="flex justify-between gap-2 text-xs text-slate-500">
            <span className="font-medium">{message.role === "guest" ? t.staff.conversation.guest : t.staff.conversation.assistant}</span>
            <span>{formatDateTime(message.at, language)}</span>
          </p>
          {message.tools.length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
              {t.staff.conversation.used}
              {message.tools.map((tool, toolIndex) => (
                <code key={toolIndex} dir="ltr" className="rounded bg-surface px-1.5 py-0.5 text-teal-800 dark:text-teal-200">
                  {tool}
                </code>
              ))}
            </p>
          )}
          <p dir="auto" className="mt-1 whitespace-pre-wrap text-slate-800">
            {message.text}
          </p>
        </li>
      ))}
    </ol>
  );
}
