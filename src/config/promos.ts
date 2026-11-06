import type { SizeId, TariffId } from "./service";

/**
 * =====================================================================
 *  PROMO CODES: edit here. Server-side only (never imported by client code),
 *  so codes can't be read from the browser bundle.
 *  Codes are case-insensitive. The values below are placeholders, change them.
 * =====================================================================
 */
export interface Promo {
  /** Shown to the customer when the code is applied. */
  description: string;
  type: "percent" | "fixed";
  /** percent: 20 = 20% off. fixed: amount in cents. */
  value: number;
  /** Upper limit for percent codes, in cents. */
  maxDiscountCents?: number;
  /** ISO timestamps. Omit for "always valid". */
  validFrom?: string;
  validUntil?: string;
  /** Total redemptions across all senders. Cancelled deliveries free the slot again. */
  maxRedemptions?: number;
  /** Each sender account may use the code once. */
  oncePerSender?: boolean;
  /** Minimum price before discount, in cents. */
  minSubtotalCents?: number;
  /** Restrict to certain tariffs / parcel sizes. */
  tariffs?: TariffId[];
  sizes?: SizeId[];
}

export const PROMOS: Record<string, Promo> = {
  SPARKNEWS: {
    description: "SparkNews readers: 20% off (max. EUR 5.00)",
    type: "percent",
    value: 20,
    maxDiscountCents: 500,
    validUntil: "2027-06-30T23:59:59+02:00",
  },
  WELCOME5: {
    description: "EUR 5.00 off your first delivery",
    type: "fixed",
    value: 500,
    oncePerSender: true,
    minSubtotalCents: 800,
  },
};

export function findPromo(code: string): Promo | undefined {
  // hasOwnProperty so inputs like "constructor" or "__proto__" never match.
  return Object.prototype.hasOwnProperty.call(PROMOS, code) ? PROMOS[code] : undefined;
}
