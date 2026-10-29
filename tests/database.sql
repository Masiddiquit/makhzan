-- Run with an admin connection. All fixtures are rolled back; no emails are sent.
begin;
insert into public.makhzan_access(email) values ('owner@example.test');
insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values
 ('aaaaaaaa-1111-4111-8111-111111111111','owner@example.test',now(),now(),now()),
 ('bbbbbbbb-1111-4111-8111-111111111111','outsider@example.test',now(),now(),now());
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-1111-4111-8111-111111111111","email":"owner@example.test","role":"authenticated"}',true);
select * from public.save_warehouse(0,'{"version":1,"products":[],"customers":[],"containers":[],"orders":[],"damages":[],"expenses":[],"audit":[]}'::jsonb);
do $$ begin
 if (select count(*) from public.warehouse) <> 1 then raise exception 'owner_read_failed'; end if;
 begin
  perform public.save_warehouse(0,'{"version":1,"products":[],"customers":[],"containers":[],"orders":[],"damages":[],"expenses":[],"audit":[]}'::jsonb);
  raise exception 'stale_write_was_accepted';
 exception when serialization_failure then null; end;
end $$;
select * from public.save_warehouse(1,'{"version":1,"products":[],"customers":[],"containers":[],"orders":[],"damages":[],"expenses":[],"audit":[]}'::jsonb);
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-1111-4111-8111-111111111111","email":"outsider@example.test","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.warehouse) <> 0 then raise exception 'outsider_read_succeeded'; end if;
 if (select count(*) from public.makhzan_access) <> 0 then raise exception 'access_grant_leaked'; end if;
 begin
  perform public.save_warehouse(0,'{"version":1,"products":[],"customers":[],"containers":[],"orders":[],"damages":[],"expenses":[],"audit":[]}'::jsonb);
  raise exception 'outsider_write_was_accepted';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.warehouse; raise exception 'anon_read_was_accepted'; exception when insufficient_privilege then null; end;
 begin perform public.save_warehouse(0,'{}'::jsonb); raise exception 'anon_rpc_was_accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: owner writes/read, revision conflicts, outsider isolation, anonymous table/RPC rejection; all fixtures rolled back' as result;
