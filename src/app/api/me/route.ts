import { requireUser } from "@/lib/auth";
import { route } from "@/lib/http";

export const runtime = "nodejs";

export const GET = route(async (req) => {
  const { user, role, fullName } = await requireUser(req);
  return { id: user.id, email: user.email ?? null, role, fullName };
});
