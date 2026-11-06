# ViennaMail

Courier parcel delivery around Vienna, priced by distance from the **Vienna International School**.
Next.js (App Router, TypeScript) + Supabase (Postgres, Auth, Row Level Security).

- **Public:** price calculator, tariff and size overview
- **Sender dashboard** (`/sender`): book deliveries, see status/history, cancel
- **Courier dashboard** (`/courier`): take open deliveries, mark picked up / on the way / delivered
- **Promo codes** (e.g. `SPARKNEWS`), **tariffs**, **parcel sizes** and the **radius**, all set in code

## Setup

```bash
npm install
cp .env.example .env.local     # then add SUPABASE_SERVICE_ROLE_KEY
npm run dev                    # http://localhost:3000
```

The database schema is in `supabase/migrations/0001_mail_service_schema.sql` (already applied to the connected
Supabase project; run it in the SQL editor if you use a different project).
The service-role key is in the Supabase dashboard under *Project Settings → API Keys*. It is server-only: never commit it.

### Make someone a courier

Everyone who signs up is a `sender`. After they have signed in once, promote them in the Supabase SQL editor:

```sql
update public.mail_profiles
set role = 'courier'
where id = (select id from auth.users where email = 'courier@example.com');
```

## Configuration (all in code)

| What | Where |
|---|---|
| Centre point, service radius, parcel sizes, tariffs and zone prices | `src/config/service.ts` |
| Promo codes (percent / fixed, expiry, max uses, once per sender, min. value, tariff/size limits) | `src/config/promos.ts` |

Amounts are euro **cents**, VAT included. The price of a delivery is:

```
zone price of the chosen tariff  +  parcel size surcharge  −  promo discount
```

The zone is decided by whichever address (pickup or drop-off) is **farther from the school**, measured in a straight line.
If it is beyond `SERVICE_RADIUS_KM`, or beyond the last zone of the tariff (Express stops at 8 km), the booking is refused.

## How it works

- Browser reads deliveries straight from Supabase; **Row Level Security** limits senders to their own rows, couriers see all.
- All **writes** (booking, claiming, status changes) go through `/api/*` routes using the service-role key. The server
  re-geocodes the addresses, re-prices everything and validates the promo code; the browser never sends a price.
- Addresses are geocoded with OpenStreetMap Nominatim (free, ~1 request/s). For real traffic, swap `src/lib/geocode.ts`
  for a paid geocoder; the rest of the app only needs `{lat, lng}`.
- This app's tables are prefixed `mail_` and no trigger is added to `auth.users`, so other apps in the same Supabase project are unaffected.

## Tests

```bash
npm test          # pricing, zones, radius and promo rules
npm run typecheck
```

## Not included (yet)

Online payment, email/SMS notifications, a public tracking page, route optimisation, invoices.
