# Sales Scout research evaluation

## Purpose and scope

Batch 6A is an offline-first evaluation harness for Nigerian B2B prospect research. Its foundation existed at commit `fef8711`. H1 corrected evidence inflation, retry classification, duplicate enrichment, and destination safety. H2 completes the pre-live safety gate by correcting robots ordering, relevance-aware outreach readiness, conservative JSON-LD category evidence, and retry-inclusive cost ceilings.

Evaluation artifacts are not CRM prospects and the harness does not write to production. The committed matrix covers Lagos, Ibadan, Abuja, Port Harcourt, Enugu, Kano, and Gombe across Restaurant, Hotel, Supermarket, and Caterer queries.

## Source and evidence boundaries

- Geoapify may supply structured place identity, categories, location, contact, and an explicit website field. Territory geocoding requires a defensible Nigerian city/state match.
- Tavily results are discovery sources. Query territory is requested context, not candidate geography. Social results are plausible profiles; directories, articles, maps, marketplaces, reviews, news, and aggregators are not official websites.
- A Tavily URL is eligible for website research only when deterministic business-name/domain evidence marks a homepage as likely official.
- Official-site extraction may verify public contacts, social links, structured geography, and supported JSON-LD `@type` values.
- Website schema types verify the requested category only for these conservative mappings: Restaurant → Restaurant; Hotel → Hotel or LodgingBusiness; Supermarket → GroceryStore; Caterer → Caterer or CateringBusiness; School → School; Hospital → Hospital.
- Food Vendor, Food Processor, Distributor, and Institution receive no website schema mapping. Description keywords never verify category relevance.
- DataForSEO remains present, disabled, and unchanged.

Quality is candidate-local. Research readiness requires verified requested category, Nigerian country, state, city, business name, and a public source URL. Outreach readiness requires both research readiness and a same-candidate verified public contact route. A verified contact alone is insufficient.

## Robots, destination, and crawl safety

For every origin, the crawler validates DNS and destination safety, loads `/robots.txt`, and checks the requested path before fetching ordinary HTML. Robots rules are cached by origin. Cross-origin redirects are validated and their destination robots rules are loaded and checked before redirected content is requested.

A usable HTTP 200 robots response is applied. HTTP 404 or 410 means no declared rules. Timeout, network failure, 401, 403, rate limiting, and server failure stop crawling that origin as `WEBSITE_ROBOTS_UNAVAILABLE`; denied paths stop as `WEBSITE_ROBOTS_DISALLOWED`.

Existing redirect, same-final-origin, page, byte, timeout, pacing, IPv4/IPv6, and SSRF controls remain. The harness performs no browser automation, JavaScript execution, credential automation, CAPTCHA bypass, private-content access, messaging, or outreach.

## Fixture mode and live cost gate

Fixture mode is the default and makes no network request. It runs committed synthetic Geoapify, Tavily, and HTML fixtures through the real mapping, extraction, merge, evidence, deduplication, readiness, metrics, and output code.

> These numbers validate pipeline behaviour only.
> They do not measure real Nigerian provider coverage.

No real provider-quality or Nigerian coverage claim has been made.

Live mode requires `--live --confirm-live`, at least one configured provider, explicit owner approval, and bounded parameters. Before a live run the CLI prints:

- matrix query count;
- retry-inclusive maximum Geoapify calls;
- retry-inclusive maximum Tavily searches;
- maximum official websites;
- maximum HTML pages;
- conservative maximum provider credits including one retry.

Geoapify counts one Places request plus geocoding when coordinates are absent, with the complete operation doubled for one permitted retry. Tavily counts up to two searches per query, doubled for one retry. Website requests are not counted as provider credits. `--max-websites` is constrained to 1–50 and defaults to 20; each site remains capped at five HTML pages.

## CLI

Synthetic fixture evaluation:

```powershell
npm run sales-scout:research-eval
```

Bounded examples:

```powershell
npm run sales-scout:research-eval -- --city Ibadan --state Oyo --category Supermarket --max-queries 4 --max-websites 4
npm run sales-scout:research-eval -- --live --confirm-live --limit-per-query 5 --max-queries 12 --max-websites 20
```

Outputs are ignored files beneath `tmp/sales-scout-research/<run-id>/`: `candidates.json`, `candidates.csv`, and `summary.md`. Credentials and raw provider bodies are not written.

## Remaining gate

No real Geoapify, Tavily, or public-website request has run. The first bounded live evaluation still requires owner approval, credentials, explicit parameters, and acceptance of the printed cost ceiling. Production discovery, persistence, UI, CRM, qualification, orders, attribution, and outreach remain unchanged.

## Production interpretation after the first Lagos pilot

The bounded pilot produced six real Geoapify seeds and six unsuitable broad Tavily documents. Those figures demonstrate that structured seeds were useful and broad document search was not a safe prospect source; they do not measure nationwide coverage. Batch 6B removes broad Tavily documents from prospect generation. Tavily now runs at most two deterministic searches against each selected Geoapify seed and may only enrich that seed after exact-name/address/host association. Rejected documents contribute diagnostics only.

The earlier readiness gate hid provider-listed phone values because they were plausible, not independently verified. Production now exposes them as manual-review-ready with an explicit review warning while preserving a stricter outreach-ready tier for official-site or owner-verified contacts. This is an evidence classification change, not a claim that plausible contacts are verified. A live production evaluation remains pending migration, variables, deployment, and the owner runbook.

## Batch 6B production authorization boundary

Production Tavily enrichment is disabled by default. A key alone cannot activate it: the server also requires `SALES_SCOUT_TAVILY_ENRICHMENT_ENABLED=true`. The owner must not enable that flag without independently confirming applicable contractual permission in writing. The initial rollout uses Geoapify structured seeds and bounded research of likely official websites supplied by Geoapify.

Discovery-only Tavily documents may retain source-association diagnostics but cannot contribute phone or email contacts. Social results contribute only the associated profile. A likely-official Tavily homepage may supply plausible website evidence and becomes verified only after controlled official-site extraction. Provider-listed contact availability varies; Geoapify does not guarantee contact coverage.
