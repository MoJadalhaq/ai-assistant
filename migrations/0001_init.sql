-- Sahil Demo Hotel (fictional): first schema.
-- Dates are 'YYYY-MM-DD' text in Riyadh time. Money is whole halalas (1 SAR = 100 halalas).
-- CHECK constraints keep bad values out even if a bug slips past the TypeScript validation.

CREATE TABLE rooms (
  code                 TEXT PRIMARY KEY,   -- e.g. 'deluxe-sea'; the id the AI passes to tools
  name_en              TEXT NOT NULL,
  name_ar              TEXT NOT NULL,
  description_en       TEXT NOT NULL,
  description_ar       TEXT NOT NULL,
  capacity             INTEGER NOT NULL CHECK (capacity > 0),            -- guests per room, children included
  nightly_rate_halalas INTEGER NOT NULL CHECK (nightly_rate_halalas > 0), -- VAT included
  total_units          INTEGER NOT NULL CHECK (total_units > 0)           -- rooms of this type in the hotel
);

CREATE TABLE bookings (
  id             INTEGER PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,     -- given to the guest, e.g. 'SDH-7K3Q'
  session_id     TEXT,                     -- chat session that created it; NULL for seeded rows
  guest_name     TEXT NOT NULL,
  phone          TEXT NOT NULL,
  room_code      TEXT NOT NULL REFERENCES rooms(code),
  check_in       TEXT NOT NULL,
  check_out      TEXT NOT NULL,            -- the guest does not sleep the check-out night
  nights         INTEGER NOT NULL CHECK (nights > 0),
  guests         INTEGER NOT NULL CHECK (guests > 0),
  rooms          INTEGER NOT NULL DEFAULT 1 CHECK (rooms BETWEEN 1 AND 3),
  total_halalas  INTEGER NOT NULL CHECK (total_halalas > 0),  -- price snapshot at booking time
  notes          TEXT,
  status         TEXT NOT NULL CHECK (status IN ('hold', 'confirmed', 'cancelled')),
  language       TEXT NOT NULL CHECK (language IN ('ar', 'en', 'mixed')),
  created_at     TEXT NOT NULL,            -- UTC, ISO 8601
  CHECK (check_out > check_in)
);

-- Availability looks up the bookings of one room type around a date range.
CREATE INDEX bookings_by_room_and_dates ON bookings (room_code, check_in, check_out);

CREATE TABLE tickets (
  id                INTEGER PRIMARY KEY,
  session_id        TEXT,
  reason            TEXT NOT NULL CHECK (reason IN (
                      'human_request', 'complaint', 'out_of_scope', 'group_booking',
                      'special_pricing', 'medical_or_accessibility', 'other')),
  urgency           TEXT NOT NULL CHECK (urgency IN ('low', 'normal', 'high')),
  summary_en        TEXT NOT NULL,
  summary_ar        TEXT NOT NULL,
  guest_name        TEXT,
  phone             TEXT,
  booking_reference TEXT,
  language          TEXT NOT NULL CHECK (language IN ('ar', 'en', 'mixed')),
  status            TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
  created_at        TEXT NOT NULL,
  resolved_at       TEXT
);

CREATE INDEX tickets_by_status ON tickets (status, created_at);

-- Chat log, written from Phase 2 on. Kept short and wiped by the daily reset.
CREATE TABLE conversations (
  id         INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content    TEXT NOT NULL,
  language   TEXT CHECK (language IN ('ar', 'en', 'mixed')),
  created_at TEXT NOT NULL
);

CREATE INDEX conversations_by_session ON conversations (session_id, id);
