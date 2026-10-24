-- Private controller accounts. No credentials or creator identity are embedded here.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username = lower(username) and username ~ '^[a-z0-9_]{3,24}$'),
 is_creator boolean not null default false,
 created_at timestamptz not null default now()
);
create unique index profiles_one_creator on public.profiles(is_creator) where is_creator;
create table public.user_directory (
 username text primary key,
 is_creator boolean not null default false,
 created_at timestamptz not null
);
create table public.controller_state (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 config jsonb not null check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 26214400),
 updated_at timestamptz not null default now()
);
create table public.presets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 80),
 config jsonb not null check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 26214400),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index presets_owner_name on public.presets(owner_id, lower(btrim(name)));
create index presets_owner_updated on public.presets(owner_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.user_directory enable row level security;
alter table public.controller_state enable row level security;
alter table public.presets enable row level security;
revoke all on public.profiles, public.user_directory, public.controller_state, public.presets from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.user_directory to anon, authenticated;
grant select, delete on public.controller_state to authenticated;
grant insert(owner_id, config), update(config) on public.controller_state to authenticated;
grant select, delete on public.presets to authenticated;
grant insert(owner_id, name, config), update(name, config) on public.presets to authenticated;
grant all on public.profiles, public.user_directory, public.controller_state, public.presets to service_role;

create policy profiles_read_own on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy directory_public_read on public.user_directory for select to anon, authenticated using (true);
create policy state_read_own on public.controller_state for select to authenticated using ((select auth.uid()) = owner_id);
create policy state_insert_own on public.controller_state for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy state_update_own on public.controller_state for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy state_delete_own on public.controller_state for delete to authenticated using ((select auth.uid()) = owner_id);
create policy presets_read_own on public.presets for select to authenticated using ((select auth.uid()) = owner_id);
create policy presets_insert_own on public.presets for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy presets_update_own on public.presets for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy presets_delete_own on public.presets for delete to authenticated using ((select auth.uid()) = owner_id);

create function private.viewer_timestamps() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); if tg_table_name = 'presets' then new.created_at = old.created_at; end if; return new; end $$;
revoke all on function private.viewer_timestamps() from public, anon, authenticated;
create trigger controller_state_timestamp before update on public.controller_state for each row execute function private.viewer_timestamps();
create trigger presets_timestamp before update on public.presets for each row execute function private.viewer_timestamps();

create function private.create_viewer_profile() returns trigger language plpgsql security definer set search_path = '' as $$
declare handle text;
begin
 handle = lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
 if handle !~ '^[a-z0-9_]{3,24}$' then raise exception 'Username must be 3-24 lowercase letters, numbers, or underscores.'; end if;
 if handle = 'oozy' and coalesce(new.raw_app_meta_data ->> 'viewer_creator_bootstrap', 'false') <> 'true' then raise exception 'This username is reserved.'; end if;
 insert into public.profiles(user_id, username) values(new.id, handle);
 return new;
end $$;
revoke all on function private.create_viewer_profile() from public, anon, authenticated;
create trigger create_viewer_profile after insert on auth.users for each row execute function private.create_viewer_profile();

create function private.sync_viewer_directory() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op = 'DELETE' then delete from public.user_directory where username = old.username; return old; end if;
 if tg_op = 'UPDATE' and old.username <> new.username then delete from public.user_directory where username = old.username; end if;
 if exists(select 1 from auth.users where id = new.user_id and email_confirmed_at is not null) then
 insert into public.user_directory(username, is_creator, created_at) values(new.username, new.is_creator, new.created_at)
 on conflict(username) do update set is_creator = excluded.is_creator, created_at = excluded.created_at;
 end if;
 return new;
end $$;
revoke all on function private.sync_viewer_directory() from public, anon, authenticated;
create trigger sync_viewer_directory after insert or update or delete on public.profiles for each row execute function private.sync_viewer_directory();

create function private.confirm_viewer_directory() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.email_confirmed_at is not null then
 insert into public.user_directory(username, is_creator, created_at) select username, is_creator, created_at from public.profiles where user_id = new.id
 on conflict(username) do update set is_creator = excluded.is_creator, created_at = excluded.created_at;
 else delete from public.user_directory where username = (select username from public.profiles where user_id = new.id); end if;
 return new;
end $$;
revoke all on function private.confirm_viewer_directory() from public, anon, authenticated;
create trigger confirm_viewer_directory after update of email_confirmed_at on auth.users for each row execute function private.confirm_viewer_directory();

create function private.viewer_preset_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from auth.users where id = new.owner_id for update;
 if (select count(*) from public.presets where owner_id = new.owner_id) >= 50 then raise exception 'An account can keep up to 50 named presets.'; end if;
 return new;
end $$;
revoke all on function private.viewer_preset_limit() from public, anon, authenticated;
create trigger viewer_preset_limit before insert on public.presets for each row execute function private.viewer_preset_limit();

-- Only the minimal public projection is exposed; no auth UUID or email is returned.
create function public.list_public_users(limit_count integer default 100)
returns table(username text, is_creator boolean, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
 select d.username, d.is_creator, d.created_at from public.user_directory d
 order by d.is_creator desc, d.username asc limit greatest(1, least(coalesce(limit_count,100),1000));
$$;
revoke all on function public.list_public_users(integer) from public;
grant execute on function public.list_public_users(integer) to anon, authenticated;

-- Trusted SQL only, after a real Auth account exists. Never grant this to clients.
create function private.assign_viewer_creator(target_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.profiles where user_id = target_user) then raise exception 'Create the real Auth account first.'; end if;
 update public.profiles set is_creator = false where is_creator;
 update public.profiles set username = 'oozy', is_creator = true where user_id = target_user;
end $$;
revoke all on function private.assign_viewer_creator(uuid) from public, anon, authenticated, service_role;
commit;
