create table public.policy_share_links (
  token text primary key,
  client_id uuid not null references public.clients(id) on delete cascade,
  policy_ids uuid[] not null,
  created_at timestamptz not null default now()
);
alter table public.policy_share_links enable row level security;
