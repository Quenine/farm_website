# Batch 6 progress

## Batch 6A: provider-neutral research evaluation

- Added a nationwide Nigerian territory/category query matrix.
- Added provider-neutral candidate, evidence, source, territory, and category models.
- Added bounded Geoapify and Tavily adapters with safe configuration failures.
- Added controlled official-website extraction with DNS, SSRF, redirect, robots, page, byte, timeout, and pacing controls.
- Added deterministic deduplication and evidence-preserving conflict handling.
- Added contact-quality and outreach-readiness evaluation rules.
- Added an offline-by-default CLI that writes ignored JSON, CSV, and Markdown evaluation artifacts.
- Added synthetic provider, website, duplicate, conflict, missing-contact, and unsafe-URL fixtures.
- Added focused offline tests and a static safety audit.
- No dependency was added.
- No production persistence or UI changed.
- DataForSEO remains disabled and untouched.
- The Outscraper preview CSV was rejected as unusable.
- Provider-neutral research evaluation is the current direction.
- No production migration is included.
- No live Geoapify, Tavily, website, DataForSEO, Supabase, or outreach operation ran.
- Live evaluation remains pending explicit setup and approval.
