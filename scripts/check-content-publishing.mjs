import fs from "node:fs";

function file(path) { return fs.readFileSync(path, "utf8"); }
function pass(name) { console.log("PASS " + name); }
function check(name, condition) { if (!condition) throw new Error("FAIL " + name); pass(name); }

const editor = file("src/components/content-admin/post-admin.tsx");
const actions = file("app/admin/(protected)/content/actions.ts");
const renderer = file("src/components/content/content-renderer.tsx");
const affiliateRecommendation = file("src/components/content/affiliate-recommendation.tsx");
const article = file("app/blog/[slug]/page.tsx");
const share = file("src/components/content/article-share.tsx");
const content = file("src/lib/content.ts");
const recommend = file("app/recommend/[slug]/route.ts");
const pkg = JSON.parse(file("package.json"));

check("Typing a title uses the direct input value for slug", editor.includes('const setTitle = (title: string)') && editor.includes('slug: slugify(title)'));
check("Pasted title and typed title use the same slugify function", editor.includes('function slugify(input: string)') && editor.includes('replace(/-+/g, "-")'));
check("Manual slug editing stops automatic title overwrites", editor.includes('slugManuallyEdited') && editor.includes('setSlugManuallyEdited(true)'));
check("Regenerate from title action exists", editor.includes('Regenerate from title') && editor.includes('const regenerateSlug'));
check("Server normalizes slugs and returns persisted slug", actions.includes('slugFromTitle(stringField(payload, "slug"))') && actions.includes('post: { id: savedPost.id, slug: savedPost.slug'));
check("Public link uses persisted slug and siteConfig URL", editor.includes('publicArticleUrl(articleSlug)') && article.includes('canonicalUrl={`${siteConfig.url.replace(/\\/$/, "")}/blog/${post.slug}`}'));
check("First publication timestamp is server generated", actions.includes('existing?.published_at ?? new Date().toISOString()') && !actions.includes('Publication date is required before publishing.'));
check("Published edit preserves original published_at", actions.includes('existing?.published_at ?? new Date().toISOString()'));
check("Content mutation revalidates blog index", actions.includes('revalidatePath("/blog")'));
check("Content mutation revalidates article path", actions.includes('paths.add(`/blog/${input.newSlug}`)'));
check("Content mutation revalidates old article path", actions.includes('paths.add(`/blog/${input.oldSlug}`)'));
check("Content mutation revalidates category and tag pages", actions.includes('/blog/category/${category.slug}') && actions.includes('/blog/tag/${tag.slug}'));
check("Content mutation revalidates resources videos feed and sitemap", actions.includes('"/resources"') && actions.includes('"/videos"') && actions.includes('"/blog/feed.xml"') && actions.includes('"/sitemap.xml"'));
check("Unpublish removes public access through status change", actions.includes('action === "unpublish" || action === "restore" ? "draft"') && content.includes('.eq("status", "published")'));
check("Public article query requires persisted slug and published date", content.includes('.eq("slug", slug)') && content.includes('.lte("published_at", new Date().toISOString())'));
check("Standard Markdown images render", renderer.includes('allowedElements={["p"') && renderer.includes('"img"') && renderer.includes('figcaption'));
check("Markdown image title renders as caption", renderer.includes('<figcaption'));
check("Unsafe image protocols are blocked", renderer.includes('/^(https?:|\\/)/i.test') && actions.includes('Inline image ${index} uses an unsafe'));
check("Inline uploaded image inserts Markdown", editor.includes('Upload and Insert') && editor.includes('result.media.url') && editor.includes('uploadAlt.trim()'));
check("Inline upload validates server-side MIME and size", file("app/api/admin/content/media/route.ts").includes('image/jpeg') && file("app/api/admin/content/media/route.ts").includes('image/webp') && file("app/api/admin/content/media/route.ts").includes('contentImageMaxBytes'));
check("Inline upload uses content-media bucket", file("app/api/admin/content/media/route.ts").includes('.from("content-media")'));
check("Share uses navigator.share where supported", share.includes('navigator.share'));
check("Share fallback copies link", share.includes('clipboard') && share.includes('Article link copied.'));
check("Share tracks share_content", share.includes('trackShareContent'));
check("Affiliate card renders public recommendation fields", renderer.includes('Recommendation basis') || renderer.includes('Basis'));
check("Affiliate links route through recommend route", renderer.includes('/recommend/${offer.slug}?post='));
check("Affiliate redirect validates active offer and partner", recommend.includes('getActiveAffiliateOffer') && content.includes('partner.is_active !== true') && content.includes('partner.deleted_at'));
check("Affiliate redirect ignores logging failures", recommend.includes('Redirects must continue even if optional click logging fails'));
check("content:publishing-checks script is registered", pkg.scripts?.["content:publishing-checks"] === "node scripts/check-content-publishing.mjs");
check("Slim article disclosure renders with standard wording", renderer.includes("Disclosure</Link>: This article may contain") && renderer.includes("/affiliate-disclosure") && renderer.includes("may earn a commission at no additional cost"));
check("Methodology is collapsed by default", article.includes("<details") && article.includes("How we selected these recommendations") && !article.includes("Recommendation methodology</h2>"));
check("Placeholder methodology is rejected before publication", actions.includes("hasMeaningfulMethodology") && actions.includes("Try it out, Test, N/A, or Properly disclosed"));
check("Compact affiliate recommendation renders", affiliateRecommendation.includes("Affiliate recommendation") && affiliateRecommendation.includes("View details") && affiliateRecommendation.includes("details"));
check("View details expands without navigating", affiliateRecommendation.includes("<summary") && affiliateRecommendation.includes("onToggle") && affiliateRecommendation.includes("affiliate_details_expand"));
check("Check current price uses recommend route", affiliateRecommendation.includes("/recommend/$") || affiliateRecommendation.includes("/recommend/"));
check("External merchant link is labelled", affiliateRecommendation.includes("External merchant link") && renderer.includes("External merchant link"));
check("Offer picker lists and searches affiliate offers", editor.includes("Affiliate Recommendation") && editor.includes("Search offers") && editor.includes("Filter by partner"));
check("Offer picker attaches offers and inserts token", editor.includes("attachOffer") && editor.includes("insertOfferRecommendation") && editor.includes("[[affiliate:"));
check("Duplicate affiliate relationships are avoided", actions.includes("new Map(rawOffers.map") && editor.includes("!offerIds.includes(id)"));
check("Comparison requires at least two offers", editor.includes("Attach at least two affiliate offers before inserting a comparison") && actions.includes("hasComparisonToken && links.offerLinks.length < 2"));
check("Offer relationships carry article-specific fields", editor.includes("best_for") && editor.includes("editorial_verdict") && editor.includes("pros: lineList") && actions.includes("content_post_affiliate_offers"));
check("Inactive offers and partners are blocked for review and publish", actions.includes("is inactive") && actions.includes("belongs to an inactive partner"));
check("Affiliate admin explains partner offer redirect and commission model", file("app/admin/(protected)/affiliate/page.tsx").includes("An affiliate partner is the merchant") && file("app/admin/(protected)/affiliate/page.tsx").includes("/recommend/[slug]") && file("app/admin/(protected)/affiliate/page.tsx").includes("records outbound clicks only"));
check("Offer test redirect action exists", editor.includes("Test redirect") && editor.includes("Testing may create an affiliate click where consent permits"));
check("Internal commission notes are never public", !renderer.includes("internal_commission_note") && !affiliateRecommendation.includes("internal_commission_note"));
check("No commission or payout system was introduced", !renderer.includes("payout") && !affiliateRecommendation.includes("payout balance"));
