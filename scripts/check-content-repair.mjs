import fs from 'node:fs';
const checks = [];
function file(path) { return fs.readFileSync(path, 'utf8'); }
function check(name, ok) { checks.push({ name, ok }); if (!ok) process.exitCode = 1; }
const features = file('src/lib/content-features.ts');
check('feature parser accepts true/1 only', features.includes('normalized === "true" || normalized === "1"') && !features.includes('Boolean(process.env'));
const nav = file('src/components/admin-nav-links.tsx');
check('admin nav includes Content and Affiliate from feature props', nav.includes('features.contentHubEnabled') && nav.includes('features.affiliateContentEnabled'));
const ui = file('src/components/ui.tsx');
const headerBlock = ui.slice(ui.indexOf('export function PublicHeader'), ui.indexOf('export function Footer'));
check('public menu has requested primary links', ['Shop','Business Supply','Blog','About','Contact','Track Order'].every((label) => headerBlock.includes(label)));
check('public primary menu omits Resources Videos Tools', !headerBlock.includes('Resources') && !headerBlock.includes('Videos') && !headerBlock.includes('Tools'));
check('zero authors wording present', file('app/admin/(protected)/content/authors/page.tsx').includes('No authors have been created yet.'));
check('zero affiliate partners wording present', file('app/admin/(protected)/affiliate/partners/page.tsx').includes('No affiliate partners have been added yet.'));
check('zero affiliate offer partner guidance present', file('app/admin/(protected)/affiliate/offers/page.tsx').includes('Create an affiliate partner before adding an offer.'));
check('client components do not import content admin service client', !Array.from(fs.readdirSync('src/components', { recursive: true })).filter((name) => String(name).endsWith('.tsx') || String(name).endsWith('.ts')).some((name) => file('src/components/' + name).startsWith('"use client"') && file('src/components/' + name).includes('content-admin-server')));
for (const result of checks) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}`);
