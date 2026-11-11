import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useChatStore } from "../store/chat-store.ts";
import { useStrings } from "../store/ui-store.ts";

const MAX_LENGTH = 1000; // same limit the server enforces
const MAX_HEIGHT_PX = 128;

export function Composer() {
  const t = useStrings();
  const send = useChatStore((state) => state.send);
  const pending = useChatStore((state) => state.pending);
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!text.trim() || pending) return;
    void send(text);
    setText("");
    if (input.current) input.current.style.height = "";
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a line. isComposing: don't send halfway through an IME word.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  }

  function grow(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }

  return (
    <footer className="border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <form onSubmit={submit} className="mx-auto flex max-w-2xl items-end gap-2 px-4 pt-3 pb-1">
        <textarea
          ref={input}
          dir="auto"
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          placeholder={t.placeholder}
          aria-label={t.placeholder}
          onChange={(event) => {
            setText(event.target.value);
            grow(event.target);
          }}
          onKeyDown={onKeyDown}
          className="min-h-11 flex-1 resize-none rounded-2xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-base leading-snug text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || pending}
          aria-label={t.send}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:bg-slate-300"
        >
          {/* The arrow points the way text flows, so it flips in Arabic. */}
          <svg viewBox="0 0 24 24" className="size-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
      <p className="mx-auto max-w-2xl px-4 pb-2 text-center text-[11px] text-slate-500">{t.privacyNote}</p>
    </footer>
  );
}
