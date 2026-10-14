# Reacher

Enter a company and role, and get up to 10 people most worth contacting there. Each comes with the reason, a link to their LinkedIn profile, a connection note and a follow-up message. You send everything yourself and mark what happened.

**How it works:** Google search via Serper (`site:linkedin.com/in "Company" "Role" "<your school>"`). It runs one query for each thing you might share with someone (school, past employer, city), then a plain role query.
- A shared fact is **verified** only when it sits in the snippet's structured field (e.g. `Education: …`).
- Free-text mentions are **possible**. They rank lower and stay out of drafts until you confirm them.
- Code does the scoring. The LLM (Groq) only labels titles and writes drafts from verified facts.

## Setup

1. **Supabase:** create a free project. Then open the SQL editor and run `supabase/migrations/0001_init.sql`.
2. **Google sign-in:**
   - In Google Cloud Console, go to APIs & Services → Credentials. Create an OAuth client of type *Web application*.
   - Set its authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`.
   - On the OAuth consent screen, set the publishing status to **In production**. Otherwise only manually added test users can sign in. The basic scopes (email, profile) don't need Google verification.
   - In Supabase, go to Authentication → Providers → Google and paste the client ID and secret.
   - In Supabase, go to Authentication → URL Configuration. Set the Site URL to your app's URL, and add `http://localhost:3000/auth/callback` and `https://<your-vercel-domain>/auth/callback` to the redirect URLs.
3. **Env:** copy `.env.example` to `.env.local` and fill it in.
4. **Run:** `npm install && npm run dev`, then open http://localhost:3000.
5. **Deploy:** import the repo into Vercel and add the same env vars.

## Scripts

- `npx tsx --conditions=react-server --env-file=.env.local scripts/smoke.mts "Stripe" "Software Engineer"` runs the real pipeline code against live Groq and Serper. It doesn't use the database and costs about 4–8 queries.

## Metrics

Open `/admin` (restricted to `ADMIN_EMAILS`) to see the go/no-go numbers set before launch:
- searchers return in a later week (≥ 50%)
- searches lead to at least one contact marked sent (≥ 50%)
- acceptance rate (≥ 30%)
- reply rate (≥ 10%)

It also breaks outcomes down by draft source (AI unchanged / edited / user-written) and by connection strength.
