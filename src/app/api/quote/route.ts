import { optionalUser } from "@/lib/auth";
import { rateLimit, route } from "@/lib/http";
import { QuoteInput, buildQuote } from "@/lib/quote-service";

export const runtime = "nodejs";

/** Public price check. Signed-in callers also get per-account promo rules applied. */
export const POST = route(async (req) => {
  rateLimit(req, "quote", 20);
  const input = QuoteInput.parse(await req.json().catch(() => ({})));
  const caller = await optionalUser(req);
  const { quote } = await buildQuote(input, caller?.user.id ?? null);
  return { quote };
});
