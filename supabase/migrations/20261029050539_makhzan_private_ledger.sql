-- Makhzan: private owner ledger with atomic revision control.
create table public.makhzan_access (
 email text primary key check (email = lower(email))
);
alter table public.makhzan_access enable row level security;
revoke all on public.makhzan_access from anon, authenticated;
grant select on public.makhzan_access to authenticated;
create policy "Owner can see own access grant" on public.makhzan_access
 for select to authenticated using (email = lower((select auth.jwt()->>'email')));

create table public.warehouse (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null check (revision > 0),
 data jsonb not null check (jsonb_typeof(data) = 'object' and data->>'version' = '1'
  and jsonb_typeof(data->'products') = 'array' and jsonb_typeof(data->'customers') = 'array'
  and jsonb_typeof(data->'containers') = 'array' and jsonb_typeof(data->'orders') = 'array'
  and jsonb_typeof(data->'damages') = 'array' and jsonb_typeof(data->'expenses') = 'array'
  and jsonb_typeof(data->'audit') = 'array'),
 updated_at timestamptz not null default now()
);
alter table public.warehouse enable row level security;
revoke all on public.warehouse from anon, authenticated;
grant select, insert, update on public.warehouse to authenticated;
create policy "Owner reads own warehouse" on public.warehouse for select to authenticated
 using (owner_id = (select auth.uid()) and exists(select 1 from public.makhzan_access where email = lower((select auth.jwt()->>'email'))));
create policy "Owner creates own warehouse" on public.warehouse for insert to authenticated
 with check (owner_id = (select auth.uid()) and exists(select 1 from public.makhzan_access where email = lower((select auth.jwt()->>'email'))));
create policy "Owner updates own warehouse" on public.warehouse for update to authenticated
 using (owner_id = (select auth.uid()) and exists(select 1 from public.makhzan_access where email = lower((select auth.jwt()->>'email'))))
 with check (owner_id = (select auth.uid()) and exists(select 1 from public.makhzan_access where email = lower((select auth.jwt()->>'email'))));

create function public.save_warehouse(expected_revision bigint, new_data jsonb)
 returns table(revision bigint,updated_at timestamptz)
 language plpgsql security invoker set search_path = '' as $$
declare saved_revision bigint; saved_at timestamptz;
begin
 if auth.uid() is null or expected_revision < 0 then raise exception 'invalid_identity_or_revision' using errcode = '42501'; end if;
 if octet_length(new_data::text) > 1600000 then raise exception 'ledger_size_limit'; end if;
 if expected_revision = 0 then
  insert into public.warehouse as w(owner_id, revision, data, updated_at)
   values(auth.uid(),1,new_data,now()) on conflict(owner_id) do nothing
   returning w.revision,w.updated_at into saved_revision,saved_at;
 else
  update public.warehouse as w set revision=w.revision+1,data=new_data,updated_at=now()
   where w.owner_id=auth.uid() and w.revision=expected_revision
   returning w.revision,w.updated_at into saved_revision,saved_at;
 end if;
 if saved_revision is null then raise exception 'revision_conflict' using errcode = '40001'; end if;
 return query select saved_revision,saved_at;
end;
$$;
revoke all on function public.save_warehouse(bigint,jsonb) from public,anon;
grant execute on function public.save_warehouse(bigint,jsonb) to authenticated;
