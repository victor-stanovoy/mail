"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PARCEL_SIZES, SIZE_IDS, TARIFFS, TARIFF_IDS, SCHOOL, SERVICE_RADIUS_KM, type SizeId, type TariffId } from "@/config/service";
import { api } from "@/lib/api";
import { eur } from "@/lib/format";
import type { Quote } from "@/lib/pricing";
import type { Delivery } from "@/lib/types";

interface Props {
  /** "quote": price calculator only. "book": also collects recipient details and creates the delivery. */
  mode: "quote" | "book";
  onBooked?: (d: Delivery) => void;
}

export function BookingForm({ mode, onBooked }: Props) {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [size, setSize] = useState<SizeId>("small");
  const [tariff, setTariff] = useState<TariffId>("standard");
  const [promo, setPromo] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Any change invalidates the shown price.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setQuote(null);
    setError(null);
  };

  const payload = () => ({ pickupAddress: pickup, dropoffAddress: dropoff, size, tariff, promoCode: promo || undefined });

  async function getPrice(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ quote: Quote }>("/api/quote", { method: "POST", body: JSON.stringify(payload()) });
      setQuote(res.quote);
    } catch (err) {
      setQuote(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function book() {
    if (recipientName.trim().length < 2) {
      setError("Please enter the recipient's name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ delivery: Delivery }>("/api/deliveries", {
        method: "POST",
        body: JSON.stringify({ ...payload(), recipientName, recipientPhone: recipientPhone || undefined, notes: notes || undefined }),
      });
      setQuote(null);
      setRecipientName("");
      setRecipientPhone("");
      setNotes("");
      setPromo("");
      onBooked?.(res.delivery);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={getPrice}>
      <div className="grid-2">
        <label>
          Pickup address
          <input value={pickup} onChange={(e) => edit(setPickup)(e.target.value)} placeholder="e.g. Hauptstraße 1, 1010 Wien" required />
        </label>
        <label>
          Drop-off address
          <input value={dropoff} onChange={(e) => edit(setDropoff)(e.target.value)} placeholder="e.g. Mariahilfer Straße 50, 1070 Wien" required />
        </label>
      </div>
      <p className="hint">
        We deliver within {SERVICE_RADIUS_KM} km of the {SCHOOL.name}; the price depends on how far out the farther address is.
      </p>

      <fieldset>
        <legend>Parcel size</legend>
        <div className="choices">
          {SIZE_IDS.map((id) => (
            <label key={id} className={`choice ${size === id ? "on" : ""}`}>
              <input type="radio" name="size" checked={size === id} onChange={() => edit(setSize)(id)} />
              <strong>{PARCEL_SIZES[id].label}</strong>
              <span>{PARCEL_SIZES[id].description}</span>
              <small>up to {PARCEL_SIZES[id].maxWeightKg} kg · {PARCEL_SIZES[id].maxDimensionsCm} cm</small>
              <small>{PARCEL_SIZES[id].surchargeCents ? `+ ${eur(PARCEL_SIZES[id].surchargeCents)}` : "no surcharge"}</small>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Tariff</legend>
        <div className="choices">
          {TARIFF_IDS.map((id) => (
            <label key={id} className={`choice ${tariff === id ? "on" : ""}`}>
              <input type="radio" name="tariff" checked={tariff === id} onChange={() => edit(setTariff)(id)} />
              <strong>{TARIFFS[id].label}</strong>
              <span>{TARIFFS[id].description}</span>
              <small>from {eur(TARIFFS[id].zones[0].priceCents)}</small>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "book" && (
        <div className="grid-2">
          <label>
            Recipient name
            <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} maxLength={120} />
          </label>
          <label>
            Recipient phone <span className="muted">(optional)</span>
            <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} inputMode="tel" maxLength={40} />
          </label>
          <label className="span-2">
            Notes for the courier <span className="muted">(optional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Doorbell, floor, opening hours…" />
          </label>
        </div>
      )}

      <div className="row">
        <label className="promo">
          Promo code
          <input value={promo} onChange={(e) => edit(setPromo)(e.target.value)} placeholder="SPARKNEWS" maxLength={40} autoCapitalize="characters" />
        </label>
        <button className="btn" disabled={busy}>{busy && !quote ? "Calculating…" : "Get price"}</button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {quote && (
        <div className="quote" aria-live="polite">
          <dl>
            <dt>{TARIFFS[quote.tariff].label} · {quote.zone}</dt>
            <dd>{eur(quote.baseCents)}</dd>
            <dt>{PARCEL_SIZES[quote.size].label} parcel</dt>
            <dd>{quote.sizeCents ? eur(quote.sizeCents) : "included"}</dd>
            {quote.promo && (
              <>
                <dt>Promo {quote.promo.code}<small>{quote.promo.description}</small></dt>
                <dd className="good">− {eur(quote.discountCents)}</dd>
              </>
            )}
            <dt className="total">Total (incl. VAT)</dt>
            <dd className="total">{eur(quote.totalCents)}</dd>
          </dl>
          {quote.promoError && <p className="error">{quote.promoError}</p>}
          <p className="hint">{quote.eta} · {quote.distanceKm.toFixed(1)} km from the school</p>
          {mode === "book" ? (
            <button type="button" className="btn primary" onClick={book} disabled={busy}>
              {busy ? "Booking…" : `Book delivery · ${eur(quote.totalCents)}`}
            </button>
          ) : (
            <Link href="/sender" className="btn primary">Sign in to book this delivery</Link>
          )}
        </div>
      )}
    </form>
  );
}
