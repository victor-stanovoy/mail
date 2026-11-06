import { BookingForm } from "@/components/BookingForm";
import { PARCEL_SIZES, SIZE_IDS, TARIFFS, TARIFF_IDS, SCHOOL, SERVICE_RADIUS_KM } from "@/config/service";
import { eur } from "@/lib/format";

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Parcels across Vienna,<br />same day or within the hour.</h1>
        <p>
          Couriers cover everything within {SERVICE_RADIUS_KM} km of the {SCHOOL.name}. Pick a size and a tariff, see the
          price up front, and track the delivery from your dashboard.
        </p>
      </section>

      <section>
        <h2>Get a price</h2>
        <BookingForm mode="quote" />
      </section>

      <section>
        <h2>Tariffs</h2>
        <div className="cards-3">
          {TARIFF_IDS.map((id) => (
            <div className="card" key={id}>
              <h3>{TARIFFS[id].label}</h3>
              <p className="muted">{TARIFFS[id].description}</p>
              <table>
                <tbody>
                  {TARIFFS[id].zones.map((z) => (
                    <tr key={z.name}>
                      <td>{z.name}</td>
                      <td className="num">{eur(z.priceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Parcel sizes</h2>
        <div className="card">
          <table>
            <thead>
              <tr><th>Size</th><th>Max. weight</th><th>Max. dimensions</th><th className="num">Surcharge</th></tr>
            </thead>
            <tbody>
              {SIZE_IDS.map((id) => (
                <tr key={id}>
                  <td><strong>{PARCEL_SIZES[id].label}</strong> <span className="muted">{PARCEL_SIZES[id].description}</span></td>
                  <td>{PARCEL_SIZES[id].maxWeightKg} kg</td>
                  <td>{PARCEL_SIZES[id].maxDimensionsCm} cm</td>
                  <td className="num">{PARCEL_SIZES[id].surchargeCents ? `+ ${eur(PARCEL_SIZES[id].surchargeCents)}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Prices include VAT. Zones are measured in a straight line from the {SCHOOL.name}.</p>
      </section>
    </>
  );
}
