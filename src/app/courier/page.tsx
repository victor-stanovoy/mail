"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { PARCEL_SIZES, TARIFFS } from "@/config/service";
import { api } from "@/lib/api";
import { dt, eur } from "@/lib/format";
import { getSupabase } from "@/lib/supabase-browser";
import type { Delivery } from "@/lib/types";

type Tab = "open" | "mine" | "all";
const NEXT_LABEL: Record<string, string> = {
  assigned: "Mark picked up",
  picked_up: "Mark on the way",
  in_transit: "Mark delivered",
};

export default function CourierDashboard() {
  const { loading, session, me } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [tab, setTab] = useState<Tab>("open");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login?next=/courier");
  }, [loading, session, router]);

  const isCourier = me?.role === "courier";
  const load = useCallback(async () => {
    if (!isCourier) return;
    const { data, error } = await getSupabase()
      .from("mail_deliveries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) setError(error.message);
    else setRows((data ?? []) as Delivery[]);
  }, [isCourier]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: "claim" | "advance" | "cancel") {
    if (action === "cancel" && !confirm("Cancel this delivery?")) return;
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/deliveries/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
      load();
    }
  }

  if (loading || !session) return <p className="muted">Loading…</p>;
  if (!isCourier) {
    return (
      <div className="card narrow">
        <h1>Courier dashboard</h1>
        <p>Your account is a sender account. A courier role is granted by the operator in the database (see the README).</p>
      </div>
    );
  }

  const open = rows.filter((r) => r.status === "pending");
  const mine = rows.filter((r) => r.courier_id === me.id && !["delivered", "cancelled"].includes(r.status));
  const today = new Date().toDateString();
  const deliveredToday = rows.filter((r) => r.status === "delivered" && r.delivered_at && new Date(r.delivered_at).toDateString() === today);
  const shown = tab === "open" ? open : tab === "mine" ? mine : rows;

  return (
    <>
      <h1>Courier dashboard</h1>
      <div className="stats">
        <div className="card stat"><b>{open.length}</b><span>waiting for a courier</span></div>
        <div className="card stat"><b>{mine.length}</b><span>your active runs</span></div>
        <div className="card stat"><b>{deliveredToday.length}</b><span>delivered today ({eur(deliveredToday.reduce((s, r) => s + r.total_cents, 0))})</span></div>
      </div>

      <div className="tabs">
        {(["open", "mine", "all"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "open" ? `Open (${open.length})` : t === "mine" ? `Mine (${mine.length})` : "All"}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}

      {shown.length === 0 ? (
        <p className="muted">Nothing here right now.</p>
      ) : (
        <div className="card scroll">
          <table>
            <thead>
              <tr><th>Code</th><th>Pickup → Drop-off</th><th>Parcel</th><th>Status</th><th className="num">Price</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><code>{r.tracking_code}</code><br /><small className="muted">{dt(r.created_at)}</small></td>
                  <td>
                    {r.pickup_address}<br />
                    <span className="muted">→ {r.dropoff_address}</span><br />
                    <small>{r.recipient_name}{r.recipient_phone ? ` · ${r.recipient_phone}` : ""}</small>
                    {r.notes && <><br /><small className="muted">“{r.notes}”</small></>}
                  </td>
                  <td>{PARCEL_SIZES[r.parcel_size].label}<br /><small className="muted">{TARIFFS[r.tariff].label} · {r.distance_km.toFixed(1)} km</small></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="num">{eur(r.total_cents)}</td>
                  <td className="actions">
                    {r.status === "pending" && (
                      <button className="btn small" disabled={busyId === r.id} onClick={() => act(r.id, "claim")}>Take it</button>
                    )}
                    {r.courier_id === me.id && NEXT_LABEL[r.status] && (
                      <button className="btn small primary" disabled={busyId === r.id} onClick={() => act(r.id, "advance")}>
                        {NEXT_LABEL[r.status]}
                      </button>
                    )}
                    {!["delivered", "cancelled"].includes(r.status) && (
                      <button className="link" disabled={busyId === r.id} onClick={() => act(r.id, "cancel")}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
