// Knowledge base for Sahil Demo Hotel, Jeddah.
//
// THE HOTEL IS FICTIONAL. Every name, price and policy below is made up for this demo.
//
// This file is the single place hotel facts are written down:
//   - ROOM_TYPES is copied into the D1 `rooms` table by the seed.
//   - INFO_TOPICS is what the get_hotel_info tool returns to the AI.
// The AI is told to answer only from what these give it, so a fact that is
// not in this file is a fact the assistant does not know (and hands off to staff).
//
// All prices are in Saudi riyals and include 15% VAT.

import type { Room } from "../../shared/types.ts";

export const HOTEL_NAME_EN = "Sahil Demo Hotel, Jeddah";
export const HOTEL_NAME_AR = "فندق ساحل التجريبي، جدة";

export const ROOM_TYPES: Room[] = [
  {
    code: "standard-city",
    nameEn: "Standard Room (City View)",
    nameAr: "غرفة قياسية بإطلالة على المدينة",
    descriptionEn: "24 m², one king bed or two twin beds, city view.",
    descriptionAr: "مساحة 24 م²، سرير كينج أو سريران منفردان، إطلالة على المدينة.",
    capacity: 2,
    nightlyRateHalalas: 46_000, // SAR 460
    totalUnits: 8,
  },
  {
    code: "deluxe-sea",
    nameEn: "Deluxe Room (Sea View)",
    nameAr: "غرفة ديلوكس بإطلالة بحرية",
    descriptionEn: "32 m², king bed and a sofa bed, balcony facing the Red Sea.",
    descriptionAr: "مساحة 32 م²، سرير كينج مع أريكة سرير، شرفة مطلة على البحر الأحمر.",
    capacity: 3,
    nightlyRateHalalas: 69_000, // SAR 690
    totalUnits: 6,
  },
  {
    code: "family-room",
    nameEn: "Family Room",
    nameAr: "غرفة عائلية",
    descriptionEn: "45 m², two connected bedrooms (one king bed, two twin beds) and a sofa bed.",
    descriptionAr: "مساحة 45 م²، غرفتا نوم متصلتان (سرير كينج وسريران منفردان) مع أريكة سرير.",
    capacity: 5,
    nightlyRateHalalas: 92_000, // SAR 920
    totalUnits: 4,
  },
  {
    code: "executive-suite",
    nameEn: "Executive Suite (Sea View)",
    nameAr: "جناح تنفيذي بإطلالة بحرية",
    descriptionEn: "60 m², separate living room, king bed, wide Red Sea view, executive lounge access.",
    descriptionAr: "مساحة 60 م²، صالة جلوس مستقلة، سرير كينج، إطلالة واسعة على البحر الأحمر، ودخول إلى الصالة التنفيذية.",
    capacity: 3,
    nightlyRateHalalas: 138_000, // SAR 1,380
    totalUnits: 2,
  },
];

export interface InfoTopic {
  /** What the AI passes to get_hotel_info. */
  id: string;
  /** One line telling the AI what the topic covers, shown in its instructions. */
  covers: string;
  en: string;
  ar: string;
}

/** Room types and prices are not in INFO_TOPICS: they come from the `rooms` table. */
export const ROOMS_TOPIC = {
  id: "rooms",
  covers: "room types, what each room has, how many guests it takes, price per night",
} as const;

export const INFO_TOPICS: InfoTopic[] = [
  {
    id: "check_in_out",
    covers: "check-in and check-out times, early check-in, late check-out, ID needed, luggage storage",
    en: "Check-in is from 3:00 PM and check-out is by 12:00 noon. Early check-in from 10:00 AM and late check-out until 4:00 PM depend on availability and cost SAR 115 each (VAT included). The front desk is open 24 hours. A valid ID or passport is needed at check-in. Luggage storage is free.",
    ar: "تسجيل الدخول من الساعة 3:00 عصراً، وتسجيل المغادرة حتى الساعة 12:00 ظهراً. الدخول المبكر من الساعة 10:00 صباحاً والمغادرة المتأخرة حتى الساعة 4:00 عصراً حسب التوفر، ورسم كل منهما 115 ريالاً (شامل الضريبة). مكتب الاستقبال يعمل على مدار الساعة. يلزم إبراز هوية سارية أو جواز سفر عند تسجيل الدخول. حفظ الأمتعة مجاني.",
  },
  {
    id: "breakfast",
    covers: "breakfast hours, place and price",
    en: "Buffet breakfast is served every day from 6:30 to 10:30 AM, and until 11:00 AM on Fridays and Saturdays, at Marsa Restaurant on the ground floor. Breakfast is not included in the room price: SAR 85 per adult, SAR 45 per child aged 6 to 11, free for children under 6 (VAT included).",
    ar: "بوفيه الإفطار يومياً من 6:30 إلى 10:30 صباحاً، وحتى 11:00 صباحاً يومي الجمعة والسبت، في مطعم «مرسى» بالدور الأرضي. الإفطار غير مشمول في سعر الغرفة: 85 ريالاً للبالغ، و45 ريالاً للطفل من 6 إلى 11 سنة، ومجاناً لمن هم دون 6 سنوات (الأسعار شاملة الضريبة).",
  },
  {
    id: "dining",
    covers: "restaurant, cafe and room service hours",
    en: "Marsa Restaurant serves international and Saudi dishes from 6:30 AM to 11:00 PM. The lobby cafe is open 24 hours. Room service is available 24 hours.",
    ar: "مطعم «مرسى» يقدم أطباقاً عالمية وسعودية من 6:30 صباحاً حتى 11:00 مساءً. مقهى البهو يعمل على مدار الساعة. خدمة الغرف متاحة على مدار الساعة.",
  },
  {
    id: "parking",
    covers: "car parking, valet, electric car charging",
    en: "Parking is free for hotel guests in the basement car park, open 24 hours. Valet parking costs SAR 35 per day (VAT included). There are two electric car charging points, first come, first served.",
    ar: "المواقف مجانية لنزلاء الفندق في القبو وتعمل على مدار الساعة. خدمة صف السيارات بـ 35 ريالاً في اليوم (شامل الضريبة). تتوفر نقطتان لشحن السيارات الكهربائية حسب الأسبقية.",
  },
  {
    id: "airport_transfer",
    covers: "airport pickup and drop-off: price, travel time, how to request it",
    en: "Private transfer between the hotel and King Abdulaziz International Airport (JED) costs SAR 180 per car each way for up to 3 passengers, or SAR 260 for a family van for up to 6 passengers (VAT included). The drive takes about 30 minutes. It must be requested at least 12 hours before the flight, with the flight number. The request can be added to the notes of a booking; the hotel team then confirms it.",
    ar: "خدمة توصيل خاصة بين الفندق ومطار الملك عبدالعزيز الدولي (JED): 180 ريالاً للسيارة في الاتجاه الواحد لعدد يصل إلى 3 ركاب، أو 260 ريالاً للسيارة العائلية لعدد يصل إلى 6 ركاب (شامل الضريبة). مدة الطريق نحو 30 دقيقة. يُطلب قبل موعد الرحلة بـ 12 ساعة على الأقل مع رقم الرحلة. يمكن إضافة الطلب في ملاحظات الحجز، ثم يؤكده فريق الفندق.",
  },
  {
    id: "location",
    covers: "where the hotel is and how far it is from the airport, the old town, the train station and Makkah",
    en: "The hotel is on the Jeddah Corniche, facing the Red Sea (this is a demo: there is no real street address). By car it is about 30 minutes from King Abdulaziz International Airport, 20 minutes from Al-Balad (historic Jeddah), 25 minutes from the Haramain High Speed Railway station, and about an hour and a half from Makkah.",
    ar: "يقع الفندق على كورنيش جدة مقابل البحر الأحمر (هذا عرض تجريبي ولا يوجد عنوان حقيقي). يبعد بالسيارة نحو 30 دقيقة عن مطار الملك عبدالعزيز الدولي، و20 دقيقة عن جدة التاريخية (البلد)، و25 دقيقة عن محطة قطار الحرمين السريع، ونحو ساعة ونصف عن مكة المكرمة.",
  },
  {
    id: "wifi",
    covers: "internet access",
    en: "Wi-Fi is free and fast in all rooms and public areas. To connect, guests enter their room number and family name.",
    ar: "الواي فاي مجاني وسريع في جميع الغرف والمرافق العامة. للاتصال يُدخل الضيف رقم الغرفة واسم العائلة.",
  },
  {
    id: "facilities",
    covers: "pool, gym, prayer rooms, kids' club and their opening hours",
    en: "The outdoor pool is open from 7:00 AM to 10:00 PM, with ladies-only hours every day from 9:00 to 11:00 AM. The gym is open 24 hours. There are separate prayer rooms for men and women on the first floor. The kids' club is open from 10:00 AM to 8:00 PM for ages 4 to 12.",
    ar: "المسبح الخارجي مفتوح من 7:00 صباحاً حتى 10:00 مساءً، مع فترة خاصة بالسيدات يومياً من 9:00 إلى 11:00 صباحاً. النادي الرياضي يعمل على مدار الساعة. يوجد مصلى للرجال وآخر للنساء في الدور الأول. نادي الأطفال مفتوح من 10:00 صباحاً حتى 8:00 مساءً للأعمار من 4 إلى 12 سنة.",
  },
  {
    id: "booking_policy",
    covers: "what a booking hold is, how it gets confirmed, cancellation rules",
    en: "A booking made in this chat is a hold, not a confirmed reservation, and no payment is taken. The reservations team contacts the guest to confirm it. A hold that is not confirmed within 24 hours is released. A confirmed booking can be cancelled free of charge up to 48 hours before check-in; after that, or for a no-show, one night is charged.",
    ar: "الحجز عبر هذه المحادثة حجز مبدئي وليس حجزاً مؤكداً، ولا يُطلب أي دفع. يتواصل فريق الحجوزات مع الضيف لتأكيده، ويُلغى الحجز المبدئي إذا لم يُؤكَّد خلال 24 ساعة. يمكن إلغاء الحجز المؤكد مجاناً حتى 48 ساعة قبل موعد الدخول، وبعد ذلك أو عند عدم الحضور تُحتسب ليلة واحدة.",
  },
  {
    id: "payment",
    covers: "how and when guests pay, currency, VAT",
    en: "Payment is made at the hotel at check-in, by debit card, credit card, mobile wallet or cash. All prices are in Saudi riyals (SAR) and include 15% VAT. The assistant never asks for card or payment details.",
    ar: "الدفع في الفندق عند تسجيل الدخول، ببطاقة الخصم أو البطاقة الائتمانية أو المحفظة الرقمية أو نقداً. جميع الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة 15%. لا يطلب المساعد أي بيانات بطاقات أو دفع.",
  },
  {
    id: "family_kids",
    covers: "children, baby cots, extra beds",
    en: "Room capacity counts every guest, children included. Baby cots are free on request. An extra bed costs SAR 115 per night (VAT included) and is available only in Deluxe rooms and Executive Suites. Children under 6 have breakfast free.",
    ar: "سعة الغرفة تشمل جميع الضيوف بمن فيهم الأطفال. سرير الأطفال الرضّع مجاني عند الطلب. السرير الإضافي بـ 115 ريالاً في الليلة (شامل الضريبة) ومتاح فقط في غرف الديلوكس والأجنحة التنفيذية. الإفطار مجاني للأطفال دون 6 سنوات.",
  },
  {
    id: "smoking_pets",
    covers: "smoking rules and pets",
    en: "All rooms and indoor areas are non-smoking. There is an outdoor smoking area next to the pool terrace. Pets are not allowed, except service animals.",
    ar: "جميع الغرف والأماكن المغلقة لغير المدخنين، وتوجد منطقة تدخين خارجية بجوار تراس المسبح. لا يُسمح باصطحاب الحيوانات الأليفة، عدا حيوانات الخدمة.",
  },
  {
    id: "accessibility",
    covers: "step-free access and accessible rooms (arranged by staff only)",
    en: "The hotel has a step-free entrance, lifts to every floor and a small number of accessible rooms. Accessible rooms and any medical or mobility needs are arranged by the hotel team, not by the assistant: hand the guest off to staff.",
    ar: "في الفندق مدخل بلا درج ومصاعد إلى جميع الأدوار وعدد محدود من الغرف المهيأة لذوي الإعاقة. ترتيب هذه الغرف وأي احتياجات طبية أو حركية يتولاه فريق الفندق وليس المساعد: يُحوَّل الضيف إلى الموظفين.",
  },
  {
    id: "contact",
    covers: "how to reach a person at the hotel",
    en: "The front desk is staffed 24 hours. This is a demo hotel with no real phone number or email address. To reach a person, the assistant hands the conversation to the hotel team.",
    ar: "مكتب الاستقبال يعمل على مدار الساعة. هذا فندق تجريبي وليس له رقم هاتف أو بريد إلكتروني حقيقي. للتحدث مع موظف يحوّل المساعد المحادثة إلى فريق الفندق.",
  },
];

/** Every id get_hotel_info accepts, in the order shown to the AI. */
export const TOPIC_IDS: string[] = [ROOMS_TOPIC.id, ...INFO_TOPICS.map((topic) => topic.id)];

export function findInfoTopic(id: string): InfoTopic | undefined {
  return INFO_TOPICS.find((topic) => topic.id === id);
}
