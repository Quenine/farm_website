import fs from "node:fs";

function file(path) { return fs.readFileSync(path, "utf8"); }
function pass(name) { console.log("PASS " + name); }
function check(name, condition) { if (!condition) throw new Error("FAIL " + name); pass(name); }

const editor = file("src/components/content-admin/post-admin.tsx");
const actions = file("app/admin/(protected)/content/actions.ts");
const renderer = file("src/components/content/content-renderer.tsx");
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
check("Unpublish removes public access through status change", actions.includes('action === "unpublish" ? "draft"') && content.includes('.eq("status", "published")'));
check("Public article query requires persisted slug and published date", content.includes('.eq("slug", slug)') && content.includes('.lte("published_at", new Date().toISOString())'));
check("Standard Markdown images render", renderer.includes('allowedElements={["p"') && renderer.includes('"img"') && renderer.includes('figcaption'));
check("Markdown image title renders as caption", renderer.includes('<figcaption'));
check("Unsafe image protocols are blocked", renderer.includes('/^(https?:|\\/)/i.test') && actions.includes('Inline image ${index} uses an unsafe'));
check("Inline uploaded image inserts Markdown", editor.includes('Upload and Insert') && editor.includes('![${uploadAlt.trim()}]'));
check("Inline upload validates server-side MIME and size", actions.includes('image/jpeg') && actions.includes('image/webp') && actions.includes('contentImageMaxBytes'));
check("Inline upload uses content-media bucket", actions.includes('.from("content-media")'));
check("Share uses navigator.share where supported", share.includes('navigator.share'));
check("Share fallback copies link", share.includes('clipboard') && share.includes('Article link copied.'));
check("Share tracks share_content", share.includes('trackShareContent'));
check("Affiliate card renders public recommendation fields", renderer.includes('Recommendation basis') || renderer.includes('Basis'));
check("Affiliate links route through recommend route", renderer.includes('/recommend/${offer.slug}?post='));
check("Affiliate redirect validates active offer and partner", recommend.includes('getActiveAffiliateOffer') && content.includes('partner.is_active === false'));
check("Affiliate redirect ignores logging failures", recommend.includes('Redirects must continue even if optional click logging fails'));
check("content:publishing-checks script is registered", pkg.scripts?.["content:publishing-checks"] === "node scripts/check-content-publishing.mjs");