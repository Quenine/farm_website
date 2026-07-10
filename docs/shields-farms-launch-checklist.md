# Shields Farms Launch Checklist

Use this checklist after creating the Shields Farms deployment and before accepting real customer orders.

## Confirmed Shields Details

- Address: Alapata, Olodo, Ibadan, Nigeria.
- Phone/WhatsApp: +2347034400380.
- Admin email: heeshat@gmail.com.
- Domain: use the Vercel deployment domain first; custom domain can be added later.
- Products, prices, stock defaults, and delivery rates should match Noble Farms at setup.
- Paystack can use the same Noble Farms Paystack account for now if that account should receive Shields Farms payments.

## Brand Assets

- [ ] Shields Farms site name, Vercel domain, address, email, phone, and WhatsApp env vars are set.
- [ ] Shields Farms logo is saved as `public/images/shields-farms-logo.png`.
- [ ] Public pages show Shields Farms details, not Noble Farms details.

## Domain

- [ ] A Vercel deployment domain is active for Shields Farms.
- [ ] `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_SITE_DOMAIN` match the Vercel deployment domain first.
- [ ] Paystack callback and webhook URLs use the active Shields Farms deployment URL.
- [ ] When a custom domain is bought, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_DOMAIN`, and business email env vars are updated and the app is redeployed.

## Supabase Project

- [ ] A separate Shields Farms Supabase project exists.
- [ ] The app uses Shields Farms Supabase URL, anon key, and service role key.
- [ ] Noble Farms Supabase credentials are not used in the Shields Farms deployment.
- [ ] Admin user exists for `heeshat@gmail.com`.
- [ ] Admin login works at `/admin`.

## Database Schema And Seeds

- [ ] `database/schema.sql` has been run.
- [ ] `database/step-notifications.sql` has been run if it is still separate.
- [ ] `database/seed-full-catalogue.sql` has been run.
- [ ] `database/seed-updated-crop-products.sql` has been run.
- [ ] `database/seed-legacy-product-prices.sql` has been run.
- [ ] `database/backfill-universal-rates-for-all-orderable-products.sql` has been run.
- [ ] `database/verify-product-and-rate-update.sql` shows the crop products are complete.
- [ ] `database/verify-all-products-orderable-and-rated.sql` shows every product is orderable, no product has a zero price, and every orderable product is rated.
- [ ] `database/verify-universal-delivery-rates.sql` shows all 37 state-wide fallback rates are complete and correctly priced.
- [ ] Products, prices, stock defaults, and delivery rates match Noble Farms as intended.
- [ ] `database/verify-new-brand-reference-data.sql` shows reference data exists.
- [ ] Transactional tables are empty before launch.

## Product Media

- [ ] Product media has been uploaded through admin or copied into the Shields Farms Supabase Storage project.
- [ ] Product media records point to Shields Farms-owned storage paths or URLs.
- [ ] Product detail pages show images correctly.
- [ ] Stock has been reviewed after seeding.
- [ ] Placeholder prices have been reviewed in admin.
- [ ] Featured products have been reviewed after seeding.

The product catalogue and delivery rates can be seeded, but product image files in Supabase Storage may not automatically copy to the new Shields Supabase project. If product images do not appear, upload them again through Shields admin or copy the `product-media` bucket manually.

## Delivery Rates

- [ ] Product delivery rates match Noble Farms as intended.
- [ ] Universal `All` city rates exist for Pickup Point Delivery, Home Delivery, and Farm Pickup across all Nigerian states plus FCT.
- [ ] Pickup Point uses package size 1, first package N10,000, extra package N3,000.
- [ ] Home Delivery uses package size 1, first package N15,000, extra package N3,000.
- [ ] Farm Pickup uses package size 1, first package N0, extra package N0.
- [ ] Product delivery rates exist for every launch destination and delivery method.
- [ ] All-city fallback rates exist where intended.
- [ ] The admin coverage checker passes for launch locations.

## Paystack

- [ ] Paystack public key is configured.
- [ ] Paystack secret key is configured server-side only.
- [ ] Same Noble Farms Paystack account is used only if that account should receive Shields Farms payments.
- [ ] Paystack mode is confirmed for launch.
- [ ] Test payment or live pre-launch payment has been verified.

## Notifications

- [ ] Admin notification email is `heeshat@gmail.com`.
- [ ] Admin WhatsApp recipient is `2347034400380`.
- [ ] Shields Farms notification email account is configured.
- [ ] Customer email status notifications are tested.
- [ ] WhatsApp provider and recipient/template settings are configured if used.
- [ ] No notification secrets are exposed through public env vars.

## Cleanup Before Launch

- [ ] Back up the Shields Farms Supabase project.
- [ ] Clear test transactional records before accepting real orders.
- [ ] Confirm `orders`, `order_items`, `payments`, `inventory_movements`, and `order_status_notifications` are empty.
- [ ] Review product stock quantities manually after cleanup.

## Production Smoke Test

- [ ] Homepage shows Shields Farms logo, name, address, phone, and contact details.
- [ ] Public navigation does not show admin.
- [ ] `/admin` works by direct URL.
- [ ] Admin login works with the Shields admin user.
- [ ] Products display.
- [ ] Delivery rates coverage checker works.
- [ ] Checkout calculates delivery.
- [ ] Paystack starts.
- [ ] Payment verifies.
- [ ] Admin receives notification.
- [ ] Buyer receives confirmation.
- [ ] Admin status change sends buyer notification.
- [ ] Track order works.
- [ ] Noble Farms database does not receive the Shields order.
- [ ] Shields Farms database receives the Shields order.