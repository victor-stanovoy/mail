const euro = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });
export const eur = (cents: number) => euro.format(cents / 100);

const dateTime = new Intl.DateTimeFormat("de-AT", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Vienna",
});
export const dt = (iso: string) => dateTime.format(new Date(iso));
