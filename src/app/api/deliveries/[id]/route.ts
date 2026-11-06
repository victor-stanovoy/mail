import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { HttpError, route } from "@/lib/http";
import { admin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const Body = z.object({ action: z.enum(["claim", "advance", "cancel"]) });
const Id = z.string().uuid("Invalid delivery id");

const NEXT_STATUS: Record<string, string> = {
  assigned: "picked_up",
  picked_up: "in_transit",
  in_transit: "delivered",
};

/**
 * Status changes.
 *  claim   (courier)  pending  -> assigned, courier = caller
 *  advance (assigned courier) assigned -> picked_up -> in_transit -> delivered
 *  cancel  (sender while pending/assigned, or any courier before delivery)
 */
export const PATCH = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const caller = await requireUser(req);
  const id = Id.parse((await ctx.params).id);
  const { action } = Body.parse(await req.json().catch(() => ({})));

  const db = admin();
  const found = await db.from("mail_deliveries").select("id, status, sender_id, courier_id").eq("id", id).maybeSingle();
  if (found.error) throw found.error;
  const d = found.data;
  if (!d) throw new HttpError(404, "Delivery not found.");

  const isCourier = caller.role === "courier";
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (action === "claim") {
    if (!isCourier) throw new HttpError(403, "Only couriers can take deliveries.");
    if (d.status !== "pending") throw new HttpError(409, "This delivery was already taken.");
    patch.status = "assigned";
    patch.courier_id = caller.user.id;
  } else if (action === "advance") {
    if (!isCourier || d.courier_id !== caller.user.id) throw new HttpError(403, "Only the assigned courier can update this delivery.");
    const next = NEXT_STATUS[d.status];
    if (!next) throw new HttpError(409, "This delivery can't be advanced further.");
    patch.status = next;
    if (next === "delivered") patch.delivered_at = new Date().toISOString();
  } else {
    const senderMayCancel = d.sender_id === caller.user.id && ["pending", "assigned"].includes(d.status);
    const courierMayCancel = isCourier && !["delivered", "cancelled"].includes(d.status);
    if (!senderMayCancel && !courierMayCancel) throw new HttpError(403, "This delivery can't be cancelled anymore.");
    patch.status = "cancelled";
  }

  // Only update if nobody changed the status in the meantime.
  const updated = await db.from("mail_deliveries").update(patch).eq("id", id).eq("status", d.status).select().maybeSingle();
  if (updated.error) throw updated.error;
  if (!updated.data) throw new HttpError(409, "This delivery was just changed by someone else. Please refresh.");

  await db.from("mail_status_events").insert({ delivery_id: id, status: patch.status, actor_id: caller.user.id });
  // A cancelled delivery gives its promo redemption back.
  if (patch.status === "cancelled") await db.from("mail_promo_redemptions").delete().eq("delivery_id", id);

  return { delivery: updated.data };
});
