# Makhzan · مخزن

Warehouse operations for independent businesses: GitHub source, Supabase database/authentication, and Vercel deployment. The original FIFO/accounting engine and interactive workflows are preserved.

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

The production URL is publicly reachable without a Vercel account. Every email account has one private business workspace; there is no shared public warehouse. Supabase email confirmation is required before access. The API validates the current Supabase user and scopes reads to that user ID. Database row-level policies independently restrict SELECT, INSERT, and UPDATE to the signed-in account, including ownership checks on updated rows. Anonymous sessions cannot access warehouse records. The original owner's user ID and records are unchanged.

This release does not include staff invitations, shared team workspaces, or multiple businesses per account. Use separate accounts for separate businesses. No service-role key is needed or exposed. Only a publishable Supabase key is used. Preview deployments remain disabled, generated deployment URLs remain protected by Vercel Standard Protection.

## Local setup

1. Use Node.js 22.13+ and run `npm ci`.
2. Configure the two public variable names in `.env.example`. Pull the appropriate environment configuration without printing or committing credentials.
3. Apply the versioned migrations under `supabase/migrations/` to the dedicated Supabase project. The latest migration replaces the legacy owner allowlist with account ownership; do not add new users to `makhzan_access`.
4. Enable Supabase email signup with email confirmation. Configure the Auth Site URL to the stable Vercel domain and allow the exact `/auth/callback` URL. Add a loopback callback separately for local sign-in.
5. **Configure custom SMTP before inviting other businesses.** Supabase's default mail service only sends to project team addresses. Public registration cannot complete until a verified sender and delivery service are configured in Authentication → Emails → SMTP Settings. Keep email confirmation on. Never commit SMTP credentials.
6. `npm run dev`, then create or sign into a workspace from `/login`.

## Sign in, signup, and existing email-link accounts

The default login is email and password, with separate Sign in and Create account options. Password sign-in calls Supabase Auth directly from a server route and never sends a login email. Session cookies persist and the proxy refreshes them; browsers and Gmail's embedded browser have separate cookie stores. Signing out or an expired/revoked session requires another password sign-in.

New accounts choose a 12–128 character password and confirm their email once. Existing email-link accounts must use their original email, not create a second account: choose Set or reset password to request one setup email, or use Set / change password in the warehouse while already signed in. The password form updates the authenticated Supabase user, keeping the existing user ID and all warehouse records. Passwords are passed to Supabase over HTTPS and are never stored in the warehouse ledger or returned to the browser by the API.

Password recovery uses the existing exact `/auth/callback` URL with PKCE. A short-lived, HttpOnly, SameSite=Lax intent cookie directs a successfully verified recovery session to `/account/password`; it cannot authorize a password update itself. The server validates a fresh verified session before calling `updateUser`. An arbitrary `next` URL is never accepted. Open the setup email in the same browser where it was requested. The intent cookie is cleared after the callback or a successful password save/sign-in.

Signup confirmation and password-setup emails still depend on Supabase mail delivery and its rate limits. This release does not raise rate limits or bypass email confirmation. Custom SMTP remains required before general public onboarding. The legacy email-link endpoint is retained for compatibility but is no longer the default login screen. Tests mock email delivery and credentials; no test sends an email or changes a real user's password.

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

The GitHub repository's main branch is connected to the dedicated Makhzan Vercel project. Production deployments build with `npm ci` and `npm run build`; the stable production domain is public and generated deployment URLs remain protected. Database migrations are reviewed and applied separately before releasing source that needs them.
