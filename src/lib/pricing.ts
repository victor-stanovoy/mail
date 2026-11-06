import { PARCEL_SIZES, SCHOOL, SERVICE_RADIUS_KM, TARIFFS, type SizeId, type TariffId } from "@/config/service";
import type { Promo } from "@/config/promos";
import { haversineKm, type LatLng } from "./geo";

export class OutOfAreaError extends Error {
  constructor(
    public which: "pickup" | "dropoff",
    public distanceKm: number,
    public limitKm: number,
  ) {
    super(
      `The ${which === "pickup" ? "pickup" : "drop-off"} address is ${distanceKm.toFixed(1)} km from ${SCHOOL.name}. ` +
        `This tariff delivers within ${limitKm} km.`,
    );
    this.name = "OutOfAreaError";
  }
}

export interface PromoContext {
  code: string;
  /** undefined = unknown code */
  def: Promo | undefined;
  totalRedemptions: number;
  senderRedemptions: number;
}

export interface Quote {
  tariff: TariffId;
  size: SizeId;
  zone: string;
  /** Distance of the farther address from the school. */
  distanceKm: number;
  baseCents: number;
  sizeCents: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  promo: { code: string; description: string; discountCents: number } | null;
  /** Set when a code was entered but could not be applied. */
  promoError: string | null;
  eta: string;
}

export interface PriceInput {
  pickup: LatLng;
  dropoff: LatLng;
  size: SizeId;
  tariff: TariffId;
  promo?: PromoContext;
  now?: Date;
}

type PromoResult = { ok: true; discountCents: number } | { ok: false; reason: string };

export function evaluatePromo(
  ctx: PromoContext,
  sale: { subtotalCents: number; tariff: TariffId; size: SizeId },
  now: Date,
): PromoResult {
  const p = ctx.def;
  if (!p) return { ok: false, reason: "This promo code is not valid." };
  if (p.validFrom && now < new Date(p.validFrom)) return { ok: false, reason: "This promo code is not active yet." };
  if (p.validUntil && now > new Date(p.validUntil)) return { ok: false, reason: "This promo code has expired." };
  if (p.tariffs && !p.tariffs.includes(sale.tariff)) return { ok: false, reason: "This code doesn't apply to the selected tariff." };
  if (p.sizes && !p.sizes.includes(sale.size)) return { ok: false, reason: "This code doesn't apply to the selected parcel size." };
  if (p.minSubtotalCents != null && sale.subtotalCents < p.minSubtotalCents) {
    return { ok: false, reason: "The order is below the minimum value for this code." };
  }
  if (p.maxRedemptions != null && ctx.totalRedemptions >= p.maxRedemptions) {
    return { ok: false, reason: "This promo code has been fully redeemed." };
  }
  if (p.oncePerSender && ctx.senderRedemptions > 0) {
    return { ok: false, reason: "You have already used this promo code." };
  }

  let discount = p.type === "percent" ? Math.round((sale.subtotalCents * p.value) / 100) : p.value;
  if (p.maxDiscountCents != null) discount = Math.min(discount, p.maxDiscountCents);
  discount = Math.max(0, Math.min(discount, sale.subtotalCents));
  return { ok: true, discountCents: discount };
}

/**
 * The single source of truth for what a delivery costs.
 * Zone is decided by the address that is FARTHER from the school.
 * Throws OutOfAreaError when an address is outside the service radius / the tariff's last zone.
 */
export function priceDelivery(input: PriceInput): Quote {
  const size = PARCEL_SIZES[input.size];
  const tariff = TARIFFS[input.tariff];
  const now = input.now ?? new Date();

  const pickupKm = haversineKm(SCHOOL, input.pickup);
  const dropoffKm = haversineKm(SCHOOL, input.dropoff);
  const distanceKm = Math.max(pickupKm, dropoffKm);

  const lastZoneKm = tariff.zones[tariff.zones.length - 1]?.maxKm ?? 0;
  const limitKm = Math.min(SERVICE_RADIUS_KM, lastZoneKm);
  if (distanceKm > limitKm) {
    throw new OutOfAreaError(pickupKm >= dropoffKm ? "pickup" : "dropoff", distanceKm, limitKm);
  }

  const zone = tariff.zones.find((z) => distanceKm <= z.maxKm);
  if (!zone) throw new OutOfAreaError("dropoff", distanceKm, limitKm); // unreachable with sorted zones

  const baseCents = zone.priceCents;
  const sizeCents = size.surchargeCents;
  const subtotalCents = baseCents + sizeCents;

  let discountCents = 0;
  let promo: Quote["promo"] = null;
  let promoError: string | null = null;
  if (input.promo) {
    const result = evaluatePromo(input.promo, { subtotalCents, tariff: input.tariff, size: input.size }, now);
    if (result.ok) {
      discountCents = result.discountCents;
      promo = {
        code: input.promo.code,
        description: input.promo.def!.description,
        discountCents,
      };
    } else {
      promoError = result.reason;
    }
  }

  return {
    tariff: input.tariff,
    size: input.size,
    zone: zone.name,
    distanceKm: Math.round(distanceKm * 100) / 100,
    baseCents,
    sizeCents,
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    promo,
    promoError,
    eta: tariff.eta,
  };
}
