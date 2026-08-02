# Batch 6 progress

## Batch 6A: provider-neutral research evaluation

The Batch 6A foundation existed at commit `fef8711`.

### H1 corrections

- Removed fabricated Tavily geography and classified search URLs conservatively.
- Required candidate-local evidence for contact, website, social, relevance, and coverage metrics.
- Hardened Geoapify territory matching, transient-only retries, transitive deduplication, unique-host enrichment, IPv6/SSRF checks, and the synthetic fixture pipeline.

### H2 final pre-live corrections

- Robots rules are now loaded and checked before the first ordinary page on each origin.
- A robots cache is keyed by origin; cross-origin redirect destinations load and check their own rules before redirected content.
- Denied paths raise `WEBSITE_ROBOTS_DISALLOWED`; unavailable robots rules stop the origin as `WEBSITE_ROBOTS_UNAVAILABLE`.
- Outreach readiness now requires both verified research relevance and a verified public contact route.
- Supported official JSON-LD types are retained with verified `schemaType` evidence.
- Official-site category verification uses only the documented conservative mappings; unsupported categories and description keywords remain unverified.
- The live execution ceiling now includes the one permitted provider retry.
- The preflight also reports maximum official websites and maximum HTML pages; website requests are excluded from provider credits.
- Fixture metrics use the corrected outreach-readiness rule and retain the synthetic-mode coverage disclaimer.
- Static guards cover robots ordering, redirect-origin rules, readiness composition, schema mapping, retry-inclusive credits, and protected production/database/DataForSEO boundaries.

No dependency, database, migration, production service, UI, provider request format, environment value, CRM, qualification, order, attribution, or outreach behavior changed. No Geoapify, Tavily, public website, DataForSEO, Supabase, PostgreSQL, Playwright, deployment, messaging, or production-write operation ran.

The first bounded live evaluation remains pending explicit owner approval, credentials, parameters, and review of the printed retry-inclusive cost ceiling.
