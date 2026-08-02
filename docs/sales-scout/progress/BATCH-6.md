# Batch 6 progress

## Batch 6A: provider-neutral research evaluation

The Batch 6A foundation existed at commit `fef8711`. Batch 6A-H1 corrected the evaluation harness before any live provider request:

- Tavily query territory is retained only as requested context and no longer becomes verified candidate geography.
- Search results are classified as social, likely-official homepage, or discovery-only; arbitrary listings and articles do not become official websites.
- Contact, website, social, relevance, and evidence-coverage metrics now require matching evidence on the same candidate.
- Geoapify city resolution requires a matching Nigerian country, city/locality, and state, and returned facts receive field-level evidence.
- Provider errors distinguish bad request, authorization, rate limit, server, timeout, network, and invalid-JSON failures; only transient references receive one retry.
- Deduplication now coalesces transitive matches independently of input order.
- Provider discovery is deduplicated before unique-host website research, which is capped by `--max-websites`.
- Official-site enrichment normalizes and deduplicates contacts, retains evidence, and records conflicts rather than silently overwriting them.
- Website validation now handles bracketed and IPv4-mapped IPv6, rejects private/reserved destinations, uses the Shields Farms contact URL in its user agent, tolerates malformed canonical tags, and traverses only the final validated origin.
- Fixture mode now runs committed synthetic provider and HTML fixtures through the actual mappers, extractor, deduplication, quality rules, metrics, and writers.
- Fixture summaries explicitly say that results validate pipeline behaviour only and do not measure real Nigerian provider coverage.
- The static audit guards the evidence, ordering, retry, fixture, IPv6, website-cap, production, database, and DataForSEO boundaries.
- No dependency, database, migration, production service, UI, environment value, CRM behaviour, or outreach behaviour changed.
- No real provider-quality claim has been made.
- No Geoapify, Tavily, public website, DataForSEO, Supabase, PostgreSQL, Playwright, deployment, messaging, or outreach operation ran.
- Live evaluation remains pending owner approval, bounded parameters, and credentials.
