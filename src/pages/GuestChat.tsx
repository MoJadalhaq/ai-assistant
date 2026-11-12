import { useEffect, useRef } from "react";
import { Composer } from "../components/Composer.tsx";
import { Header, NewChatButton, PageLink } from "../components/Header.tsx";
import { Bubble, MessageItem, MessageText, TypingIndicator } from "../components/Messages.tsx";
import { STARTER_PROMPTS } from "../i18n/strings.ts";
import { useChatStore } from "../store/chat-store.ts";
import { useStrings } from "../store/ui-store.ts";

export function GuestChat() {
  const t = useStrings();
  const messages = useChatStore((state) => state.messages);
  const pending = useChatStore((state) => state.pending);
  const end = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    // h-dvh, not h-screen: on phones the browser bars come and go, and dvh follows them.
    <div className="flex h-dvh flex-col bg-slate-50">
      <Header>
        <NewChatButton />
        <PageLink href="/staff" label={t.staff.openDashboard} icon="staff" />
      </Header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-4" aria-live="polite">
          {messages.length === 0 ? <Welcome /> : messages.map((message) => <MessageItem key={message.id} message={message} />)}
          {pending && <TypingIndicator />}
          <div ref={end} />
        </div>
      </main>
      <Composer />
    </div>
  );
}

function Welcome() {
  const t = useStrings();
  const send = useChatStore((state) => state.send);

  return (
    <>
      <Bubble from="assistant">
        <MessageText text={t.welcome} />
      </Bubble>
      <p className="mt-2 text-sm font-medium text-slate-500">{t.startersLabel}</p>
      <div className="flex flex-col gap-2">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            dir="auto"
            onClick={() => void send(prompt)}
            className="rounded-xl border border-teal-200 bg-white px-3.5 py-2.5 text-start text-sm text-teal-900 shadow-xs transition hover:border-teal-400 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            {prompt}
          </button>
        ))}
      </div>
    </>
  );
}
