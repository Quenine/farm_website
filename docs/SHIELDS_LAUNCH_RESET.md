# Shields Farms launch reset
The app_settings table may legitimately contain zero rows. Launch readiness requires the table and its schema to remain present, not a fabricated settings record.
This controlled, one-time cleanup does not run automatically. Review it and
manually confirm it in the Shields Supabase SQL editor.

## Exact run order

1. Confirm product stock manually and retain an export or screenshot.
2. Create a Supabase backup where available.
3. Run `database/preview-shields-launch-reset.sql`.
4. Review every count, timestamp, preservation reason, stock row, and live foreign key.
5. Replace `REPLACE_ME` with `RESET_SHIELDS_FARMS_LAUNCH_2026_07_26`. Set `v_reset_test_subscribers` to `true` to clear acceptance subscribers or `false` to preserve them.
6. Run `database/execute-shields-launch-reset.sql`.
7. Run `database/verify-shields-launch-reset.sql`.
8. Run `database/seed-shields-launch-campaigns.sql`.
9. Test every returned `/go/` short link.
10. Create one unpaid test order.
11. Confirm notification and inquiry creation.
12. Delete that final acceptance order only if required before public launch.

Stop if a preview table is unexpected, an unfamiliar foreign key appears, a
protected-table fingerprint fails, or readiness is false. An error aborts the
explicit transaction.

## Scope and deletion order

The child-before-parent order is:

1. `order_push_subscriptions`, `order_status_notifications`, `payments`, `inventory_movements`, `order_items`, `orders`
2. `app_notification_reads`, `app_notifications`
3. `marketing_prospect_activities`, `marketing_prospects`, `marketing_social_activities`, `marketing_campaign_spend`, `marketing_campaign_clicks`, `marketing_campaigns`
4. `affiliate_conversions`, `affiliate_clicks`, `content_post_affiliate_offers`, `affiliate_offers`, `affiliate_partners`
5. `content_product_clicks`, `contact_inquiries`
6. Optionally, `content_subscribers`

The execution script also checks `pg_constraint` and refuses unknown incoming
dependencies.

Preserved tables include `web_push_subscriptions`, `products`, `categories`,
`product_images`, `product_media`, `delivery_zones`, `delivery_rates`,
`product_delivery_rates`, `app_settings`, `profiles`, `auth.users`,
`content_posts`, `content_authors`, `content_categories`, `content_tags`,
`content_sources`, and `content_videos`. Migrations, functions, triggers,
indexes, policies, prices, quantity rules, delivery rules, and configuration
are not altered.

## Safeguards

Before deletion, the script snapshots every product ID and exact
`stock_quantity`. It fingerprints products, catalogue/media, delivery
configuration, app settings, profiles, content, and Web Push subscriptions.
It compares all snapshots before commit and rolls back on any difference.
Current stock is preserved exactly; inventory movement history is cleared.

Keep `CONTENT_INDEXING_ENABLED=false` and `INDEXNOW_ENABLED=false`. They are
deployment values, not Supabase rows, so confirm them in the Shields deployment.
Keep Shields and Noble on separate Supabase projects and run this SQL only on
Shields Farms.

## Campaign bootstrap

The repeat-safe seed upserts nine campaigns by unique slug. Retail campaigns
target `/shop`; Business Supply targets `/business-supply`. Examples:

- `https://shieldsfarms.store/go/fresh-essentials-whatsapp`
- `https://shieldsfarms.store/go/irish-potatoes-whatsapp`
- `https://shieldsfarms.store/go/business-supply-outreach`

## Records outside this reset

- Google Analytics history is not stored in Supabase and is not deleted.
- Paystack dashboard history is not deleted by the SQL.
- Vercel, Brevo, and Supabase logs are not deleted.
- Current product stock is preserved.
- Dashboard figures reset because their source records are cleared.

After seeding, test every redirect, confirm it stays on
`https://shieldsfarms.store`, and verify its landing path and campaign click.
Confirm the unpaid order creates no payment or inventory movement, then verify
notification and inquiry handling.
