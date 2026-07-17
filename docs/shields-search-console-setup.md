# Shields Farms search console setup

## Google Search Console

Create a Domain property for shieldsfarms.store and add the DNS TXT record in Namecheap. Alternatively, configure NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION with the exact HTML verification token and deploy. Code does not create or connect an account.

## Bing Webmaster Tools

Create the site in Bing Webmaster Tools and complete DNS or HTML verification. For metadata verification, configure NEXT_PUBLIC_BING_SITE_VERIFICATION. Code does not create or connect an account.

Verification values are emitted only when non-empty and syntactically valid. Never hardcode provider tokens.

After the explicit indexing gate is approved and indexing is enabled, submit:

- Sitemap: https://shieldsfarms.store/sitemap.xml
- RSS: https://shieldsfarms.store/blog/feed.xml

Confirm canonical HTTPS URLs, robots behavior, eligible article count, and that drafts, Trash, future posts, empty taxonomies, redirects and query-filter URLs are absent.
