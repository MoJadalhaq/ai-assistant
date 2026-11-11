// Booking references such as "SDH-7K3Q" (SDH = Sahil Demo Hotel).

// No 0/O and no 1/I/L: those get mixed up when a code is read out on a call or typed from a screenshot.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
export const REFERENCE_PREFIX = "SDH-";

/**
 * A new random reference. Uniqueness is enforced by the database (UNIQUE column);
 * the caller retries with a fresh code in the rare case of a clash.
 */
export function generateReferenceCode(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = REFERENCE_PREFIX;
  for (const byte of randomBytes) {
    code += ALPHABET.charAt(byte % ALPHABET.length);
  }
  return code;
}

const REFERENCE_SHAPE = new RegExp(`^${REFERENCE_PREFIX}[${ALPHABET}]{${CODE_LENGTH}}$`);

export function isReferenceCode(value: string): boolean {
  return REFERENCE_SHAPE.test(value);
}
