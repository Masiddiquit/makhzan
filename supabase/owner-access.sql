-- Run once in the new Makhzan project, replacing the parameter with the owner email.
-- Never expose write access to this table to browser roles.
insert into public.makhzan_access(email) values (lower(:'owner_email')) on conflict do nothing;
