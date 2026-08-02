# Sales Scout research evaluation

## Purpose and scope

Batch 6A is an offline-first evaluation harness for Nigerian B2B prospect research. Its foundation existed at commit `fef8711`; Batch 6A-H1 corrects evidence inflation, retry classification, duplicate enrichment, and website-destination safety before any live request. Evaluation artifacts are not CRM prospects and the harness does not write to production.

The committed matrix covers Lagos, Ibadan, Abuja, Port Harcourt, Enugu, Kano, and Gombe across Restaurant, Hotel, Supermarket, and Caterer queries. Other Nigerian territories and supported research categories can be supplied through a matrix file.

## Source boundaries

- Geoapify may supply structured place identity, categories, location, contact, and an explicit website field. Territory geocoding requires a defensible Nigerian city/state match.
- Tavily results are discovery sources. Query territory remains requested context, not candidate geography. Social results are plausible profiles; directories, articles, maps, marketplaces, reviews, news, and aggregators are not official websites.
- A Tavily URL is eligible for website research only when deterministic business-name/domain evidence marks a homepage as likely official.
- Official-site extraction can verify public contacts and social links. It obeys robots rules, validates DNS before every destination and redirect, restricts traversal to the final validated origin, and enforces page, byte, timeout, redirect, pacing, and execution caps.
- DataForSEO remains present, disabled, and unchanged.

## Evidence and metrics

Quality is candidate-local. A contact counts only when the same candidate has matching verified evidence. Official website and social metrics likewise require matching verified evidence. Research relevance requires verified category, Nigerian country, state, city, and a public source URL. Tavily query assumptions do not satisfy these rules.

Fixture mode uses committed synthetic Geoapify, Tavily, and HTML fixtures through the real mappers, extractor, evidence rules, deduplication, metrics, and output writers. Its report states:

> These numbers validate pipeline behaviour only.
> They do not measure real Nigerian provider coverage.

No real provider-quality or Nigerian coverage claim has been made.

## Cost and safety controls

Fixture mode is the default and makes no network request. Live mode requires `--live --confirm-live`, at least one configured provider, and owner approval. Before a live run the CLI prints the matrix query count, conservative Geoapify and Tavily call maxima, website cap, and estimated provider-credit ceiling.

Discovery is completed and deduplicated before website research. Each unique eligible hostname is researched at most once, with `--max-websites` constrained to 1–50 and defaulting to 20. One retry is allowed only for timeout, network failure, rate limiting, or server failure; bad request, unauthorized, forbidden, unsupported-category, invalid-configuration, and invalid-JSON failures are not retried.

Website validation rejects credentials, local/private/reserved IPv4 and IPv6 destinations, bracketed or mapped loopback/private IPv6, unsafe redirects, non-HTML content, oversized responses, private/login paths, and disallowed robots paths. It performs no browser automation, JavaScript execution, private-content access, credential automation, CAPTCHA bypass, messaging, or outreach.

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

Other options are `--matrix`, `--output-dir`, `--city`, `--state`, and `--category`. Outputs are ignored files beneath `tmp/sales-scout-research/<run-id>/`: `candidates.json`, `candidates.csv`, and `summary.md`. Credentials and raw provider bodies are not written.

## Remaining gate

A live evaluation still requires owner approval, provider credentials, explicit bounded parameters, and review of the printed cost ceiling. Production discovery, persistence, UI, CRM capture, qualification, and outreach remain unchanged.
