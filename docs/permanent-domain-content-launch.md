# Permanent Domain Content Launch

The temporary Shields Farms URL `https://shieldfarms.vercel.app` is for development and QA. Do not build search authority on that hostname.

## Before Enabling Indexing

1. Connect the permanent Shields Farms domain in Vercel.
2. Set `NEXT_PUBLIC_SITE_URL` to the permanent HTTPS URL.
3. Set `NEXT_PUBLIC_SITE_DOMAIN` to the matching hostname.
4. Confirm canonical diagnostics show no URL/domain mismatch.
5. Run `database/verify-content-affiliate-publisher.sql`.
6. Review published posts for author, category, alt text, sources, disclosure and methodology.
7. Confirm RSS, sitemap and canonical URLs use the permanent domain.
8. Set up Google Search Console and Bing Webmaster Tools manually.
9. Set `CONTENT_INDEXING_ENABLED=true` only when the domain is ready.
10. Optionally set `INDEXNOW_ENABLED=true` and `INDEXNOW_KEY` after the permanent domain is verified.

Draft, review, future scheduled, archived and preview content must remain noindex regardless of indexing state.
