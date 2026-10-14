import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Profile } from "@/lib/types";
import { ProfileEditor } from "./profile-editor";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle<Profile>();
  if (!profile?.consented_at) redirect("/welcome");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="mt-1 text-[15px] text-stone-600">
          Reacher searches for people who share these with you, and only ever mentions facts from here in drafts. Check
          that names are spelled the way they&apos;d appear on LinkedIn.
        </p>
      </div>
      <ProfileEditor initial={profile} />
    </div>
  );
}
