import "server-only";
import type { User } from "@supabase/supabase-js";
import { admin } from "./supabase-admin";
import { HttpError } from "./http";

export type Role = "sender" | "courier";

export interface Caller {
  user: User;
  role: Role;
  fullName: string | null;
}

/**
 * Makes sure the signed-in user has a mail_profiles row (role "sender" by default).
 * Done here instead of a trigger on auth.users so other apps sharing this Supabase project are unaffected.
 * Roles are never taken from user-editable metadata.
 */
async function ensureProfile(user: User): Promise<{ role: Role; fullName: string | null }> {
  const db = admin();
  const existing = await db.from("mail_profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { role: existing.data.role as Role, fullName: existing.data.full_name };

  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.slice(0, 120) : null;
  const created = await db
    .from("mail_profiles")
    .upsert({ id: user.id, full_name: fullName }, { onConflict: "id", ignoreDuplicates: true });
  if (created.error) throw created.error;
  return { role: "sender", fullName };
}

export async function requireUser(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Please sign in.");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session has expired. Please sign in again.");
  const profile = await ensureProfile(data.user);
  return { user: data.user, ...profile };
}

export async function optionalUser(req: Request): Promise<Caller | null> {
  if (!req.headers.get("authorization")) return null;
  try {
    return await requireUser(req);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) return null;
    throw e;
  }
}
