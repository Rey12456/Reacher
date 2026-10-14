import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/track";

// Google sends the user back here with a one-time code, exchanged for a session cookie.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await track(data.user.id, "signed_in");
      return NextResponse.redirect(new URL("/", url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=1", url.origin));
}
