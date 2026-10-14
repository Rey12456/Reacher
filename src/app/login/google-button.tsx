"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function GoogleButton() {
  const [loading, setLoading] = useState(false);
  return (
    <button
      className="btn w-full py-2.5"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await createClient().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
      }}
    >
      {loading ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}
