-- Immutable capability links. Exact-token RPC is the only anonymous read path.
create table private.design_shares (
 token text primary key default encode(extensions.gen_random_bytes(32),'hex'),
 owner_id uuid not null references auth.users(id) on delete cascade,
 content_hash text not null,
 config jsonb not null,
 byte_size integer not null,
 created_at timestamptz not null default now(),
 unique(owner_id,content_hash)
);
alter table private.design_shares enable row level security;
revoke all on private.design_shares from public,anon,authenticated;
create or replace function public.create_design_share(snapshot_config jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); clean jsonb; digest text; result text; bytes integer;
begin
 if actor is null then raise exception 'Sign in to create a design link'; end if;
 if snapshot_config is null or jsonb_typeof(snapshot_config)<>'object' then raise exception 'Invalid design'; end if;
 -- Allowlist presentation and explicit relay configuration; never store auth/session fields.
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into clean from jsonb_each(snapshot_config)
 where key=any(array['layout','leftColor','rightColor','deadzone','motionDeadzone','motionHorizontalDeadzone','lockMotionDirection','joyconAttachments','invertMotionHorizontal','invertMotionVertical','scale','partAssets','designs','edition','proBodyColor','proLeftColor','proRightColor','decal','decalColor','decalOpacity','decalImage','css','relayUrl','room','relayRole','map']);
 if clean->>'layout' is null or clean->>'layout' not in ('pair','pair2','pro','generic') then raise exception 'Invalid layout'; end if;
 -- Each snapshot carries just the selected layout, even if a client sends other artwork.
 clean:=jsonb_set(jsonb_set(clean,'{designs}',case when clean->'designs' ? (clean->>'layout') then jsonb_build_object(clean->>'layout',clean->'designs'->(clean->>'layout')) else '{}'::jsonb end),'{partAssets}',case when clean->'partAssets' ? (clean->>'layout') then jsonb_build_object(clean->>'layout',clean->'partAssets'->(clean->>'layout')) else '{}'::jsonb end);
 bytes:=octet_length(clean::text);
 if bytes>16777216 then raise exception 'Design exceeds 16 MB link limit'; end if;
 digest:=encode(extensions.digest(clean::text,'sha256'),'hex');
 perform 1 from auth.users where id=actor for update;
 select token into result from private.design_shares where owner_id=actor and content_hash=digest;
 if result is not null then return result; end if;
 if (select count(*) from private.design_shares where owner_id=actor)>=256 or (select coalesce(sum(byte_size),0) from private.design_shares where owner_id=actor)+bytes>209715200 then raise exception 'Design link quota reached (256 links / 200 MB)'; end if;
 insert into private.design_shares(owner_id,content_hash,config,byte_size) values(actor,digest,clean,bytes) returning token into result;
 return result;
end $$;
revoke all on function public.create_design_share(jsonb) from public,anon;
grant execute on function public.create_design_share(jsonb) to authenticated;
create or replace function public.get_design_share(share_token text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if share_token is null or share_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid design link'; end if;
 return (select config from private.design_shares where token=share_token);
end $$;
revoke all on function public.get_design_share(text) from public;
grant execute on function public.get_design_share(text) to anon,authenticated;

