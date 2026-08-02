import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const researchFiles = fs.readdirSync("src/lib/sales-scout/research", { recursive: true })
  .filter((file) => typeof file === "string" && file.endsWith(".ts"))
  .map((file) => `src/lib/sales-scout/research/${file.replaceAll("\\", "/")}`);
const evaluatedFiles = [
  ...researchFiles,
  "scripts/sales-scout-research-eval.ts",
  "tests/sales-scout-research.test.ts",
];
const source = evaluatedFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const tavilySource = fs.readFileSync(
  "src/lib/sales-scout/research/tavily.ts",
  "utf8",
);
const qualitySource = fs.readFileSync(
  "src/lib/sales-scout/research/quality.ts",
  "utf8",
);
const websiteSource = fs.readFileSync(
  "src/lib/sales-scout/research/website.ts",
  "utf8",
);
const evaluationSource = fs.readFileSync(
  "src/lib/sales-scout/research/evaluation.ts",
  "utf8",
);
const cliSource = fs.readFileSync("scripts/sales-scout-research-eval.ts", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

for (const file of evaluatedFiles) {
  const text = fs.readFileSync(file, "utf8");
  if (text.includes('"use client"') || text.includes("'use client'")) {
    assert.doesNotMatch(text, /GEOAPIFY_API_KEY|TAVILY_API_KEY/);
  }
}
assert.doesNotMatch(
  source,
  /console\.(?:log|error|warn)\([^\n]*(?:GEOAPIFY_API_KEY|TAVILY_API_KEY)/,
);
assert.doesNotMatch(source, /writeFile[^\n]*(?:raw_content|rawResponse|providerBody)/i);
assert.doesNotMatch(source, /supabase|createAdminSupabaseClient|\.from\(["']marketing_/i);

assert.match(source, /--live/);
assert.match(source, /--confirm-live/);
assert.match(source, /RESEARCH_LIVE_REQUIRES_EXPLICIT_CONFIRMATION/);
assert.match(cliSource, /--max-websites/);
assert.match(cliSource, /maxWebsites:\s*20/);
assert.match(cliSource, /boundedInteger\([^\n]*name,\s*1,\s*50\)/);
assert.match(cliSource, /Maximum official websites:/);
assert.match(cliSource, /Maximum HTML pages:/);
assert.match(cliSource, /Conservative maximum provider credits including one retry:/);

assert.doesNotMatch(tavilySource, /country:\s*query\.territory\.country/);
assert.doesNotMatch(tavilySource, /state:\s*query\.territory\.state/);
assert.doesNotMatch(tavilySource, /city:\s*query\.territory\.city/);
assert.match(tavilySource, /requestedTerritory:\s*\{\s*\.\.\.query\.territory\s*\}/);
assert.match(tavilySource, /classifyTavilyResultUrl/);
assert.match(tavilySource, /Search result URL is discovery evidence/);

const officialWebsiteFunction = qualitySource.match(
  /export function hasOfficialWebsite[\s\S]*?\n\}/,
)?.[0] ?? "";
assert.match(officialWebsiteFunction, /verificationStatus\s*===\s*"verified"/);
assert.match(officialWebsiteFunction, /field\s*===\s*"website"/);
assert.match(qualitySource, /hasEvidenceBackedPhone/);
assert.match(qualitySource, /hasEvidenceBackedEmail/);
assert.match(qualitySource, /hasEvidenceBackedWhatsApp/);
const outreachReadyFunction = qualitySource.match(
  /export function isOutreachReady[\s\S]*?\n\}/,
)?.[0] ?? "";
assert.match(outreachReadyFunction, /isResearchReady\(candidate\)/);
assert.match(outreachReadyFunction, /hasAnyUsableContact\(candidate\)/);

const safeFetchFunction = websiteSource.match(
  /async function safeFetch[\s\S]*?\n\}/,
)?.[0] ?? "";
assert.ok(
  safeFetchFunction.indexOf("await assertRobotsAllowed(url, robotsCache)") >= 0 &&
  safeFetchFunction.indexOf("await assertRobotsAllowed(url, robotsCache)") <
    safeFetchFunction.indexOf("await fetchResponse"),
);
assert.match(websiteSource, /const robotsCache: RobotsCache = new Map\(\)/);
assert.match(websiteSource, /loadRobotsForOrigin\(url\.origin, robotsCache\)/);
assert.match(websiteSource, /await assertRobotsAllowed\(target, robotsCache\)/);
assert.match(websiteSource, /WEBSITE_ROBOTS_DISALLOWED/);
assert.match(websiteSource, /WEBSITE_ROBOTS_UNAVAILABLE/);
assert.match(websiteSource, /schemaTypes: string\[\]/);
assert.match(websiteSource, /field === "schemaType"/);
assert.match(websiteSource, /Restaurant: new Set\(\["Restaurant"\]\)/);
assert.match(websiteSource, /Hotel: new Set\(\["Hotel", "LodgingBusiness"\]\)/);
assert.match(websiteSource, /Supermarket: new Set\(\["GroceryStore"\]\)/);
assert.match(websiteSource, /Caterer: new Set\(\["Caterer", "CateringBusiness"\]\)/);
assert.match(websiteSource, /School: new Set\(\["School"\]\)/);
assert.match(websiteSource, /Hospital: new Set\(\["Hospital"\]\)/);
assert.match(websiteSource, /facts\.schemaTypes\.some/);
assert.match(websiteSource, /"requestedCategory"/);
assert.doesNotMatch(
  websiteSource.match(/const CATEGORY_SCHEMA_TYPES[\s\S]*?\n\};/)?.[0] ?? "",
  /Food Vendor|Food Processor|Distributor|Institution/,
);

const preliminaryIndex = cliSource.indexOf(
  "const preliminary = deduplicateCandidates(rawCandidates)",
);
const enrichmentIndex = cliSource.indexOf(
  "await enrichLiveCandidates(preliminary.candidates",
);
assert.ok(preliminaryIndex >= 0 && enrichmentIndex > preliminaryIndex);
assert.match(cliSource, /buildWebsiteResearchPlan\(enriched, maxWebsites\)/);
assert.match(cliSource, /isRetryableProviderReference\(error\.reference\)/);
assert.doesNotMatch(cliSource, /\(TIMEOUT\|REQUEST_FAILED\)/);
assert.doesNotMatch(cliSource, /function\s+fixtureCandidate\s*\(/);
assert.match(cliSource, /mapGeoapifyPlacesResponse\(/);
assert.match(cliSource, /mapTavilySearchResponse\(/);
assert.match(cliSource, /extractWebsiteFacts\(/);
assert.match(cliSource, /deduplicateCandidates\(rawCandidates\)/);

assert.match(evaluationSource, /Mode:.*synthetic fixture/);
assert.match(evaluationSource, /These numbers validate pipeline behaviour only/);
assert.match(evaluationSource, /They do not measure real Nigerian provider coverage/);
assert.match(evaluationSource, /candidate\.evidence\.some/);

assert.match(websiteSource, /normalizeIpLiteral/);
assert.match(websiteSource, /::ffff:/);
assert.match(websiteSource, /shieldsfarms\.store\/contact/);
assert.match(websiteSource, /finalOrigin/);
assert.match(websiteSource, /buildWebsiteResearchPlan/);
assert.match(websiteSource, /mergeWebsiteFactsIntoCandidate/);
assert.match(source, /isPrivateOrReservedIp/);
assert.match(source, /WEBSITE_DESTINATION_PRIVATE/);
assert.match(source, /MAX_PAGES\s*=\s*5/);
assert.match(source, /MAX_REDIRECTS\s*=\s*2/);
assert.match(source, /MAX_BYTES\s*=\s*2\s*\*\s*1024\s*\*\s*1024/);
assert.match(source, /MAX_SEARCH_RESULTS\s*=\s*20/);
assert.match(source, /MAX_EXTRACT_URLS\s*=\s*5/);
assert.match(source, /maxQueries:\s*live\s*\?\s*12\s*:\s*50/);
assert.match(cliSource, /completeOperationMaximum \* 2/);
assert.match(cliSource, /queries\.length \* 2 \* 2/);
assert.match(cliSource, /maximumHtmlPages: maxWebsites \* 5/);
assert.match(cliSource, /conservativeMaximumProviderCreditsIncludingOneRetry/);

assert.ok(fs.readFileSync(".gitignore", "utf8").includes("tmp/sales-scout-research/"));
assert.ok(fs.existsSync(
  "scripts/fixtures/sales-scout-research/nationwide-matrix.json",
));
assert.ok(fs.readFileSync(
  "tests/sales-scout-research.test.ts",
  "utf8",
).includes("fixture-mode CLI"));
for (const dependency of ["puppeteer", "selenium-webdriver", "playwright"]) {
  assert.equal(packageJson.dependencies?.[dependency], undefined);
}

const protectedHashes = {
  "src/lib/sales-scout/discovery/dataforseo.ts":
    "21324900D1F804F0D865D485577F2BB193E8FF19C5813ECA610A26A7211630CF",
  "src/lib/sales-scout/discovery/dataforseo-parser.ts":
    "1C64CA1CD028E7061306B75A2D3F900903EDAA640B4DB45A2CF3806490535939",
};
for (const [file, expectedHash] of Object.entries(protectedHashes)) {
  const actualHash = createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")
    .toUpperCase();
  assert.equal(actualHash, expectedHash);
}
console.log("Sales Scout research static audit passed.");
