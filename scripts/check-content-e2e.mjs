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
const blogPage = file("app/blog/page.tsx");
const blogCardImage = file("src/components/content/blog-card-image.tsx");
const contentAdmin = file("src/lib/content-admin.ts");
const trashPage = file("app/admin/(protected)/content/trash/page.tsx");
const contactAction = file("app/contact/actions.ts");
const contactForm = file("app/contact/contact-form.tsx");
const emailConfig = file("src/lib/email-config.ts");
const notifications = file("src/lib/notifications.ts");
const adminDiagnostics = file("app/admin/(protected)/diagnostics/page.tsx");
const diagnosticsActions = file("app/admin/(protected)/diagnostics/actions.ts");
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
check("Blog cards render featured image fields", blogPage.includes("post.featured_image_url") && blogPage.includes("post.featured_image_alt"));
check("Blog cards navigate through one stretched article link", blogPage.includes('href={`/blog/${post.slug}`}') && blogPage.includes("absolute inset-0 z-10") && blogPage.includes("aria-label={`Read ${post.title}`}"));
check("Blog taxonomy links remain independent", blogPage.includes("relative z-20") && blogPage.includes("/blog/category/") && blogPage.includes("/blog/tag/"));
check("Missing or failed Blog images render branded fallback", blogCardImage.includes("data-blog-image-fallback") && blogCardImage.includes("onError={() => setFailed(true)}"));
check("Featured Blog posts are removed from regular grid", blogPage.includes("featuredIds") && blogPage.includes("!featuredIds.has(post.id)"));
check("Blog pagination preserves active filters", ["q", "category", "tag", "format", "audience"].every((key) => blogPage.includes(`query.set("${key}"`)) && blogPage.includes("pageHref(data.page"));
check("Blog image URLs reject unsafe protocols", blogCardImage.includes('url.protocol === "https:"') && blogCardImage.includes('source.startsWith("/")') && !blogCardImage.includes('protocol === "data:"'));
check("Blog card grid remains responsive", blogPage.includes("grid-cols-1") && blogPage.includes("md:grid-cols-2") && blogPage.includes("lg:grid-cols-3"));
check("Content overview excludes Trash and counts it separately", contentAdmin.includes('.is("deleted_at", null)') && contentAdmin.includes("trashedPosts.count"));
check("Affiliate overview excludes trashed inventory", contentAdmin.includes('affiliate_partners").select("id,is_active").is("deleted_at", null)') && contentAdmin.includes("trashedPartners.count") && contentAdmin.includes("trashedOffers.count"));
check("Central Trash page reads soft-deleted records server-side", trashPage.includes('trash: "trash"') && trashPage.includes("loadTrashDependencies") && trashPage.includes("Search Trash"));
check("Post restore returns to draft without republishing", actions.includes('if (entity === "posts") updates.status = "draft"') && actions.includes("was not republished"));
check("Permanent post deletion requires DELETE and blocks history", actions.includes('confirmation !== "DELETE"') && actions.includes("Historical attribution must be retained") && actions.includes("affiliate_clicks") && actions.includes("content_product_clicks"));
check("Category deletion reports dependency and reassignment", actions.includes("reassign them first") && actions.includes('categories: ["content_posts", "category_id"'));
check("Contact form validates and preserves fields", contactAction.includes("schema.safeParse") && contactForm.includes("state.values") && contactForm.includes("fieldErrors"));
check("Contact honeypot is rejected", contactAction.includes('website: z.string().max(0)') && contactForm.includes('name="website"'));
check("Contact routes notification privately and acknowledges publicly", contactAction.includes("emailConfig.contactInboxEmail") && contactAction.includes("emailConfig.fromSupport") && contactAction.includes("replyTo: parsed.data.email") && contactAction.includes("replyTo: emailConfig.replyToSupport"));
check("Private inbox configuration remains server-only", emailConfig.includes('import "server-only"') && !contactForm.includes("CONTACT_INBOX_EMAIL") && !contactForm.includes("ADMIN_NOTIFICATION_EMAIL"));
check("Resend sends provider reply_to", notifications.includes("reply_to: replyTo"));
check("Admin test email is protected", diagnosticsActions.includes("await requireAdmin()") && diagnosticsActions.includes("sendDiagnosticEmailAction"));
check("Email diagnostics expose configuration states, not recipients", adminDiagnostics.includes("Contact inbox configured") && adminDiagnostics.includes("Configured, not runtime-tested") && !adminDiagnostics.includes("contactInboxEmail"));

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
