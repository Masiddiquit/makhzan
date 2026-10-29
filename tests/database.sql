-- Admin connection only. All fixtures are rolled back; no emails are sent.
begin;
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values
 ('aaaaaaaa-1111-4111-8111-111111111111','business-a@example.test',now(),now(),now()),
 ('bbbbbbbb-1111-4111-8111-111111111111','business-b@example.test',now(),now(),now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-1111-4111-8111-111111111111","email":"business-a@example.test","role":"authenticated","is_anonymous":false}',true);
select * from public.save_warehouse(0,'{"version":1,"products":[],"customers":[],"containers":[],"orders":[],"damages":[],"expenses":[],"audit":[]}'::jsonb);
do $$ begin
 if (select count(*) from public.warehouse) <> 1 then raise exception 'account_a_read_failed'; end if;
 begin
  perform public.save_warehouse(0,'{"version":1,"products":[],"customers":[],"containers":[],"orders":[],"damages":[],"expenses":[],"audit":[]}'::jsonb);
  raise exception 'stale_write_was_accepted';
 exception when serialization_failure then null; end;
end $$;
select * from public.save_warehouse(1,'{"version":1,"products":[],"customers":[],"containers":[],"orders":[],"damages":[],"expenses":[],"audit":[]}'::jsonb);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-1111-4111-8111-111111111111","email":"business-b@example.test","role":"authenticated","is_anonymous":false,"user_metadata":{"owner_id":"aaaaaaaa-1111-4111-8111-111111111111","role":"admin"}}',true);
do $$ declare affected integer; begin
 if (select count(*) from public.warehouse) <> 0 then raise exception 'cross_account_read_succeeded'; end if;
 update public.warehouse set revision=revision+1 where owner_id='aaaaaaaa-1111-4111-8111-111111111111';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'cross_account_update_succeeded'; end if;
 begin
  insert into public.warehouse(owner_id,revision,data) values('aaaaaaaa-1111-4111-8111-111111111111',1,'{"version":1,"products":[],"customers":[],"containers":[],"orders":[],"damages":[],"expenses":[],"audit":[]}'::jsonb);
  raise exception 'cross_account_insert_succeeded';
 exception when insufficient_privilege then null; end;
end $$;
select * from public.save_warehouse(0,'{"version":1,"products":[],"customers":[],"containers":[],"orders":[],"damages":[],"expenses":[],"audit":[]}'::jsonb);
do $$ begin
 if (select count(*) from public.warehouse) <> 1 then raise exception 'account_b_isolation_failed'; end if;
 begin
  update public.warehouse set owner_id='aaaaaaaa-1111-4111-8111-111111111111' where owner_id=auth.uid();
  raise exception 'owner_reassignment_succeeded';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-1111-4111-8111-111111111111","email":"business-a@example.test","role":"authenticated","is_anonymous":false}',true);
do $$ begin
 if (select count(*) from public.warehouse) <> 1 or (select revision from public.warehouse) <> 2 then raise exception 'account_a_was_changed_by_b'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-1111-4111-8111-111111111111","email":"business-b@example.test","role":"authenticated","is_anonymous":true}',true);
do $$ begin
 if (select count(*) from public.warehouse) <> 0 then raise exception 'anonymous_session_read_succeeded'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.warehouse; raise exception 'anon_read_was_accepted'; exception when insufficient_privilege then null; end;
 begin perform public.save_warehouse(0,'{}'::jsonb); raise exception 'anon_rpc_was_accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: two businesses create/read own workspace; cross-account read/write/reassignment blocked; metadata cannot grant access; revisions and anonymous rejection passed; fixtures rolled back' as result;
