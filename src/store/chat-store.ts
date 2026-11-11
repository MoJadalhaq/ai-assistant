import { create } from "zustand";
import type { ChatEvent, ChatTurn, ToolCallSummary } from "../../shared/api-types.ts";
import { sendChat } from "../api/client.ts";
import type { ClientErrorCode } from "../api/client.ts";

export type ChatMessage =
  | { id: string; role: "guest"; text: string; failed?: boolean }
  | { id: string; role: "assistant"; text: string; events: ChatEvent[]; toolCalls: ToolCallSummary[] }
  | { id: string; role: "error"; error: ClientErrorCode };

interface ChatState {
  /** Random per conversation. Links the server's logs, bookings and tickets to this chat. */
  sessionId: string;
  messages: ChatMessage[];
  pending: boolean;
  send: (text: string) => Promise<void>;
  /** Sends the last failed message again. */
  retry: () => Promise<void>;
  reset: () => void;
}

/**
 * The conversation as the server expects it. The server keeps no chat state, so the browser
 * sends this with every message. Failed messages and error notices are left out: the model
 * never saw them.
 */
function toHistory(messages: ChatMessage[]): ChatTurn[] {
  return messages.flatMap((message): ChatTurn[] => {
    if (message.role === "guest" && !message.failed) return [{ role: "user", text: message.text }];
    if (message.role === "assistant") return [{ role: "assistant", text: message.text, toolCalls: message.toolCalls }];
    return [];
  });
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessionId: crypto.randomUUID(),
  messages: [],
  pending: false,

  async send(text) {
    const message = text.trim();
    if (!message || get().pending) return;

    const { sessionId } = get();
    const history = toHistory(get().messages);
    const guest: ChatMessage = { id: crypto.randomUUID(), role: "guest", text: message };
    set((state) => ({ messages: [...state.messages, guest], pending: true }));

    const result = await sendChat({ sessionId, message, history });

    // The guest may have started a new chat while waiting: drop the late answer.
    if (get().sessionId !== sessionId) return;

    if (result.ok) {
      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: result.reply,
        events: result.events,
        toolCalls: result.toolCalls,
      };
      set((state) => ({ messages: [...state.messages, reply], pending: false }));
    } else {
      const notice: ChatMessage = { id: crypto.randomUUID(), role: "error", error: result.error };
      set((state) => ({
        messages: [...state.messages.map((item) => (item.id === guest.id ? { ...guest, failed: true } : item)), notice],
        pending: false,
      }));
    }
  },

  async retry() {
    const failed = get().messages.findLast((message) => message.role === "guest" && message.failed);
    if (!failed || failed.role !== "guest") return;
    set((state) => ({ messages: state.messages.filter((message) => message.id !== failed.id && message.role !== "error") }));
    await get().send(failed.text);
  },

  reset() {
    set({ sessionId: crypto.randomUUID(), messages: [], pending: false });
  },
}));
