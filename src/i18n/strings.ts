// Every piece of UI text, in English and Arabic. A typed object instead of an i18n library:
// two languages and one screen don't need more, and TypeScript flags any missing translation.

import type { Urgency } from "../../shared/types.ts";
import type { ClientErrorCode } from "../api/client.ts";

export type UiLanguage = "ar" | "en";

/** The brief's four examples. Shown in both UI languages on purpose: they show off code-switching. */
export const STARTER_PROMPTS = [
  "عندكم غرف فاضية الويكند الجاي لشخصين؟",
  "What time is check-in, and do you have airport pickup?",
  "أبغى أحجز suite لثلاث ليالي من الخميس",
  "I want to speak to a manager",
];

const en = {
  pageTitle: "Sahil Demo Hotel · AI receptionist (demo)",
  hotelName: "Sahil Demo Hotel",
  city: "Jeddah",
  demoBadge: "Demo · fictional hotel",
  switchLanguage: "العربية",
  newChat: "New chat",
  welcome:
    "Hello! I'm the hotel's AI receptionist. I can answer questions, check which rooms are free and hold a booking for you. Write in Arabic, English or both.",
  startersLabel: "Try one of these",
  privacyNote: "Demo only: please use made-up names and phone numbers. Messages are processed by Google Gemini.",
  placeholder: "Type your message…",
  send: "Send",
  typing: "The receptionist is typing",
  booking: {
    title: "Booking hold created",
    reference: "Reference",
    nights: (count: number) => (count === 1 ? "1 night" : `${count} nights`),
    guests: (count: number) => (count === 1 ? "1 guest" : `${count} guests`),
    rooms: (count: number) => `${count} rooms`,
    total: "Total",
    vatIncluded: (vat: string) => `incl. ${vat} VAT`,
    note: "This is a hold, not a confirmed booking. No payment was taken; the reservations team will contact you to confirm.",
  },
  ticket: {
    title: "Passed to the hotel team",
    number: (id: number) => `Ticket #${id}`,
    urgency: { low: "Low priority", normal: "Normal priority", high: "High priority" } satisfies Record<Urgency, string>,
    note: "A member of staff will follow up with you.",
  },
  errors: {
    rate_limited: "You're sending messages quickly. Please wait a minute, then try again.",
    daily_limit: "You've reached today's message limit for this demo. Please come back tomorrow.",
    demo_quota_used: "The demo has used up its free AI budget for today. Please come back tomorrow.",
    model_busy: "The AI service is busy right now. Please try again in a few seconds.",
    invalid_request: "That message couldn't be sent. Please try writing it another way.",
    not_configured: "The demo isn't fully set up yet: the AI key is missing.",
    internal_error: "Something went wrong on our side. Please try again.",
    network_error: "Couldn't reach the server. Check your connection and try again.",
  } satisfies Record<ClientErrorCode, string>,
  retry: "Try again",
  currency: "SAR",
  staffSoon: "The staff dashboard is coming soon.",
  backToChat: "Back to the chat",
};

type Strings = typeof en;

const ar: Strings = {
  pageTitle: "فندق ساحل التجريبي · موظف استقبال ذكي (عرض تجريبي)",
  hotelName: "فندق ساحل التجريبي",
  city: "جدة",
  demoBadge: "عرض تجريبي · فندق غير حقيقي",
  switchLanguage: "English",
  newChat: "محادثة جديدة",
  welcome:
    "أهلاً وسهلاً! أنا موظف الاستقبال الذكي في الفندق. أقدر أجاوب على أسئلتك، وأشوف لك الغرف المتاحة، وأسوي لك حجز مبدئي. اكتب بالعربي أو الإنجليزي أو الاثنين مع بعض.",
  startersLabel: "جرّب واحدة من هذي",
  privacyNote: "هذا عرض تجريبي: استخدم أسماء وأرقام جوال وهمية. الرسائل تتم معالجتها عبر Google Gemini.",
  placeholder: "اكتب رسالتك…",
  send: "إرسال",
  typing: "موظف الاستقبال يكتب",
  booking: {
    title: "تم إنشاء حجز مبدئي",
    reference: "رقم الحجز",
    nights: (count) => (count === 1 ? "ليلة واحدة" : count === 2 ? "ليلتان" : `${count} ليالٍ`),
    guests: (count) => (count === 1 ? "ضيف واحد" : count === 2 ? "ضيفان" : `${count} ضيوف`),
    rooms: (count) => (count === 2 ? "غرفتان" : `${count} غرف`),
    total: "الإجمالي",
    vatIncluded: (vat) => `شامل ضريبة ${vat}`,
    note: "هذا حجز مبدئي وليس حجزاً مؤكداً. لم يتم أخذ أي مبلغ، وسيتواصل معك فريق الحجوزات لتأكيده.",
  },
  ticket: {
    title: "تم تحويل طلبك لفريق الفندق",
    number: (id) => `تذكرة رقم ${id}`,
    urgency: { low: "أولوية منخفضة", normal: "أولوية عادية", high: "أولوية عالية" },
    note: "سيتواصل معك أحد الموظفين.",
  },
  errors: {
    rate_limited: "رسائلك سريعة شوي. انتظر دقيقة وجرّب مرة ثانية.",
    daily_limit: "وصلت للحد اليومي للرسائل في هذا العرض. تقدر ترجع بكرة.",
    demo_quota_used: "العرض التجريبي استهلك رصيده المجاني من الذكاء الاصطناعي لليوم. تقدر ترجع بكرة.",
    model_busy: "خدمة الذكاء الاصطناعي مشغولة الحين. جرّب بعد ثواني.",
    invalid_request: "ما قدرنا نرسل هذي الرسالة. جرّب تكتبها بطريقة ثانية.",
    not_configured: "العرض التجريبي ما اكتمل إعداده: مفتاح الذكاء الاصطناعي ناقص.",
    internal_error: "صار خطأ عندنا. جرّب مرة ثانية.",
    network_error: "ما قدرنا نوصل للخادم. تأكد من الاتصال وجرّب مرة ثانية.",
  },
  retry: "حاول مرة ثانية",
  currency: "ريال",
  staffSoon: "لوحة الموظفين قريباً.",
  backToChat: "الرجوع للمحادثة",
};

export const STRINGS: Record<UiLanguage, Strings> = { en, ar };
