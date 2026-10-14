import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

type Props = Record<string, string | number | boolean | null>;

// Records a usage event in Supabase and, if configured, PostHog.
// Props must be enums and counts only: never resume text, drafts or names.
export async function track(userId: string | null, type: string, props: Props = {}) {
  const admin = createAdminClient();
  const writes: Promise<unknown>[] = [
    Promise.resolve(admin.from("events").insert({ user_id: userId, type, props })),
  ];
  const key = process.env.POSTHOG_KEY;
  if (key) {
    writes.push(
      fetch(`${process.env.POSTHOG_HOST ?? "https://us.i.posthog.com"}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, event: type, distinct_id: userId ?? "anonymous", properties: props }),
      }),
    );
  }
  await Promise.allSettled(writes);
}
