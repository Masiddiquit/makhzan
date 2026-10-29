-- SQL CHECK constraints accept NULL, so require every state array explicitly.
alter table public.warehouse drop constraint warehouse_data_check;
alter table public.warehouse add constraint warehouse_data_check check (coalesce(
 jsonb_typeof(data) = 'object' and data->>'version' = '1'
 and jsonb_typeof(data->'products') = 'array' and jsonb_typeof(data->'customers') = 'array'
 and jsonb_typeof(data->'containers') = 'array' and jsonb_typeof(data->'orders') = 'array'
 and jsonb_typeof(data->'damages') = 'array' and jsonb_typeof(data->'expenses') = 'array'
 and jsonb_typeof(data->'audit') = 'array',false));
