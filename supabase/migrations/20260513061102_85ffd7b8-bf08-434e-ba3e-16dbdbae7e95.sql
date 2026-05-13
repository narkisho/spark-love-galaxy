
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can view own roles" on public.user_roles for select using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- handle new user
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email), new.raw_user_meta_data->>'avatar_url')
  on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create trigger profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

-- AI Conversations
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);
alter table public.ai_conversations enable row level security;
create policy "Users select own conversations" on public.ai_conversations for select using (auth.uid() = user_id);
create policy "Users insert own conversations" on public.ai_conversations for insert with check (auth.uid() = user_id);
create policy "Users delete own conversations" on public.ai_conversations for delete using (auth.uid() = user_id);

-- Closer kit preferences
create table public.closer_kit_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  relationship_level text not null,
  activity_duration int not null,
  location text not null,
  level_of_romance text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.closer_kit_preferences enable row level security;
create policy "Own prefs select" on public.closer_kit_preferences for select using (auth.uid() = user_id);
create policy "Own prefs insert" on public.closer_kit_preferences for insert with check (auth.uid() = user_id);
create policy "Own prefs update" on public.closer_kit_preferences for update using (auth.uid() = user_id);
create policy "Own prefs delete" on public.closer_kit_preferences for delete using (auth.uid() = user_id);

-- Closer kit activities
create table public.closer_kit_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null,
  stage text not null,
  duration int,
  difficulty_level int not null default 1,
  location text,
  partner_roles jsonb,
  is_favorite boolean not null default false,
  completed boolean default false,
  created_at timestamptz not null default now()
);
alter table public.closer_kit_activities enable row level security;
create policy "Own act select" on public.closer_kit_activities for select using (auth.uid() = user_id);
create policy "Own act insert" on public.closer_kit_activities for insert with check (auth.uid() = user_id);
create policy "Own act update" on public.closer_kit_activities for update using (auth.uid() = user_id);
create policy "Own act delete" on public.closer_kit_activities for delete using (auth.uid() = user_id);

-- Community topics
create table public.community_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active',
  is_admin_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.community_topics enable row level security;
create policy "Topics public select" on public.community_topics for select using (true);
create policy "Topics auth insert" on public.community_topics for insert with check (auth.uid() = user_id);
create policy "Topics own update" on public.community_topics for update using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Topics own delete" on public.community_topics for delete using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create trigger topics_updated before update on public.community_topics for each row execute function public.set_updated_at();

-- Valia results
create table public.valia_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  core_values jsonb not null default '[]'::jsonb,
  must_haves jsonb not null default '[]'::jsonb,
  nice_to_haves jsonb not null default '[]'::jsonb,
  deal_breakers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.valia_results enable row level security;
create policy "Own valia select" on public.valia_results for select using (auth.uid() = user_id);
create policy "Own valia insert" on public.valia_results for insert with check (auth.uid() = user_id);

-- Vision boards
create table public.vision_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.vision_boards enable row level security;
create policy "Vision own or shared select" on public.vision_boards for select using (auth.uid() = user_id or is_shared = true);
create policy "Vision own insert" on public.vision_boards for insert with check (auth.uid() = user_id);
create policy "Vision own update" on public.vision_boards for update using (auth.uid() = user_id);
create policy "Vision own delete" on public.vision_boards for delete using (auth.uid() = user_id);

-- Progress
create table public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  activity_name text not null,
  details jsonb,
  completed_at timestamptz not null default now()
);
alter table public.progress enable row level security;
create policy "Own progress select" on public.progress for select using (auth.uid() = user_id);
create policy "Own progress insert" on public.progress for insert with check (auth.uid() = user_id);
