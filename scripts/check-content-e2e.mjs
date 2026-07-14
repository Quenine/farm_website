import fs from "node:fs";

function file(path) { return fs.readFileSync(path, "utf8"); }
function pass(name) { console.log("PASS " + name); }
function skipped(name) { console.log("SKIPPED " + name); }
function check(name, condition) { if (!condition) throw new Error("FAIL " + name); pass(name); }

const editor = file("src/components/content-admin/post-admin.tsx");
const renderer = file("src/components/content/content-renderer.tsx");
const recommendation = file("src/components/content/affiliate-recommendation.tsx");
const actions = file("app/admin/(protected)/content/actions.ts");
const mediaRoute = file("app/api/admin/content/media/route.ts");
const crud = file("src/components/content-admin/crud-manager.tsx");
const diagnostics = file("src/lib/content-admin-diagnostics.ts");
const migration = file("database/step-content-trash-and-deletion.sql");
const definitions = (await import('../src/lib/content-admin-entities.mjs')).adminEntityDefinitions;

check("Add Affiliate Offer opens a visible picker", editor.includes("setOfferPickerOpen(true)") && editor.includes("Search offers") && editor.includes("Filter by partner"));
check("Affiliate picker focuses search", editor.includes("affiliate_offer_search") && editor.includes("focusSearch"));
check("Affiliate picker lists offer state and partner", editor.includes("recommendation_basis") && editor.includes("available_regions") && editor.includes("attached"));
check("Affiliate picker attaches and inserts without manual slug typing", editor.includes("attachOffer") && editor.includes("insertOfferRecommendation") && editor.includes("[[affiliate:"));
check("Duplicate affiliate relationship is prevented", editor.includes("!offerIds.includes(id)"));
check("Affiliate comparison requires two attached offers", editor.includes("Attach at least two affiliate offers before inserting a comparison") && actions.includes("hasComparisonToken && links.offerLinks.length < 2"));
check("Toolbar controls explicitly use button type", !/<button(?![^>]*type=)[^>]*onClick=/.test(editor));
check("Image chooser input is permanently mounted", editor.includes('id="article-inline-image-input"') && editor.includes('ref={imageInputRef}') && editor.includes('className="sr-only"'));
check("Toolbar opens chooser directly", editor.includes('onClick={openImageChooser}') && editor.includes('input.click()'));
check("Native labels target the chooser", editor.includes('htmlFor="article-inline-image-input"') && editor.includes('Choose an image to insert into the article'));
check("Image selection validates and previews immediately", editor.includes('handleImageSelected') && editor.includes('URL.createObjectURL(file)') && editor.includes('uploadPreviewUrl'));
check("Image preview URLs are revoked", editor.includes('URL.revokeObjectURL(uploadPreviewUrl)'));
check("Image panel shows file metadata and explicit controls", editor.includes('Filename:') && editor.includes('File type:') && editor.includes('File size:') && editor.includes('Change image') && editor.includes('Upload and Insert'));
check("Upload uses protected multipart endpoint", editor.includes('fetch("/api/admin/content/media"') && editor.includes('formData.append("image", uploadFile)'));
check("Upload endpoint authenticates admin", mediaRoute.includes('ensureContentAdmin("posts")'));
check("Upload endpoint validates MIME and size", mediaRoute.includes('image/jpeg') && mediaRoute.includes('image/webp') && mediaRoute.includes('contentImageMaxBytes'));
check("Upload endpoint returns serializable media shape", mediaRoute.includes('ok: true') && mediaRoute.includes('media: { url') && mediaRoute.includes('mimeType'));
check("Markdown image insertion is well formed", editor.includes('result.media.url') && editor.includes('uploadAlt.trim()') && editor.includes('caption ?') && editor.includes('`!['));
check("Public Markdown images are allowed and sanitized", renderer.includes('"img"') && renderer.includes('/^(https?:|\\/)/i.test') && renderer.includes('<figcaption'));
check("Compact disclosure renders", renderer.includes('Disclosure</Link>: This article may contain') && renderer.includes('/affiliate-disclosure'));
check("Recommendation details expand separately from CTA", recommendation.includes('<details') && recommendation.includes('View details') && recommendation.includes('Check current price'));
check("Check Current Price routes through recommend", recommendation.includes('/recommend/'));
check("Trash schema migration exists", migration.includes('deleted_at') && migration.includes('content_posts') && migration.includes('affiliate_offers'));
check("CRUD manager has trash restore permanent delete UI", crud.includes('Move to Trash') && crud.includes('Restore') && crud.includes('Permanently Delete'));
check("Permanent delete requires typed confirmation", crud.includes('Type DELETE') && actions.includes('confirmation !== "DELETE"'));
check("Used offer hard delete is blocked", actions.includes('article usage or click history') && actions.includes('affiliate_clicks'));
check("Published post trash is blocked", actions.includes('Published posts must be unpublished before they can be moved to Trash'));
check("Content diagnostics include storage and truthful trash checks", diagnostics.includes('content-media bucket available') && diagnostics.includes('trash columns') && diagnostics.includes('Configured, not runtime-tested.'));
check("Production loader table names contain no select syntax", Object.values(definitions).every((definition) => !definition.table.includes(',') && !/[()]/.test(definition.table)));
check("Every trash entity selects deletion columns", Object.values(definitions).filter((definition) => definition.trash).every((definition) => definition.select.split(',').includes('deleted_at') && definition.select.split(',').includes('deleted_by')));

const baseUrl = process.env.CONTENT_E2E_BASE_URL;
if (baseUrl) {
  const url = baseUrl.replace(/\/$/, "");
  const res = await fetch(url + "/affiliate-disclosure");
  check("Browser-level public affiliate disclosure page responds", res.ok);
  const robots = await fetch(url + "/robots.txt");
  check("Browser-level robots route responds", robots.ok);
} else {
  skipped("Browser-level route fetch; set CONTENT_E2E_BASE_URL to test a running authenticated environment");
}
