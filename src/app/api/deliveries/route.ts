import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { HttpError, rateLimit, route } from "@/lib/http";
import { QuoteInput, buildQuote } from "@/lib/quote-service";
import { admin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const BookInput = QuoteInput.extend({
  recipientName: z.string().trim().min(2, "Recipient name is required").max(120),
  recipientPhone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
});

// No 0/O/1/I so codes are easy to read out over the phone.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function trackingCode() {
  const bytes = randomBytes(8);
  return "VM-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Books a delivery. The price is always recomputed here: nothing price-related is trusted from the browser. */
export const POST = route(async (req) => {
  rateLimit(req, "book", 10);
  const caller = await requireUser(req);
  const input = BookInput.parse(await req.json().catch(() => ({})));
  const { quote, pickup, dropoff } = await buildQuote(input, caller.user.id);

  if (input.promoCode && quote.promoError) throw new HttpError(422, quote.promoError);

  const db = admin();
  let delivery = null;
  for (let attempt = 0; attempt < 3 && !delivery; attempt++) {
    const res = await db
      .from("mail_deliveries")
      .insert({
        tracking_code: trackingCode(),
        sender_id: caller.user.id,
        tariff: quote.tariff,
        parcel_size: quote.size,
        pickup_address: pickup.address,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_address: dropoff.address,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone || null,
        notes: input.notes || null,
        distance_km: quote.distanceKm,
        zone: quote.zone,
        subtotal_cents: quote.subtotalCents,
        discount_cents: quote.discountCents,
        total_cents: quote.totalCents,
        promo_code: quote.promo?.code ?? null,
      })
      .select()
      .single();
    if (res.error?.code === "23505") continue; // tracking code collision, try again
    if (res.error) throw res.error;
    delivery = res.data;
  }
  if (!delivery) throw new HttpError(500, "Could not create the delivery. Please try again.");

  await db.from("mail_status_events").insert({ delivery_id: delivery.id, status: "pending", actor_id: caller.user.id });
  if (quote.promo) {
    await db.from("mail_promo_redemptions").insert({
      code: quote.promo.code,
      sender_id: caller.user.id,
      delivery_id: delivery.id,
      discount_cents: quote.discountCents,
    });
  }

  return { delivery, quote };
}, 201);
