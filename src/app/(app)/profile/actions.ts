"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { track } from "@/lib/track";
import type { Employer, School } from "@/lib/types";

export type ProfileInput = {
  name: string;
  city: string;
  summary: string;
  schools: School[];
  employers: Employer[];
};

const clean = (s: unknown, max = 200) => String(s ?? "").trim().slice(0, max);

export async function saveProfile(input: ProfileInput) {
  const { supabase, user } = await requireUser();
  const schools = (input.schools ?? [])
    .map((s) => ({ name: clean(s.name), degree: clean(s.degree), years: clean(s.years, 40) }))
    .filter((s) => s.name)
    .slice(0, 6);
  const employers = (input.employers ?? [])
    .map((e) => ({ name: clean(e.name), title: clean(e.title), years: clean(e.years, 40) }))
    .filter((e) => e.name)
    .slice(0, 10);
  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    name: clean(input.name) || null,
    city: clean(input.city) || null,
    summary: clean(input.summary, 1000) || null,
    schools,
    employers,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Couldn't save. Try again." };
  await track(user.id, "profile_saved", { schools: schools.length, employers: employers.length, has_city: !!input.city });
  return { ok: true };
}

export async function deleteAccount() {
  const { supabase, user } = await requireUser();
  await track(user.id, "account_deleted");
  // Deleting the auth user cascades to profiles, searches, contacts and results; events keep only anonymous counts.
  await createAdminClient().auth.admin.deleteUser(user.id);
  await supabase.auth.signOut();
  redirect("/login");
}
