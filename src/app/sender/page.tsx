"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BookingForm } from "@/components/BookingForm";
import { StatusBadge } from "@/components/StatusBadge";
import { PARCEL_SIZES, TARIFFS } from "@/config/service";
import { api } from "@/lib/api";
import { dt, eur } from "@/lib/format";
import { getSupabase } from "@/lib/supabase-browser";
import type { Delivery } from "@/lib/types";

export default function SenderDashboard() {
  const { loading, session, me } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login?next=/sender");
  }, [loading, session, router]);

  const userId = session?.user.id;
  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await getSupabase()
      .from("mail_deliveries")
      .select("*")
      .eq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) setError(error.message);
    else setRows((data ?? []) as Delivery[]);
  }, [userId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  async function cancel(id: string) {
    if (!confirm("Cancel this delivery?")) return;
    try {
      await api(`/api/deliveries/${id}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) });
      setFlash("Delivery cancelled.");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading || !session) return <p className="muted">Loading…</p>;

  const active = rows.filter((r) => !["delivered", "cancelled"].includes(r.status)).length;
  const delivered = rows.filter((r) => r.status === "delivered").length;
  const spent = rows.filter((r) => r.status !== "cancelled").reduce((s, r) => s + r.total_cents, 0);

  return (
    <>
      <h1>Hello{me?.fullName ? `, ${me.fullName}` : ""}</h1>
      <div className="stats">
        <div className="card stat"><b>{active}</b><span>in progress</span></div>
        <div className="card stat"><b>{delivered}</b><span>delivered</span></div>
        <div className="card stat"><b>{eur(spent)}</b><span>total spend</span></div>
      </div>

      <section>
        <h2>New delivery</h2>
        <BookingForm
          mode="book"
          onBooked={(d) => {
            setFlash(`Booked! Tracking code ${d.tracking_code}.`);
            load();
          }}
        />
        {flash && <p className="good">{flash}</p>}
      </section>

      <section>
        <h2>Your deliveries</h2>
        {error && <p className="error">{error}</p>}
        {rows.length === 0 ? (
          <p className="muted">No deliveries yet.</p>
        ) : (
          <div className="card scroll">
            <table>
              <thead>
                <tr><th>Code</th><th>Route</th><th>Parcel</th><th>Status</th><th className="num">Price</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><code>{r.tracking_code}</code><br /><small className="muted">{dt(r.created_at)}</small></td>
                    <td>
                      {r.pickup_address}<br />
                      <span className="muted">→ {r.dropoff_address}</span><br />
                      <small className="muted">for {r.recipient_name}</small>
                    </td>
                    <td>{PARCEL_SIZES[r.parcel_size].label}<br /><small className="muted">{TARIFFS[r.tariff].label}</small></td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="num">
                      {eur(r.total_cents)}
                      {r.promo_code && <><br /><small className="good">{r.promo_code} −{eur(r.discount_cents)}</small></>}
                    </td>
                    <td>
                      {["pending", "assigned"].includes(r.status) && (
                        <button className="link" onClick={() => cancel(r.id)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
