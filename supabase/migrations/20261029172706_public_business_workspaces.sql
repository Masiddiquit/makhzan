-- Public registration, private per-account ledgers. Existing owner IDs stay unchanged.
drop policy "Owner reads own warehouse" on public.warehouse;
drop policy "Owner creates own warehouse" on public.warehouse;
drop policy "Owner updates own warehouse" on public.warehouse;

create policy "Account reads own warehouse" on public.warehouse for select to authenticated
 using (owner_id = (select auth.uid())
  and coalesce((select auth.jwt()->>'email'),'') <> ''
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false) = false);
create policy "Account creates own warehouse" on public.warehouse for insert to authenticated
 with check (owner_id = (select auth.uid())
  and coalesce((select auth.jwt()->>'email'),'') <> ''
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false) = false);
create policy "Account updates own warehouse" on public.warehouse for update to authenticated
 using (owner_id = (select auth.uid())
  and coalesce((select auth.jwt()->>'email'),'') <> ''
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false) = false)
 with check (owner_id = (select auth.uid())
  and coalesce((select auth.jwt()->>'email'),'') <> ''
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),false) = false);

-- Retain the legacy allowlist; it no longer grants warehouse access.
-- Anonymous grants remain revoked. save_warehouse stays SECURITY INVOKER and
-- derives ownership from auth.uid(), never a client-supplied business/owner ID.
