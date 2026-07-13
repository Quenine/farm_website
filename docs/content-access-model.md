# Content and Affiliate Data Access Model

Shields Farms content is public to human visitors, but direct browser access to the Supabase content tables remains denied by RLS. The application uses this model:

- Public blog/resource/video loaders run on the trusted Next.js server.
- Public loaders use a server-only query layer and select only public-safe fields.
- Public content must be filtered to published posts with a non-null published date that is not in the future.
- Drafts, review posts, subscriber records, source internal notes, affiliate internal commission notes, and service keys are never sent to the browser.
- Protected admin pages first authenticate the current user with the normal session-aware Supabase server client, verify the owner/admin email, then use the server-only privileged content admin client.
- The privileged content admin client uses SUPABASE_SERVICE_ROLE_KEY with auth session persistence disabled.
- CONTENT_INDEXING_ENABLED controls robots/sitemap/IndexNow only. It does not hide content from human visitors when NEXT_PUBLIC_CONTENT_HUB_ENABLED is true.

This is intentional while content and affiliate tables have RLS enabled with no public read policies.
