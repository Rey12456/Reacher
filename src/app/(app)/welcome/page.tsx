import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { track } from "@/lib/track";

async function consent() {
  "use server";
  const { supabase, user } = await requireUser();
  await supabase.from("profiles").upsert({ user_id: user.id, consented_at: new Date().toISOString() });
  await track(user.id, "consented");
  redirect("/profile");
}

const POINTS: [string, string][] = [
  ["Your resume", "The file is read once and never stored. We keep its text and the profile pulled from it (schools, employers, city, a short summary), which you can edit."],
  ["Searches", "Your company, role, schools, past employers and city are sent to Serper (Google search). Your profile and the people found are sent to Groq to write drafts."],
  ["Usage counts", "We log actions like “search run” or “status changed” to see whether Reacher is useful. These never include your resume or messages."],
  ["Sending", "Nothing is sent for you. You open LinkedIn and send every message yourself."],
  ["Deleting", "You can delete your account and all your data anytime from the Profile page."],
];

export default async function WelcomePage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("consented_at").eq("user_id", user.id).maybeSingle();
  if (data?.consented_at) redirect("/");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Before you start</h1>
        <p className="mt-1 text-[15px] text-stone-600">Reacher is a small pilot run for friends. Here&apos;s exactly what happens with your data.</p>
      </div>
      <ul className="panel divide-y divide-stone-200 text-[15px]">
        {POINTS.map(([term, text]) => (
          <li key={term} className="grid gap-1 px-6 py-5 sm:grid-cols-[150px_1fr] sm:gap-6">
            <span className="lbl sm:pt-1">{term}</span>
            <span className="leading-relaxed text-stone-700">{text}</span>
          </li>
        ))}
      </ul>
      <form action={consent}>
        <button className="btn">I understand, continue</button>
      </form>
    </div>
  );
}
