-- Reacher schema. Run once in the Supabase SQL editor (or `supabase db push`).

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  consented_at timestamptz,
  name text,
  schools jsonb not null default '[]',   -- [{name, degree, years}]
  employers jsonb not null default '[]', -- [{name, title, years}]
  city text,
  summary text,
  resume_text text,
  updated_at timestamptz not null default now()
);

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  company text not null,
  role text not null,
  ask text not null check (ask in ('chat', 'advice', 'referral')),
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  queries_used int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.searches (user_id, created_at desc);

-- One record per person per user, shared across that user's searches.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  linkedin_url text not null,
  name text not null,
  title text,
  company text,
  location text,
  education text,
  status text not null default 'not_sent'
    check (status in ('not_sent', 'sent', 'accepted', 'replied', 'no_response')),
  status_updated_at timestamptz,
  sent_at timestamptz,
  final_note text,
  final_message text,
  draft_source text check (draft_source in ('ai_unchanged', 'ai_edited', 'user_written')),
  draft_model text,
  created_at timestamptz not null default now(),
  unique (user_id, linkedin_url)
);

create table public.search_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches on delete cascade,
  contact_id uuid not null references public.contacts on delete cascade,
  rank int not null,
  score numeric not null,
  label text not null check (label in ('peer', 'manager', 'recruiter')),
  reason text not null,
  verified jsonb not null default '[]',  -- [{type, value}]
  possible jsonb not null default '[]',
  ask_used text not null,
  note_ai text,
  message_ai text,
  note_text text,     -- current (possibly user-edited) versions
  message_text text,
  model text,
  created_at timestamptz not null default now()
);
create index on public.search_results (search_id, rank);
create index on public.search_results (contact_id);

-- Shared across users: raw Serper results per query, reused for 30 days. Server-only.
create table public.serper_cache (
  query text primary key,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Usage metrics. Event names and counts only, never resume text or drafts. Server-only.
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete set null,
  type text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.events (type, created_at);

-- Row level security: users only see their own rows. serper_cache and events have no
-- policies, so only the server's secret key can touch them.
alter table public.profiles enable row level security;
alter table public.searches enable row level security;
alter table public.contacts enable row level security;
alter table public.search_results enable row level security;
alter table public.serper_cache enable row level security;
alter table public.events enable row level security;

create policy "own profile" on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own searches" on public.searches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own contacts" on public.contacts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own search results" on public.search_results
  for all using (exists (select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.searches s where s.id = search_id and s.user_id = auth.uid()));
