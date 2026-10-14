import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// For pages that need a consented user with a usable profile.
export async function requireProfile() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle<Profile>();
  if (!profile?.consented_at) redirect("/welcome");
  if (!profile.schools.length && !profile.employers.length && !profile.city) redirect("/profile");
  return { supabase, user, profile };
}

export function isAdmin(email: string | undefined) {
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
  return !!email && admins.includes(email.toLowerCase());
}
