# Marketing Readiness

This batch adds consent-based measurement, campaign links, attribution, WhatsApp conversion actions, and a business-supply landing page for each farm deployment.

## Setup

1. Run `database/step-marketing-attribution.sql` on the brand Supabase project.
2. Set `NEXT_PUBLIC_MARKETING_ENABLED=true` only when ready.
3. Add `NEXT_PUBLIC_GA_MEASUREMENT_ID` for GA4 analytics.
4. Add `NEXT_PUBLIC_META_PIXEL_ID` for Meta Pixel readiness.
5. Keep Noble Farms and Shields Farms on separate Supabase projects so campaign clicks, orders, and attribution never mix.

## Consent

Essential storage is always enabled for cart and checkout. Analytics loads only after Analytics consent. Meta Pixel loads only after Marketing consent. The footer Cookie Preferences link lets customers change choices.

## UTM Rules

Use lowercase campaign values where possible:

- `utm_source`: whatsapp, instagram, facebook, offline
- `utm_medium`: organic-social, direct-outreach, qr
- `utm_campaign`: campaign family such as shields-launch
- `utm_content`: creative placement such as whatsapp-status
- `utm_term`: optional product focus
- `utm_id`: campaign slug

## Campaign Links and QR Codes

Create campaigns in `/admin/marketing/campaigns`. Use the tracked URL `/go/[slug]` in WhatsApp posts, flyers, QR codes, and outreach. The redirect logs a click, adds UTM parameters, and redirects only to internal paths.

Each campaign exposes an SVG code using the current `NEXT_PUBLIC_SITE_URL`, so Noble and Shields deployments generate brand-specific links.

## Attribution to Orders

The browser stores first-touch and last-touch campaign data in first-party local storage. Checkout submits only whitelisted attribution fields. The server stores them on the order as `first_touch_attribution` and `last_touch_attribution`. No customer names, phone numbers, emails, addresses, IP addresses, prices, delivery fees, or payment amounts come from attribution data.

## Shields Presets

Run `database/seed-shields-marketing-campaigns.sql` only on the Shields Farms Supabase project. It creates optional launch campaigns for WhatsApp Status, food-business outreach, printed flyer QR, chicken, and tomatoes.

## What Is Tracked

When consent permits, the app can track page views, shop searches, product-list views, product views, add/remove cart, cart view, checkout start, shipping selection, verified purchase, WhatsApp leads, and sharing.

## What Is Not Tracked

The app does not send customer names, emails, phone numbers, delivery addresses, IP addresses, or admin secrets to analytics. Campaign click logging does not store IP addresses.

## Testing

Test with marketing disabled first. Then enable GA4 or Meta IDs, accept consent, search the shop, view a product, add to cart, begin checkout, and complete a test payment. Refresh the success page to confirm purchase tracking does not obviously fire again in the same browser.

## Disable Safely

Set `NEXT_PUBLIC_MARKETING_ENABLED=false` or remove the GA/Meta IDs. The app will no-op without breaking rendering, checkout, Paystack, delivery rates, auth, or notifications.

## Next Phase

Next phase: Shields Farms organic marketing launch, including campaign creatives, printed and digital flyers, WhatsApp content, food-business outreach and tracked QR campaigns.

