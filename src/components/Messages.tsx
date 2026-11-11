import type { ReactNode } from "react";
import type { ChatMessage } from "../store/chat-store.ts";
import { useChatStore } from "../store/chat-store.ts";
import { useStrings } from "../store/ui-store.ts";
import { EventCard } from "./EventCards.tsx";

// Layout uses logical sides (start/end, not left/right): in Arabic the whole page flips,
// so the guest's bubbles sit on the left and the receptionist's on the right, as an Arabic reader expects.

export function Bubble({ from, children }: { from: "guest" | "assistant"; children: ReactNode }) {
  const style =
    from === "guest"
      ? "self-end rounded-ee-sm bg-teal-700 text-white"
      : "self-start rounded-ss-sm border border-slate-200 bg-white text-slate-800";
  return <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs ${style}`}>{children}</div>;
}

/**
 * dir="auto" lets the browser pick the direction from the message's first letter, so an Arabic
 * reply reads right-to-left even in the English UI, and "أبغى room for 2" lays out correctly.
 */
export function MessageText({ text }: { text: string }) {
  return (
    <p dir="auto" className="text-start leading-relaxed break-words whitespace-pre-wrap">
      {text}
    </p>
  );
}

export function MessageItem({ message }: { message: ChatMessage }) {
  if (message.role === "guest") {
    return (
      <Bubble from="guest">
        <MessageText text={message.text} />
      </Bubble>
    );
  }
  if (message.role === "assistant") {
    return (
      <>
        <Bubble from="assistant">
          <MessageText text={message.text} />
        </Bubble>
        {message.events.map((event, index) => (
          <EventCard key={index} event={event} />
        ))}
      </>
    );
  }
  return <ErrorNotice message={message} />;
}

function ErrorNotice({ message }: { message: Extract<ChatMessage, { role: "error" }> }) {
  const t = useStrings();
  const retry = useChatStore((state) => state.retry);
  // Daily limits won't clear with a retry, so no button for those.
  const canRetry = message.error !== "daily_limit" && message.error !== "demo_quota_used";

  return (
    <div role="alert" className="self-stretch rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-900">
      <p>{t.errors[message.error]}</p>
      {canRetry && (
        <button
          type="button"
          onClick={() => void retry()}
          className="mt-1.5 font-medium underline underline-offset-2 hover:no-underline"
        >
          {t.retry}
        </button>
      )}
    </div>
  );
}

export function TypingIndicator() {
  const t = useStrings();
  return (
    <Bubble from="assistant">
      <span className="flex items-center gap-1 py-1.5" role="status" aria-label={t.typing}>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-2 animate-bounce rounded-full bg-slate-400"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </Bubble>
  );
}
