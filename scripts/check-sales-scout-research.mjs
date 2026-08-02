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
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

for (const file of evaluatedFiles) {
  const text = fs.readFileSync(file, "utf8");
  if (text.includes('"use client"') || text.includes("'use client'")) {
    assert.doesNotMatch(text, /GEOAPIFY_API_KEY|TAVILY_API_KEY/);
  }
}
assert.doesNotMatch(source, /console\.(?:log|error|warn)\([^\n]*(?:GEOAPIFY_API_KEY|TAVILY_API_KEY)/);
assert.doesNotMatch(source, /writeFile[^\n]*(?:raw_content|rawResponse|providerBody)/i);
assert.doesNotMatch(source, /supabase|createAdminSupabaseClient|\.from\(["']marketing_/i);
assert.match(source, /--live/);
assert.match(source, /--confirm-live/);
assert.match(source, /RESEARCH_LIVE_REQUIRES_EXPLICIT_CONFIRMATION/);
assert.match(source, /isPrivateOrReservedIp/);
assert.match(source, /WEBSITE_DESTINATION_PRIVATE/);
assert.match(source, /MAX_PAGES\s*=\s*5/);
assert.match(source, /MAX_REDIRECTS\s*=\s*2/);
assert.match(source, /MAX_BYTES\s*=\s*2\s*\*\s*1024\s*\*\s*1024/);
assert.match(source, /MAX_SEARCH_RESULTS\s*=\s*20/);
assert.match(source, /MAX_EXTRACT_URLS\s*=\s*5/);
assert.match(source, /maxQueries:live\?12:50/);
assert.ok(fs.readFileSync(".gitignore", "utf8").includes("tmp/sales-scout-research/"));
assert.ok(fs.existsSync("scripts/fixtures/sales-scout-research/nationwide-matrix.json"));
assert.ok(fs.readFileSync("tests/sales-scout-research.test.ts", "utf8").includes("fixture-mode CLI"));
for (const dependency of ["puppeteer", "selenium-webdriver", "playwright"]) {
  assert.equal(packageJson.dependencies?.[dependency], undefined);
}
const protectedHashes = {
  "src/lib/sales-scout/discovery/dataforseo.ts": "21324900D1F804F0D865D485577F2BB193E8FF19C5813ECA610A26A7211630CF",
  "src/lib/sales-scout/discovery/dataforseo-parser.ts": "1C64CA1CD028E7061306B75A2D3F900903EDAA640B4DB45A2CF3806490535939",
};
for (const [file, expectedHash] of Object.entries(protectedHashes)) {
  const actualHash = createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
  assert.equal(actualHash, expectedHash);
}
console.log("Sales Scout research static audit passed.");
