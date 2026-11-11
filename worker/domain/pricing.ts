// Money is kept as whole halalas (1 SAR = 100 halalas).
// Whole numbers add and multiply exactly; 0.1 + 0.2 style rounding errors can't creep into a bill.

export const VAT_PERCENT = 15;
const HALALAS_PER_SAR = 100;

/** Price of a stay. The nightly rate already includes VAT, so the total does too. */
export function stayTotalHalalas(nightlyRateHalalas: number, nights: number, rooms: number): number {
  return nightlyRateHalalas * nights * rooms;
}

/**
 * The VAT that is already inside a VAT-inclusive amount.
 * gross = net x 1.15, so VAT = gross x 15 / 115 (not gross x 0.15, a common mistake).
 */
export function vatIncludedHalalas(grossHalalas: number): number {
  return Math.round((grossHalalas * VAT_PERCENT) / (100 + VAT_PERCENT));
}

/** For showing a price: 138000 halalas is 1380 SAR. */
export function halalasToSar(halalas: number): number {
  return halalas / HALALAS_PER_SAR;
}
