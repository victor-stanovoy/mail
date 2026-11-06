import type { SizeId, TariffId } from "@/config/service";

export type Status = "pending" | "assigned" | "picked_up" | "in_transit" | "delivered" | "cancelled";

export const STATUS_LABEL: Record<Status, string> = {
  pending: "Waiting for courier",
  assigned: "Courier assigned",
  picked_up: "Picked up",
  in_transit: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export interface Delivery {
  id: string;
  tracking_code: string;
  sender_id: string;
  courier_id: string | null;
  status: Status;
  tariff: TariffId;
  parcel_size: SizeId;
  pickup_address: string;
  dropoff_address: string;
  recipient_name: string;
  recipient_phone: string | null;
  notes: string | null;
  distance_km: number;
  zone: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  promo_code: string | null;
  created_at: string;
  delivered_at: string | null;
}
