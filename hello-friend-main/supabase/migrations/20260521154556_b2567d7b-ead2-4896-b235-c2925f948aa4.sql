-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_language text default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_idx on public.conversations(user_id, updated_at desc);
alter table public.conversations enable row level security;
create policy "conv_all_own" on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  pinned boolean not null default false,
  rating smallint,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages(conversation_id, created_at);
alter table public.messages enable row level security;
create policy "msg_all_own" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','done','archived')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date timestamptz,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_idx on public.tasks(user_id, created_at desc);
alter table public.tasks enable row level security;
create policy "tasks_all_own" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'note',
  content text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index memories_user_idx on public.memories(user_id, created_at desc);
alter table public.memories enable row level security;
create policy "memories_all_own" on public.memories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark',
  language text not null default 'en',
  font_size text not null default 'md',
  voice_input_lang text not null default 'auto',
  voice_name text not null default 'default',
  voice_speed numeric not null default 1.0,
  response_length text not null default 'balanced',
  creativity numeric not null default 0.7,
  memory_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "settings_all_own" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from anon, authenticated, public;