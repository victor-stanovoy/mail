/**
 * =====================================================================
 *  SERVICE CONFIGURATION: edit prices, zones and sizes here.
 *  All amounts are in euro CENTS (790 = EUR 7.90), VAT included.
 * =====================================================================
 */

/** The centre of the service area. Distances are measured from here. */
export const SCHOOL = {
  name: "Vienna International School",
  address: "Strasse der Menschenrechte 1, 1220 Wien",
  lat: 48.2402,
  lng: 16.4258,
} as const;

/**
 * Hard limit: both the pickup and the drop-off address must be within this
 * many km (straight line) of the school. A tariff can shrink this further
 * by ending its last zone earlier.
 */
export const SERVICE_RADIUS_KM = 15;

/* ----------------------------- Parcel sizes ----------------------------- */

export const SIZE_IDS = ["envelope", "small", "medium", "large"] as const;
export type SizeId = (typeof SIZE_IDS)[number];

export interface ParcelSize {
  label: string;
  description: string;
  maxWeightKg: number;
  maxDimensionsCm: string;
  /** Added on top of the tariff's zone price. */
  surchargeCents: number;
}

export const PARCEL_SIZES: Record<SizeId, ParcelSize> = {
  envelope: {
    label: "Envelope",
    description: "Letters and documents",
    maxWeightKg: 0.5,
    maxDimensionsCm: "35 x 25 x 2",
    surchargeCents: 0,
  },
  small: {
    label: "Small",
    description: "Books, small gifts",
    maxWeightKg: 3,
    maxDimensionsCm: "30 x 20 x 15",
    surchargeCents: 150,
  },
  medium: {
    label: "Medium",
    description: "Shoe box to backpack",
    maxWeightKg: 8,
    maxDimensionsCm: "50 x 40 x 30",
    surchargeCents: 350,
  },
  large: {
    label: "Large",
    description: "Moving-box size",
    maxWeightKg: 20,
    maxDimensionsCm: "80 x 60 x 50",
    surchargeCents: 800,
  },
};

/* -------------------------------- Tariffs ------------------------------- */

export const TARIFF_IDS = ["economy", "standard", "express"] as const;
export type TariffId = (typeof TARIFF_IDS)[number];

export interface Zone {
  name: string;
  /** Zone applies while the distance from the school is <= maxKm. Keep zones sorted ascending. */
  maxKm: number;
  priceCents: number;
}

export interface Tariff {
  label: string;
  description: string;
  /** Shown to the customer. */
  eta: string;
  zones: Zone[];
}

export const TARIFFS: Record<TariffId, Tariff> = {
  economy: {
    label: "Economy",
    description: "Delivered the same day, by 18:00",
    eta: "Same day",
    zones: [
      { name: "Inner ring (0-3 km)", maxKm: 3, priceCents: 490 },
      { name: "Middle ring (3-8 km)", maxKm: 8, priceCents: 690 },
      { name: "Outer ring (8-15 km)", maxKm: 15, priceCents: 990 },
    ],
  },
  standard: {
    label: "Standard",
    description: "Delivered within 3 hours",
    eta: "Within 3 hours",
    zones: [
      { name: "Inner ring (0-3 km)", maxKm: 3, priceCents: 790 },
      { name: "Middle ring (3-8 km)", maxKm: 8, priceCents: 1090 },
      { name: "Outer ring (8-15 km)", maxKm: 15, priceCents: 1490 },
    ],
  },
  express: {
    label: "Express",
    description: "Courier leaves right away, delivered within 60 minutes",
    eta: "Within 60 minutes",
    // Express only runs closer to the school: anything beyond 8 km is out of area for this tariff.
    zones: [
      { name: "Inner ring (0-3 km)", maxKm: 3, priceCents: 1290 },
      { name: "Middle ring (3-8 km)", maxKm: 8, priceCents: 1690 },
    ],
  },
};
