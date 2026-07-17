# Shields Farms content indexing launch

Indexing remains off until an administrator reviews the automatic readiness result and every relevant manual checklist item. Code never changes an environment flag automatically.

The gate requires the canonical HTTPS Shields domain, five eligible real articles, complete editorial, SEO and image metadata, valid affiliate disclosure and comparison methodology, no broken or retired recommendations, buildable sitemap and RSS data, required policy pages, and official email routing. Pending Resend domain verification is not a local build requirement.

After approval, separately set CONTENT_INDEXING_ENABLED=true, deploy, verify /robots.txt, /sitemap.xml and /blog/feed.xml, and review the resulting URLs. Keep INDEXNOW_ENABLED=false until IndexNow is intentionally activated with a configured key.

Eligible articles are published, non-future, non-trashed, and do not declare an external canonical URL. Drafts, review, archived, trashed, future, search, filter, admin, preview and redirect URLs are excluded.
