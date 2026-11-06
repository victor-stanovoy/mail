import "server-only";
import { z } from "zod";
import { SIZE_IDS, TARIFF_IDS } from "@/config/service";
import { findPromo } from "@/config/promos";
import { admin } from "./supabase-admin";
import { geocodeVienna, type Geocoded } from "./geocode";
import { HttpError } from "./http";
import { OutOfAreaError, priceDelivery, type Quote } from "./pricing";

const address = (what: string) =>
  z.string({ required_error: `${what} address is required` }).trim().min(5, `Please enter a full ${what.toLowerCase()} address`).max(200);

export const QuoteInput = z.object({
  pickupAddress: address("Pickup"),
  dropoffAddress: address("Drop-off"),
  size: z.enum(SIZE_IDS, { errorMap: () => ({ message: "Choose a parcel size" }) }),
  tariff: z.enum(TARIFF_IDS, { errorMap: () => ({ message: "Choose a tariff" }) }),
  promoCode: z.string().trim().max(40).optional(),
});
export type QuoteInput = z.infer<typeof QuoteInput>;

export interface PlacedQuote {
  quote: Quote;
  pickup: Geocoded & { address: string };
  dropoff: Geocoded & { address: string };
}

/** Geocodes both addresses, checks the service area and prices the delivery (promo included). */
export async function buildQuote(input: QuoteInput, senderId: string | null): Promise<PlacedQuote> {
  const pickup = await geocodeVienna(input.pickupAddress);
  if (!pickup) throw new HttpError(422, "We couldn't find the pickup address. Please include street, number and postcode.");
  const dropoff = await geocodeVienna(input.dropoffAddress);
  if (!dropoff) throw new HttpError(422, "We couldn't find the drop-off address. Please include street, number and postcode.");

  const code = input.promoCode?.toUpperCase() || null;
  let promo;
  if (code) {
    const def = findPromo(code);
    let totalRedemptions = 0;
    let senderRedemptions = 0;
    if (def && (def.maxRedemptions != null || def.oncePerSender)) {
      const db = admin();
      const total = await db.from("mail_promo_redemptions").select("id", { count: "exact", head: true }).eq("code", code);
      if (total.error) throw total.error;
      totalRedemptions = total.count ?? 0;
      if (senderId) {
        const mine = await db
          .from("mail_promo_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("code", code)
          .eq("sender_id", senderId);
        if (mine.error) throw mine.error;
        senderRedemptions = mine.count ?? 0;
      }
    }
    promo = { code, def, totalRedemptions, senderRedemptions };
  }

  try {
    const quote = priceDelivery({ pickup, dropoff, size: input.size, tariff: input.tariff, promo });
    return {
      quote,
      pickup: { ...pickup, address: input.pickupAddress },
      dropoff: { ...dropoff, address: input.dropoffAddress },
    };
  } catch (e) {
    if (e instanceof OutOfAreaError) throw new HttpError(422, e.message);
    throw e;
  }
}
