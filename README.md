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

Password recovery uses the existing exact `/auth/callback` URL and an email-only, nonpersistent implicit-flow client so setup links can open from Gmail in a different browser. The callback forwards fragment credentials to `/auth/complete`; that page immediately removes them from the address/history and posts them to a same-origin, no-store endpoint. The endpoint validates the email identity with Auth, displays it for explicit account confirmation, then validates/rotates the refresh token before creating server cookies. Tokens are never returned in JSON, logged, or stored in the warehouse ledger. The verified session opens `/account/password`. Signup confirmation remains PKCE, including its `sb_flow_id`. Invalid callbacks never globally sign out another device. An arbitrary `next` URL is never accepted. Repeated signup responses with empty identities direct existing email-link accounts to password setup instead of claiming that a password was created.

Signup confirmation and password-setup emails still depend on Supabase mail delivery and its rate limits. This release does not raise rate limits or bypass email confirmation. Custom SMTP remains required before general public onboarding. The legacy email-link endpoint is retained for compatibility but is no longer the default login screen. Tests mock email delivery and credentials; no test sends an email or changes a real user's password.

## Verification

- `npm run check`: TypeScript.
- `npm test`: accounting and API tests, including FIFO across containers, pallet/loose stock, reservations, damage, payment status, exact cent conservation, overlapping expenses, date reports and conflicting saves.
- `npm run build`: production Next.js build.
- `tests/database.sql`: live Supabase RLS and atomic-write checks inside a rolled-back transaction. The fixtures never send email and leave no saved stock or users behind.

## Flexible packaging, receiving and selling

Every product has a smallest tracked unit (bag, bar, pouch, sachet, tin, etc.) and up to eight optional packaging levels. Each level names its package, states how many of the previous level it contains, and optionally enables selling and a default package price. Category does not select or require a packaging structure. Weight may be entered in grams, kilograms or pounds; expense calculations normalize to pounds internally.

Examples: turmeric 12 bars/pack × 12 packs/box × 60 boxes/pallet; papaya 100 bars/box with no required pack or pallet; tea 20 sachets/retail box × 30 retail boxes/master carton × 50 cartons/pallet; rice 4 five-pound pouches/box × 80 boxes/pallet. Pallets can also contain bags directly. These examples are editable and must be checked against actual supplier quantities and weights.

Receiving accepts a count in any configured package plus optional extra loose units, with floor-loaded or palletized loading on each line. A receipt can override its packaging quantities without changing the product default. Earlier receipt profiles remain available as order-unit variants; receipt snapshots and old invoices never recalculate when future packaging is edited.

Choose one purchase costing method: total container cost (split by explicit invoice weights, otherwise net product weight), or a purchase price per chosen unit on every line (line amounts sum to the container total). The line method rounds each extended product cost once to cents. If a total is supplied as well, it must reconcile. The displayed average smallest-unit cost can have fractional cents; FIFO conserves the exact stored purchase cents. Arrival damage is part of the gross received quantity and its cost is written off.

Orders choose the selling unit and its price, including customer-specific package prices. Each line saves its selected-unit price, count, conversion and exact cent total. Revenue is allocated across FIFO lots by cumulative proportions of that exact total; a box price is never rounded into a bar price and multiplied back. Legacy invoices retain their original totals and conventions.

Recorded physical packaging is distinct from pallet equivalents. Intact packages inside a larger intact package are included in the smaller-package counts (the same stock, not extra stock). Opening creates open containers; removing individual units creates partial containers. Floor-loaded loose items do not appear as sealed packages. Open / repack stock records handling within one original receipt lot without changing quantity, cost or source. New packaged orders reserve compatible intact packages, and dispatch keeps other packaging reservations valid. Package-constrained picking uses the oldest compatible intact stock; it can skip older loose units which cannot satisfy a whole-package order.

Existing saved receipts without physical-package history are labelled unconfirmed. Check the warehouse and use repacking to record their actual structure. This version does not combine products or separate receipt lots into a single physical pallet, assign physical pallet barcodes/locations, or separately track gross shipping weights. The visible counts are based on recorded handling and movements and should be reconciled with physical stock counts.

Samples / gifts can be entered in any defined unit, including five tea sachets from an opened retail box. They reduce stock and recognize FIFO purchase cost once under marketing expenses. They do not create a sale, invoice or damage loss. They are listed separately in the damage/sample register, and their cost is included in container and product expenses/profit. Do not enter the same sample purchase cost again as a manual marketing expense.

## Accounting policy

All stored totals are integer USD cents. Packaging converts to fixed smallest tracked units; per-item average prices may have fractional cents for display. Orders reserve stock at placement; dispatch recognizes revenue and consumes the oldest receipt first, with receipt entry order breaking same-date ties. Delivery never consumes stock twice. Stock movements must be recorded chronologically per product.

A container's total landed purchase cost is split by relative line invoice-value weights; blank weights default to received pounds. Arrival damage is part of the received quantity and writes off the corresponding purchase share. Remaining stock holds the unsold purchase cost as inventory.

Shared daily expenses use opening usable stock plus same-day receipts, weighted by the product's actual pounds per unit. Goods dispatched that day participate until the next day; sold-out containers then stop sharing. Direct expenses go entirely to the selected container. Product expense shares follow the same within-container weight method; a direct charge after sellout uses original usable receipt weights. Costs on days without inventory remain unallocated overhead but still reduce overall profit.

**Net operating profit = dispatched sales − FIFO cost of sold units − damage cost − expenses (including sample/gift inventory cost).** Payment receipts are tracked separately from revenue. An open container shows realized profit to date; a sold-out container shows final profit after all purchase cost has flowed through COGS and damage. Date-filtered reports use event dates; any inventory balances shown beside them are current balances.

## Current limits

This version retains posted records and does not reverse posted movements, refund payments, calculate sales tax, process returns or split one order across partial dispatches. Unpaid placed orders may be cancelled. The compact JSONB warehouse ledger has a 1.5 MB application size guard and atomic revision updates; a larger operation should evolve to normalized ledger tables. Backups are downloadable from Reports.

## Deployment

The GitHub repository's main branch is connected to the dedicated Makhzan Vercel project. Production deployments build with `npm ci` and `npm run build`; the stable production domain is public and generated deployment URLs remain protected. Database migrations are reviewed and applied separately before releasing source that needs them.
