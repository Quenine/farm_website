# Duplicating This Codebase For Shields Farms

Use this guide to create a second independent deployment called Shields Farms from the same farm e-commerce codebase.

The intended architecture is:

- Same codebase.
- Separate Vercel deployment/project or separate Vercel environment.
- Separate Supabase project/database.
- Same Paystack account/keys may be used for now if the same Paystack business account should receive Shields Farms payments.
- Separate notification email, WhatsApp recipient/provider setup, and admin operations.
- Brand values configured through environment variables.

Do not implement multi-tenancy in the Noble Farms database for this copy. Noble Farms and Shields Farms must not share production orders, customers, payments, stock movements, notification logs, or admin operations.

## Confirmed Shields Farms Values

Use these non-secret values for the first Shields Farms deployment:

```env
NEXT_PUBLIC_SITE_NAME="Shields Farms"
NEXT_PUBLIC_SITE_URL="https://YOUR-VERCEL-SHIELDS-DOMAIN.vercel.app"
NEXT_PUBLIC_SITE_DOMAIN="YOUR-VERCEL-SHIELDS-DOMAIN.vercel.app"
NEXT_PUBLIC_SITE_TAGLINE="Fresh produce supplied with care."
NEXT_PUBLIC_SITE_DESCRIPTION="Order fresh poultry, eggs, crop produce, and selected farm inputs directly from Shields Farms."
NEXT_PUBLIC_BUSINESS_ADDRESS="Alapata, Olodo, Ibadan, Nigeria"
NEXT_PUBLIC_BUSINESS_PHONE="+2347034400380"
NEXT_PUBLIC_BUSINESS_EMAIL="info@YOUR-SHIELDS-DOMAIN"
NEXT_PUBLIC_SUPPORT_EMAIL="support@YOUR-SHIELDS-DOMAIN"
NEXT_PUBLIC_ORDERS_EMAIL="orders@YOUR-SHIELDS-DOMAIN"
NEXT_PUBLIC_WHATSAPP_PHONE="+2347034400380"
NEXT_PUBLIC_LOGO_PATH="/images/shields-farms-logo.png"
ADMIN_EMAIL="heeshat@gmail.com"
ADMIN_NOTIFICATION_EMAIL="heeshat@gmail.com"
ADMIN_NOTIFICATION_WHATSAPP_TO="2347034400380"
```

The custom domain is not bought yet, so use the Vercel domain first. Later, when the custom domain is ready, update `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_DOMAIN`, business email env vars, Paystack callback/webhook URLs, and redeploy.

## What Can Be Copied

Reference/catalogue data can be copied when Shields Farms should start with the same catalogue structure as Noble Farms:

- Categories.
- Products.
- Product prices.
- Stock defaults.
- Product delivery rates.
- Delivery zones/rates.
- Product media metadata, if the storage files are also copied or re-uploaded.
- App settings that are safe for the new brand.

Transactional data must not be copied:

- Orders.
- Order items.
- Payments.
- Inventory movements.
- Order status notifications.
- Notification/payment logs.
- Customer/order history.

Products, prices, stock defaults, and delivery rates can match Noble Farms. Orders, customers, payments, stock records, and notifications must remain separate.

## Vercel Setup

1. Create a new Vercel project from the same GitHub repo.
2. Name it `shields-farms` or `shields-farm`.
3. Add Shields-specific environment variables from `.env.shields.example`.
4. Use Shields Farms Supabase project keys.
5. Use the same Paystack keys as Noble Farms only if the same Paystack business account should receive Shields Farms payments.
6. Set `NEXT_PUBLIC_SITE_URL` to the Vercel deployment URL first, for example `https://YOUR-VERCEL-SHIELDS-DOMAIN.vercel.app`.
7. Set `NEXT_PUBLIC_SITE_DOMAIN` to the same Vercel hostname first.
8. Later, when a custom domain is bought, update these env vars and redeploy:
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_SITE_DOMAIN`
   - `NEXT_PUBLIC_BUSINESS_EMAIL`
   - `NEXT_PUBLIC_SUPPORT_EMAIL`
   - `NEXT_PUBLIC_ORDERS_EMAIL`
   - Email sender/reply-to values if the mailbox domain changes.

## Supabase Setup

1. Create a new Supabase project for Shields Farms.
2. Run `database/schema.sql`.
3. Run `database/step-notifications.sql` if it is still separate in the deployment branch.
4. Run `database/seed-full-catalogue.sql`.
5. Run `database/seed-product-delivery-rates.sql`.
6. Run `database/verify-new-brand-reference-data.sql`.
7. Confirm reference data exists.
8. Confirm transactional tables are empty.
9. Create the Shields Farms admin user for `heeshat@gmail.com`.
10. Confirm admin login works at `/admin`.
11. Upload product images through Shields admin or copy product media storage from Noble Farms.

## Product Media Storage

Product media is stored in Supabase Storage. Database backups or seed SQL files may copy product media records, but they do not always copy the actual image files.

For Shields Farms, use one of these approaches:

- Upload images again through the admin product media tools.
- Copy the `product-media` storage bucket from Noble Farms into the Shields Farms Supabase project.
- Update product media records if paths or public URLs change.

Do not rely on Noble Farms storage URLs long-term for Shields Farms. The Shields Farms deployment should own its product images so product pages keep working independently.

The logo file should be saved as `public/images/shields-farms-logo.png`. Do not remove the Noble Farms logo.

## Environment Variables

Use separate Shields Farms values for all service connections except Paystack when intentionally sharing the same Paystack business account:

- Shields Farms Supabase URL, anon key, and service role key.
- Shields Farms Gmail or email provider settings.
- Shields Farms notification recipients and WhatsApp provider settings.
- Shields Farms domain and public brand values.
- Paystack keys from Noble Farms only if sharing the same receiving business account is intended.

Never use Noble Farms Supabase credentials for Shields Farms.

## Admin Route

The admin route is intentionally hidden from public navigation. Admin users can still access it directly by typing `/admin`, such as `https://YOUR-VERCEL-SHIELDS-DOMAIN.vercel.app/admin`.

Security depends on Supabase auth, admin role checks, protected server-side data access, and noindex metadata. Hiding the public link is only a usability/privacy measure, not the security boundary.

## Production Smoke Test

Before launch, verify:

1. Homepage shows Shields Farms logo/name/contact.
2. Public nav does not show admin.
3. `/admin` works by direct URL.
4. Admin login works with the Shields admin user.
5. Products display.
6. Delivery rates coverage checker works.
7. Checkout calculates delivery.
8. Paystack starts.
9. Payment verifies.
10. Admin receives notification.
11. Buyer receives confirmation.
12. Admin status change sends buyer notification.
13. Track order works.
14. Noble Farms database does not receive the Shields order.
15. Shields Farms database receives the Shields order.

## Final Verification

Before launch, run `database/verify-new-brand-reference-data.sql` in the Shields Farms Supabase SQL editor.

Expected result:

- Reference tables have records.
- Transactional tables are zero before public launch.

Then place one test order, confirm the full workflow, back up the project, clear test transactional records, and manually confirm stock quantities.