# Shields Farms Content and Affiliate Publisher

Batch 2A adds a publisher-side agribusiness content engine for Shields Farms. It does not create an affiliate-member programme, referral-code system, commission balances, withdrawals, payout tracking, merchant checkout, or automatic affiliate-network conversion imports.

## What Shields Tracks

- Published article, video, resource and tool pages.
- Which article displayed an affiliate recommendation.
- Consent-permitted outbound affiliate clicks through `/recommend/[slug]`.
- Consent-permitted content-to-product clicks through `/content-product/[postSlug]/[productSlug]`.
- Content-assisted Shields Farms orders through `orders.content_attribution`.
- Email/update-list subscriptions with explicit consent.

External merchants or affiliate networks track any purchases, commissions, refunds and settlement. The platform must not claim an affiliate click became a sale unless a future merchant integration proves it.

## Feature Flags

Noble Farms default:

```env
NEXT_PUBLIC_CONTENT_HUB_ENABLED=false
NEXT_PUBLIC_AFFILIATE_CONTENT_ENABLED=false
NEXT_PUBLIC_CONTENT_TOOLS_ENABLED=false
NEXT_PUBLIC_CONTENT_SUBSCRIPTIONS_ENABLED=false
CONTENT_INDEXING_ENABLED=false
```

Shields Farms QA default:

```env
NEXT_PUBLIC_CONTENT_HUB_ENABLED=true
NEXT_PUBLIC_AFFILIATE_CONTENT_ENABLED=true
NEXT_PUBLIC_CONTENT_TOOLS_ENABLED=true
NEXT_PUBLIC_CONTENT_SUBSCRIPTIONS_ENABLED=true
CONTENT_INDEXING_ENABLED=false
```

`CONTENT_INDEXING_ENABLED` is server-side. Keep it false on `shieldsfarms.store`. While false, content pages use `noindex,nofollow`, content URLs stay out of the sitemap, RSS is directly testable but not advertised, and IndexNow remains off.

## SQL Run Order

Run only in the Shields Farms Supabase project:

1. `database/step-content-affiliate-publisher.sql`
2. `database/seed-shields-content-taxonomy.sql`
3. `database/verify-content-affiliate-publisher.sql`

Do not run content migrations in Noble Farms unless Noble is intentionally converted into a publisher later.

## Markdown Syntax

Use Markdown with GFM tables. Raw HTML and JavaScript URLs are not supported. Controlled tokens must be on their own line:

```text
[[affiliate:offer-slug]]
[[product:product-slug]]
[[comparison:post-offers]]
[[video:post-video]]
[[sources]]
[[newsletter]]
[[callout:business-supply]]
[[tool:poultry-feed-requirement]]
[[tool:egg-sales-margin]]
```

Missing token objects render a safe unavailable message instead of crashing.

## Editorial Workflow

Publishing must be explicit. Do not publish when title, slug, excerpt, meaningful Markdown, author, category, required image alt text, disclosure, sources, or methodology are missing. Personally-tested claims require methodology evidence. Do not silently alter published slugs.

## Affiliate Setup

Create active partners and merchant-supplied offers. Destination URLs are resolved server-side by `/recommend/[slug]`; users cannot pass arbitrary destinations. Affiliate anchors use `rel="sponsored nofollow noopener noreferrer"`. Internal commission notes stay admin-only.

## Video Workflow

Video companion posts can include YouTube or safely hosted external embeds, thumbnail alt text, transcripts, chapters, related offers, related Shields products, tools and newsletter CTAs. Videos do not autoplay and the written guide must remain useful without playing the video.

## Subscribers

Subscription capture requires email, topic and explicit consent. It includes honeypot and simple rate limiting. The app stores unsubscribe tokens but does not send emails in this batch. Subscriber emails must never appear in analytics events or public pages.

## Tools

Current tools:

- Poultry Feed Requirement Estimator: `birds x daily feed per bird x days`; bags are rounded up by bag size; optional cost is `bags x bag price`.
- Egg Sales Margin Calculator: `revenue - total cost`; total cost includes crate cost, transport/packaging and other expenses.

Inputs are calculated locally and are not saved.

## IndexNow

`INDEXNOW_ENABLED=false` by default. IndexNow must not submit while `CONTENT_INDEXING_ENABLED=false`. Enable only after the permanent Shields domain is live and current-brand URLs are ready for indexing.
