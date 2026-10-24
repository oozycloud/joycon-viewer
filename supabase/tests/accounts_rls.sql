-- Run as a trusted SQL operator against a test project. All data changes roll back.
-- First set two DIFFERENT existing Auth/profile UUIDs, without putting credentials here:
-- select set_config('viewer.test_user_a', '<UUID A>', false);
-- select set_config('viewer.test_user_b', '<UUID B>', false);
begin;
do $$ begin
 if current_setting('viewer.test_user_a', true) is null or current_setting('viewer.test_user_b', true) is null then raise exception 'Set both viewer.test_user_a and viewer.test_user_b first.'; end if;
 if current_setting('viewer.test_user_a') = current_setting('viewer.test_user_b') then raise exception 'Use two different accounts.'; end if;
 if (select count(*) from public.profiles where user_id in (current_setting('viewer.test_user_a')::uuid,current_setting('viewer.test_user_b')::uuid)) <> 2 then raise exception 'Both accounts must have profiles.'; end if;
end $$;
select set_config('viewer.test_preset', gen_random_uuid()::text, true);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('viewer.test_user_a'), true);
select set_config('request.jwt.claims', json_build_object('sub',current_setting('viewer.test_user_a'),'role','authenticated')::text, true);
insert into public.controller_state(owner_id,config) values(current_setting('viewer.test_user_a')::uuid,'{"rls_test":true}') on conflict(owner_id) do nothing;
insert into public.presets(owner_id,name,config) values(current_setting('viewer.test_user_a')::uuid,'RLS fixture '||current_setting('viewer.test_preset'),'{"rls_test":true}');
do $$ begin
 if (select count(*) from public.controller_state where owner_id=current_setting('viewer.test_user_a')::uuid) <> 1 then raise exception 'Owner cannot read state'; end if;
 begin update public.profiles set is_creator=true where user_id=current_setting('viewer.test_user_a')::uuid; raise exception 'Creator escalation unexpectedly succeeded'; exception when insufficient_privilege then null; end;
 begin insert into public.controller_state(owner_id,config) values(current_setting('viewer.test_user_b')::uuid,'{}'); raise exception 'Foreign state insert unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('viewer.test_user_b'), true);
select set_config('request.jwt.claims', json_build_object('sub',current_setting('viewer.test_user_b'),'role','authenticated')::text, true);
do $$ declare changed bigint; begin
 if exists(select 1 from public.controller_state where owner_id=current_setting('viewer.test_user_a')::uuid) then raise exception 'Foreign state leaked'; end if;
 if exists(select 1 from public.presets where owner_id=current_setting('viewer.test_user_a')::uuid) then raise exception 'Foreign preset leaked'; end if;
 update public.presets set name='unauthorized' where owner_id=current_setting('viewer.test_user_a')::uuid;
 get diagnostics changed = row_count; if changed <> 0 then raise exception 'Foreign preset update succeeded'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.profiles; raise exception 'Anonymous profile read unexpectedly succeeded'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.controller_state; raise exception 'Anonymous state read unexpectedly succeeded'; exception when insufficient_privilege then null; end;
 if exists(select 1 from public.list_public_users(100) d where to_jsonb(d) ? 'email' or to_jsonb(d) ? 'user_id' or to_jsonb(d) ? 'owner_id') then raise exception 'Public directory exposed private identity'; end if;
end $$;
rollback;
