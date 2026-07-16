# Noble Farms

Noble Farms is a Next.js 16 storefront and owner-admin application for fresh
poultry, eggs, processed chicken, and farm products delivered within Ibadan.

## Step 6: deployment readiness

The application currently includes:

- Supabase-backed products, delivery zones, settings, orders, and inventory
- Owner-only admin authentication with Supabase Auth
- A localStorage cart with server-authoritative checkout totals
- Paystack transaction initialization, callback verification, and signed
  webhook processing
- Idempotent payment processing, stock deduction, and inventory movements
- Customer order tracking and admin order management
- Production metadata, Open Graph basics, favicon, robots, sitemap, and friendly
  error/not-found states

This step prepares the repository for Vercel. It does not perform the deployment
or change DNS.

## Required environment variables

Copy `.env.example` to `.env.local` for local development. Add all of the
following variables to Vercel for production:

| Variable | Production value or purpose | Browser-visible |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_NAME` | `Noble Farms` | Yes |
| `NEXT_PUBLIC_SITE_URL` | `https://noblefarms.xyz` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key | No |
| `ADMIN_EMAIL` | Exact email of the owner Auth user | No |
| `PAYSTACK_SECRET_KEY` | Paystack test or live secret key | No |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Matching Paystack public key | Yes |

Only variables prefixed with `NEXT_PUBLIC_` are bundled for browser use.
`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, and `PAYSTACK_SECRET_KEY` are read
only by server code. Never commit real credentials.

Next.js loads `.env.local` with higher priority than `.env`, so local secrets
and overrides belong in `.env.local`. Vercel uses the environment variables
configured in the project dashboard; `.env.local` is not required in
production.

The committed `.env.example` contains placeholders only. For local development,
change `NEXT_PUBLIC_SITE_URL` to `http://localhost:3000`.

Delivery pricing is stored in Supabase `app_settings`, not environment
variables:

- `fuel_price_per_litre`
- `vehicle_km_per_litre`
- `driver_flat_fee`
- `use_round_trip`
- `delivery_fee_rounding`

## Supabase setup

1. Create a Supabase project.
2. Run [database/schema.sql](database/schema.sql) in the SQL Editor.
3. Run [database/seed.sql](database/seed.sql).
4. For an existing Step 4 database, also run
   [database/step5-paystack.sql](database/step5-paystack.sql).
5. In **Authentication -> Providers**, enable email/password authentication.
6. In **Authentication -> Users**, create the owner user and confirm the email.
7. Set `ADMIN_EMAIL` to that exact email address.

The service-role key bypasses Row Level Security and must remain server-only.
The storefront uses public read policies; privileged product, order, payment,
inventory, and settings mutations run on the server.

## Catalogue and universal delivery-rate updates

For catalogue/rate alignment, run these scripts in each farm's own Supabase project:

1. `database/seed-updated-crop-products.sql`
2. `database/seed-legacy-product-prices.sql`
3. `database/backfill-universal-rates-for-all-orderable-products.sql`
4. `database/verify-all-products-orderable-and-rated.sql`

Run them separately for Noble Farms and Shields Farms if both farms should stay aligned. The legacy price seed applies confirmed legacy prices, uses clear placeholder prices where prices were missing, and avoids ₦0 checkout products. Admin should review placeholder prices before public launch.

The universal delivery backfill creates product delivery rates for every active fixed-price orderable product using city = `All` for every Nigerian state plus FCT:

- Pickup Point Delivery: package size 1, first package N10,000, extra package N3,000.
- Home Delivery: package size 1, first package N15,000, extra package N3,000.
- Farm Pickup: package size 1, first package N0, extra package N0.

Admin can later override a state-wide `All` rate with a specific city/product rate. Run `database/verify-all-products-orderable-and-rated.sql` to confirm every orderable product has 111 universal fallback rates.

## Payment and inventory behavior

Checkout sends product IDs and quantities to the server. The server reloads
current products, stock, prices, delivery zones, and settings before creating an
order. Customer-supplied totals are never trusted.

Paystack initialization uses this callback URL:

```text
${NEXT_PUBLIC_SITE_URL}/payment/callback
```

In production that resolves to:

```text
https://noblefarms.xyz/payment/callback
```

The Paystack webhook endpoint is:

```text
https://noblefarms.xyz/api/paystack/webhook
```

The callback and webhook share the same idempotent payment processor. Stock is
deducted only after verified payment. `products.stock_quantity` is the current
balance, while `inventory_movements` is the audit ledger. Repeated callbacks or
webhook deliveries do not deduct stock or create movements twice.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Before committing:

```bash
npm run lint
npm run build
```

## Deploy to Vercel

1. Push the repository to a Git provider supported by Vercel.
2. In Vercel, select **Add New -> Project** and import the repository.
3. Keep the detected Next.js framework settings and default install/build
   commands.
4. Add every variable from the production environment table under
   **Project Settings -> Environment Variables**.
5. Set `NEXT_PUBLIC_SITE_URL` to `https://noblefarms.xyz`.
6. Deploy and confirm the build completes.

Use separate test credentials for Preview environments if previews will execute
checkout. Do not put production service-role or Paystack live keys into
untrusted preview deployments.

## Connect noblefarms.xyz

1. Open the Vercel project and go to **Settings -> Domains**.
2. Add `noblefarms.xyz`.
3. Optionally add `www.noblefarms.xyz` and redirect it to the apex domain.
4. At the domain registrar, add the DNS records Vercel displays.
5. Wait for Vercel to verify the domain and issue HTTPS certificates.
6. Confirm the production environment still has
   `NEXT_PUBLIC_SITE_URL=https://noblefarms.xyz`, then redeploy if it changed.

Do not copy generic DNS values from another project; use the records shown by
Vercel for this project.

## Configure Paystack after deployment

In the Paystack dashboard:

1. Set the webhook URL to
   `https://noblefarms.xyz/api/paystack/webhook`.
2. The application supplies
   `https://noblefarms.xyz/payment/callback` when initializing transactions.
3. Keep test keys configured while validating the production deployment.

To switch to live mode later:

1. Complete Paystack's live-business requirements.
2. Replace `PAYSTACK_SECRET_KEY` with the live secret key in Vercel.
3. Replace `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` with the matching live public key.
4. Redeploy so the public key is included in the production build.
5. Make a small real transaction and verify the order, payment, stock, and
   inventory movement before accepting normal traffic.

Never expose or log the Paystack secret key.

## Deployment verification

After deployment, verify:

1. `/`, `/shop`, product details, cart, checkout, tracking, about, and contact
   load over HTTPS.
2. `/admin` redirects signed-out visitors to `/admin/login`.
3. The owner can sign in, edit a product, and see the update publicly.
4. Checkout creates an order using current database prices and stock.
5. A Paystack test payment returns through `/payment/callback` to the friendly
   status page.
6. The webhook receives a valid event.
7. The paid order appears in tracking and admin orders.
8. Stock reduces once and one inventory movement exists per order item.
9. Reopening the callback does not deduct inventory again.
10. Vercel build/runtime logs contain no credentials or raw customer secrets.


## Marketing readiness

The app includes consent-based analytics readiness, campaign attribution, tracked campaign links, QR-code SVG generation, and a Business Supply page. Next phase: Shields Farms organic marketing launch, including campaign creatives, printed and digital flyers, WhatsApp content, food-business outreach and tracked QR campaigns.

## Intentionally not implemented

- Mobile application
- Customer accounts or customer authentication
- Supabase cart storage
- Automated refunds and chargeback handling
- Deployment execution, registrar DNS changes, or Paystack live-mode activation

## Shields Content Publisher

Shields Farms is the initial agribusiness content and affiliate publisher. Noble Farms remains commerce-only by default.

Content flags:

```env
NEXT_PUBLIC_CONTENT_HUB_ENABLED=false
NEXT_PUBLIC_AFFILIATE_CONTENT_ENABLED=false
NEXT_PUBLIC_CONTENT_TOOLS_ENABLED=false
NEXT_PUBLIC_CONTENT_SUBSCRIPTIONS_ENABLED=false
CONTENT_INDEXING_ENABLED=false
NEXT_PUBLIC_CONTENT_PRIMARY_MARKET="Nigeria and Africa"
NEXT_PUBLIC_CONTENT_SECONDARY_MARKET="Global"
INDEXNOW_ENABLED=false
INDEXNOW_KEY=
```

For Shields QA, enable the public content flags but keep `CONTENT_INDEXING_ENABLED=false` on `shieldsfarms.store`. Run Shields-only SQL in this order:

1. `database/step-content-affiliate-publisher.sql`
2. `database/seed-shields-content-taxonomy.sql`
3. `database/step-content-trash-and-deletion.sql`
4. `database/verify-content-affiliate-publisher.sql`
5. `database/verify-content-admin-operational.sql`
6. `database/step-contact-inquiries.sql`
7. `database/verify-contact-inquiries.sql`

See `docs/content-affiliate-publisher.md`, `docs/agribusiness-content-strategy.md`, and `docs/permanent-domain-content-launch.md`. Do not share production order tables or duplicate Shields articles across farms.

