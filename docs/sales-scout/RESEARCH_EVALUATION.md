# Sales Scout research evaluation

## Purpose and nationwide scope

Batch 6A evaluates research quality before any provider is connected to production persistence. The matrix begins with Lagos, Ibadan, Abuja, Port Harcourt, Enugu, Kano, and Gombe, but accepts any Nigerian state, FCT territory, city, and supported research category. Results are evaluation artifacts, not CRM prospects.

## Source responsibilities

- Geoapify resolves Nigerian territories and discovers conservatively mapped place categories. Provider attribution and stable place identity are retained.
- Tavily basic search finds possible official websites and public business profiles. Search snippets are discovery evidence, never verified contact evidence.
- Tavily Extract is limited to selected public URLs in batches of five.
- The official-website researcher verifies public contacts and social profiles on plausible official sites, obeying robots rules, redirect/DNS/SSRF protections, same-origin traversal, pacing, and strict page/byte/time limits.
- Manual public sources remain valid evidence when their URL and observation time are recorded.

DataForSEO remains present and disabled; this harness neither calls nor changes it.

## Free-tier conservation

Fixture mode is the default and makes no network request. Live mode requires both `--live` and `--confirm-live`, at least one configured provider, a maximum query count, and a per-query limit. Defaults are five results per query and twelve live queries. Providers run sequentially with at most one retry for safe transient failures.

## Evidence, attribution, and safety

Missing values are never invented. Each stored contact must carry its public evidence URL, observation time, source, confidence, and verification status. Conflicts retain both evidence records and create a research issue. Website research rejects credentials, local/private/reserved destinations, unsafe redirects, non-HTML content, oversized pages, login/private paths, and disallowed robots paths. It executes no JavaScript, browser automation, CAPTCHA bypass, or private-content access.

## CLI

Fixture evaluation:

```powershell
npm run sales-scout:research-eval
```

Bounded examples:

```powershell
npm run sales-scout:research-eval -- --city Ibadan --state Oyo --category Supermarket --max-queries 4
npm run sales-scout:research-eval -- --live --confirm-live --limit-per-query 5 --max-queries 12
```

Other options: `--matrix`, `--output-dir`, `--city`, `--state`, and `--category`. Outputs are written beneath `tmp/sales-scout-research/<run-id>/`: `candidates.json`, `candidates.csv`, and `summary.md`. They contain no credentials or raw provider responses and are ignored by Git.

## Pilot success targets

For an initial sample of at least 20 unique businesses, the evaluation targets—not guarantees—are:

- at least 75% relevant to the requested category and territory;
- at least 60% with one usable public contact;
- at least 50% with an official website or verified public social profile;
- 100% of stored contacts backed by source evidence;
- zero fabricated fields;
- zero unintended production writes.

## Why production is unchanged

Provider economics, regional/category coverage, official-contact verification rates, false positives, attribution obligations, and operational review effort must be measured first. Only reviewed evaluation evidence may inform a later production design; Batch 6A performs no migration, Supabase write, CRM capture, outreach, or provider activation.
