# Makhzan · مخزن

Private rice and soap warehouse operations: GitHub source, Supabase database/authentication, and Vercel deployment. The original FIFO/accounting engine and interactive workflows are preserved.

## What it handles

- Container receiving with product quantities, total landed purchase cost, arrival damage, and mixed-product cost weights.
- Item-level stock, whole pallet conversions, reservations, and FIFO depletion on dispatch.
- Mixed-product customer orders with agreed per-customer prices and per-order overrides.
- Order placed → dispatched → delivered; unpaid placed orders can be cancelled.
- Invoices, partial/full payments, overpayment credits and promised collection dates.
- Warehouse damage by specific container or FIFO, with reservation shortage visibility.
- Daily shared/direct expenses with visible allocation by daily stored weight.
- Container/product/date sales and operating profit reports, CSV exports and full JSON backups.
- A separate in-memory sample workspace for learning without inserting sample records into your database.

## Privacy

The Vercel project must keep Authentication Protection enabled for **all deployments**. Makhzan additionally requires Supabase email authentication. Only the verified email in the server-side `MAKHZAN_OWNER_EMAIL` setting is accepted. The database independently enforces its owner allowlist and row-level security. Other signed-in Supabase users and anonymous callers cannot read or write warehouse data.

No service-role key is needed or exposed. Only a publishable Supabase key is used. Production settings live in Vercel; secrets and `.env.local` are excluded from Git. Preview deployments are disabled rather than sharing the production database with branch previews.

## Local setup

1. Use Node.js 22.13+ and run `npm ci`.
2. Link the selected Vercel project and configure the three variable names in `.env.example`. For a new machine, pull appropriate development configuration via Vercel without printing values. Do not use production secrets in previews.
3. Apply the versioned migrations under `supabase/migrations/` to a dedicated Supabase project. Grant the owner's lowercased verified email using the parameterized example in `supabase/owner-access.sql`.
4. Configure Supabase Auth's Site URL to the stable Vercel domain, and allow the exact `/auth/callback` URL. Add a loopback callback separately if local sign-in is needed.
5. `npm run dev`, then sign in from `/login` using the authorized owner email.

The sign-in email is sent only when the user submits the login form. It uses PKCE and a one-time email link, not a stored application password. The API validates the session against Supabase Auth before reading or modifying data.

## Verification

- `npm run check`: TypeScript.
- `npm test`: accounting and API tests, including FIFO across containers, pallet/loose stock, reservations, damage, payment status, exact cent conservation, overlapping expenses, date reports and conflicting saves.
- `npm run build`: production Next.js build.
- `tests/database.sql`: live Supabase RLS and atomic-write checks inside a rolled-back transaction. The fixtures never send email and leave no saved stock or users behind.

## Accounting policy

All money is integer USD cents. Pallets convert to fixed individual units. Orders reserve stock at placement; dispatch recognizes revenue and consumes the oldest receipt first, with receipt entry order breaking same-date ties. Delivery never consumes stock twice. Stock movements must be recorded chronologically per product.

A container's total landed purchase cost is split by relative line invoice-value weights; blank weights default to received pounds. Arrival damage is part of the received quantity and writes off the corresponding purchase share. Remaining stock holds the unsold purchase cost as inventory.

Shared daily expenses use opening usable stock plus same-day receipts, weighted by the product's actual pounds per unit. Goods dispatched that day participate until the next day; sold-out containers then stop sharing. Direct expenses go entirely to the selected container. Product expense shares follow the same within-container weight method; a direct charge after sellout uses original usable receipt weights. Costs on days without inventory remain unallocated overhead but still reduce overall profit.

**Net operating profit = dispatched sales − FIFO cost of sold units − damage cost − operating expenses.** Payment receipts are tracked separately from revenue. An open container shows realized profit to date; a sold-out container shows final profit after all purchase cost has flowed through COGS and damage. Date-filtered reports use event dates; any inventory balances shown beside them are current balances.

## Current limits

This version retains posted records and does not reverse posted movements, refund payments, calculate sales tax, process returns or split one order across partial dispatches. Unpaid placed orders may be cancelled. The compact JSONB warehouse ledger has a 1.5 MB application size guard and atomic revision updates; a larger operation should evolve to normalized ledger tables. Backups are downloadable from Reports.

## Deployment

The private GitHub repository's main branch is connected to the dedicated Makhzan Vercel project. Production deployments build with `npm ci` and `npm run build`; all deployment URLs remain protected. Database migrations are reviewed and applied separately before releasing source that needs them. No original PRID/payroll project is modified by this migration.
