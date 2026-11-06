import { describe, expect, it } from "vitest";
import { PROMOS, findPromo } from "@/config/promos";
import { PARCEL_SIZES, SCHOOL, SERVICE_RADIUS_KM, TARIFFS, TARIFF_IDS } from "@/config/service";
import { haversineKm } from "@/lib/geo";
import { OutOfAreaError, priceDelivery, type PromoContext } from "@/lib/pricing";

const school = { lat: SCHOOL.lat, lng: SCHOOL.lng };
// ~5 km from the school (Stephansdom)
const city = { lat: 48.2082, lng: 16.3738 };
// Wiener Neustadt, far outside the radius
const far = { lat: 47.8135, lng: 16.2433 };

const promoCtx = (code: string, over: Partial<PromoContext> = {}): PromoContext => ({
  code,
  def: findPromo(code),
  totalRedemptions: 0,
  senderRedemptions: 0,
  ...over,
});

describe("config sanity", () => {
  it("has sorted zones that stay inside the service radius", () => {
    for (const id of TARIFF_IDS) {
      const zones = TARIFFS[id].zones;
      expect(zones.length).toBeGreaterThan(0);
      for (let i = 1; i < zones.length; i++) expect(zones[i].maxKm).toBeGreaterThan(zones[i - 1].maxKm);
      expect(zones[zones.length - 1].maxKm).toBeLessThanOrEqual(SERVICE_RADIUS_KM);
    }
  });
  it("haversine is zero for identical points and ~5 km for the city centre", () => {
    expect(haversineKm(school, school)).toBe(0);
    expect(haversineKm(school, city)).toBeGreaterThan(3);
    expect(haversineKm(school, city)).toBeLessThan(8);
  });
});

describe("priceDelivery", () => {
  it("prices from the zone of the farther address plus the size surcharge", () => {
    const q = priceDelivery({ pickup: school, dropoff: city, size: "medium", tariff: "standard" });
    const d = haversineKm(school, city);
    const zone = TARIFFS.standard.zones.find((z) => d <= z.maxKm)!;
    expect(q.zone).toBe(zone.name);
    expect(q.baseCents).toBe(zone.priceCents);
    expect(q.sizeCents).toBe(PARCEL_SIZES.medium.surchargeCents);
    expect(q.totalCents).toBe(zone.priceCents + PARCEL_SIZES.medium.surchargeCents);
    expect(q.discountCents).toBe(0);
  });

  it("uses the farther of pickup and drop-off", () => {
    const a = priceDelivery({ pickup: school, dropoff: city, size: "small", tariff: "economy" });
    const b = priceDelivery({ pickup: city, dropoff: school, size: "small", tariff: "economy" });
    expect(a.totalCents).toBe(b.totalCents);
    expect(a.zone).not.toBe(TARIFFS.economy.zones[0].name);
  });

  it("rejects addresses outside the service area", () => {
    expect(() => priceDelivery({ pickup: school, dropoff: far, size: "small", tariff: "standard" })).toThrow(OutOfAreaError);
  });
});

describe("promo codes", () => {
  const base = { pickup: school, dropoff: city, size: "small" as const, tariff: "standard" as const };

  it("applies SPARKNEWS as a capped percentage", () => {
    const p = PROMOS.SPARKNEWS;
    const plain = priceDelivery(base);
    const q = priceDelivery({ ...base, now: new Date("2026-11-06T10:00:00+01:00"), promo: promoCtx("SPARKNEWS") });
    const expected = Math.min(Math.round((plain.subtotalCents * p.value) / 100), p.maxDiscountCents ?? Infinity);
    expect(q.promo?.code).toBe("SPARKNEWS");
    expect(q.discountCents).toBe(expected);
    expect(q.totalCents).toBe(plain.subtotalCents - expected);
    expect(q.promoError).toBeNull();
  });

  it("rejects unknown codes, including prototype keys", () => {
    for (const code of ["NOPE", "CONSTRUCTOR", "__PROTO__", "constructor"]) {
      const q = priceDelivery({ ...base, promo: promoCtx(code) });
      expect(q.discountCents).toBe(0);
      expect(q.promoError).toBeTruthy();
    }
  });

  it("rejects expired codes", () => {
    const q = priceDelivery({ ...base, now: new Date("2030-01-01T00:00:00Z"), promo: promoCtx("SPARKNEWS") });
    expect(q.discountCents).toBe(0);
    expect(q.promoError).toMatch(/expired/i);
  });

  it("enforces once-per-sender and never discounts below zero", () => {
    const used = priceDelivery({ ...base, promo: promoCtx("WELCOME5", { senderRedemptions: 1 }) });
    expect(used.promoError).toMatch(/already used/i);
    const fresh = priceDelivery({ ...base, tariff: "standard", promo: promoCtx("WELCOME5") });
    expect(fresh.totalCents).toBeGreaterThanOrEqual(0);
    expect(fresh.discountCents).toBeLessThanOrEqual(fresh.subtotalCents);
  });
});
