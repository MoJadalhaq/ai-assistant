# Demo video script (2 minutes)

Four scenes: a Hijazi booking with a relative date, a mixed-language FAQ, an angry guest handed
off to staff, and the eval results. Every guest message below was tried on the real app; the
replies will be worded differently each time, but the actions should be the same.

## Before recording

- [ ] Open the staff dashboard and press **Reset demo**, so the data is fresh and dated from today.
- [ ] Put two windows side by side: the guest chat at phone size on the left (browser dev tools,
      375 px wide) and `/staff` on the right, on the **Handoff tickets** tab.
- [ ] Set the chat to **Arabic** and the dashboard to **English**: it shows that both languages work.
- [ ] Have `evals/results.md` (or the Evals section of the README on GitHub) open in a third tab.
- [ ] If a reply says the AI service is busy, press **Try again** and cut the wait in editing.

The scene timings add up to 2:00. Voice-over lines are suggestions; keep them short.

---

## 0:00–0:10 · Opening

**Show:** the empty chat with the "Demo · fictional hotel" badge and the starter prompts.

**Say:** "This is an AI receptionist for a fictional hotel in Jeddah. Guests write the way Saudis
actually write: dialect, English, or both at once."

## 0:10–0:55 · A Hijazi booking with a relative date

**Type**, one message at a time:

1. `السلام عليكم، أبغى غرفة على البحر لشخصين من الخميس الجاي لين السبت`
   (Hello, I want a sea-view room for two from next Thursday until Saturday)
2. `ايوه، باسم سارة أحمد وجوالي 0500000123`
   (Yes, in the name of Sara Ahmed, my mobile is 0500000123)
3. `ايوه صح، احجزها`
   (Yes, that's right, book it)

**Point out:**
- After message 1 it names the real dates. "الخميس الجاي" (next Thursday) is resolved in code,
  not guessed by the model. It checks availability and gives the price with VAT included.
- After message 2 it reads everything back and asks for a yes. It does **not** book yet; the
  booking tool refuses in the same message the phone number arrives.
- After message 3 the booking card appears with a reference like `SDH-N24Z`. On the dashboard,
  click **Bookings**: it's at the top, marked New, with the phone number masked.

**Say:** "Dates, prices and the 'confirm first' rule are enforced in code. The model only does
the language."

## 0:55–1:15 · A mixed-language FAQ

Press **+** for a new chat, then **type**:

`هلا، عندكم parking؟ وكم أرخص غرفة لشخصين بكرة؟`
(Hi, do you have parking? And what's the cheapest room for two tomorrow?)

**Point out:** it answers in the same mixed style, takes the parking facts from the hotel's
knowledge base, and checks real availability for "بكرة" (tomorrow).

**Say:** "Hotel facts only come from the hotel's own data, through a tool. If it isn't in
the knowledge base, it hands off rather than inventing an answer."

## 1:15–1:40 · An angry guest, handed off to staff

**Type** (use the reference from the booking scene):

`المكيف خربان والغرفة حر مره، ومحد يرد على التليفون. I want to talk to the manager now! اسمي خالد، حجزي SDH-N24Z`
(The AC is broken, the room is really hot, and nobody answers the phone. I want to talk to the
manager now! My name is Khaled, my booking is SDH-N24Z)

**Point out:**
- The chat apologises and shows a "Passed to the hotel team" card instead of trying to fix it.
- Within 5 seconds the ticket appears on the dashboard, outlined and marked **New**: high
  priority, reason "Complaint", with a summary in English and Arabic for whoever is on shift.
- Press **Mark resolved**.

**Say:** "Knowing when to stop matters more than answering everything. The ticket arrives with
a summary in both languages, so any staff member can act on it straight away."

## 1:40–2:00 · The evals

**Show:** the eval table (20/25 baseline, 25/25 after fixes) and scroll the per-case list in
`evals/results.md`.

**Say:** "The assistant is tested against 25 scripted conversations in Hijazi, Najdi, formal
Arabic, English and mixed, graded by code, not by another AI. The first run caught replies in the wrong language and
wrong weekend dates; both are fixed and covered. The code is on GitHub."

**End card:** repository link, and the line "Demo, fictional hotel".
