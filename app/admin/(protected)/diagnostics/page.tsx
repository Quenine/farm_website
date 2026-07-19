import { connection } from "next/server";
import { AdminHeader } from "@/src/components/admin";
import { marketingConfig, operationalFeatures, siteConfig } from "@/src/config/site";
import { getPaystackEnvironmentDiagnostics } from "@/src/lib/paystack";
import { validateConfiguredSiteUrl } from "@/src/lib/site-url";
import { PaystackTestButton } from "./paystack-test-button";
import { EmailTestButton } from "./email-test-button";
import { emailDiagnostics } from "@/src/lib/email-config";
import { contentConfig } from "@/src/lib/content-config";
import { getContentIndexingReadiness } from "@/src/lib/content-indexing";
import { googleIntegration } from "@/src/lib/analytics";

function configurationStatus(value: string | undefined) {
  return value?.trim() ? "Configured" : "Missing";
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function notificationsAreEnabled() {
  return process.env.NOTIFICATIONS_ENABLED?.trim().toLowerCase() === "true";
}

function gmailConfigured() {
  const host = process.env.GMAIL_SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.GMAIL_SMTP_PORT?.trim() || 465);
  return Boolean(
    host &&
      Number.isInteger(port) &&
      port > 0 &&
      process.env.GMAIL_USER?.trim() &&
      process.env.GMAIL_APP_PASSWORD?.trim() &&
      process.env.FROM_EMAIL?.trim(),
  );
}

function emailProviderConfigured() {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (provider === "gmail") return gmailConfigured();
  if (provider === "resend") {
    return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.FROM_EMAIL?.trim());
  }
  if (provider === "brevo") {
    return Boolean(process.env.BREVO_API_KEY?.trim() && (process.env.EMAIL_FROM_GENERAL?.trim() || process.env.FROM_EMAIL?.trim()));
  }
  return false;
}

function providerLabel(provider: string) {
  if (provider === "brevo") return "Brevo";
  if (provider === "resend") return "Resend";
  if (provider === "gmail") return "Gmail";
  return "Missing";
}

function selectedWhatsAppProvider() {
  return process.env.WHATSAPP_PROVIDER?.trim() || "Not selected";
}

function whatsAppProviderConfigured() {
  const provider = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (provider === "cloud") {
    return Boolean(
      process.env.WHATSAPP_CLOUD_API_TOKEN?.trim() &&
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
    );
  }
  if (provider === "webhook") return Boolean(process.env.WHATSAPP_WEBHOOK_URL?.trim());
  if (provider === "callmebot") return Boolean(process.env.CALLMEBOT_API_KEY?.trim());
  return false;
}

function customerWhatsAppStatusNotificationsPossible() {
  const provider = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (!notificationsAreEnabled()) return false;
  if (provider === "cloud") {
    return Boolean(
      process.env.WHATSAPP_CLOUD_API_TOKEN?.trim() &&
        process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
        process.env.WHATSAPP_CUSTOMER_STATUS_TEMPLATE_NAME?.trim(),
    );
  }
  if (provider === "webhook") return Boolean(process.env.WHATSAPP_WEBHOOK_URL?.trim());
  return false;
}

export default async function AdminDiagnosticsPage() {
  await connection();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const siteUrlValidation = validateConfiguredSiteUrl();
  const paystackDiagnostics = getPaystackEnvironmentDiagnostics();
  const email = emailDiagnostics();
  const indexing = await getContentIndexingReadiness();
  const google = googleIntegration();
  const callbackUrl = siteUrlValidation.valid
    ? `${siteUrlValidation.siteUrl}/payment/callback`
    : `Unavailable: ${siteUrlValidation.reason}`;

  const diagnostics = [
    { label: "Google integration type", value: google.type, isSecret: false },
    { label: "Google detected prefix", value: "prefix" in google ? google.prefix : "None or invalid", isSecret: false },
    { label: "Google public ID configured", value: google.id ? "Configured, not externally verified" : "Missing", isSecret: false },
    { label: "Marketing runtime enabled", value: yesNo(marketingConfig.enabled), isSecret: false },
    { label: "Google initial and client pageviews", value: "Consent-gated; once per public route", isSecret: false },
    { label: "Analytics admin exclusion", value: "Active", isSecret: false },
    { label: "Ecommerce analytics events", value: "Implemented", isSecret: false },
    { label: "External Google verification", value: "Accept analytics consent publicly, open Tag Assistant or Analytics Realtime, test the production domain, and allow reporting time.", isSecret: false },
    { label: "Canonical domain", value: siteConfig.domain, isSecret: false },
    { label: "Canonical HTTPS", value: yesNo(siteConfig.url.startsWith("https://")), isSecret: false },
    { label: "Google verification configured", value: configurationStatus(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION), isSecret: false },
    { label: "Bing verification configured", value: configurationStatus(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION), isSecret: false },
    { label: "Robots content state", value: contentConfig.indexingEnabled ? "Index/follow" : "Noindex content gate", isSecret: false },
    { label: "Content indexing", value: contentConfig.indexingEnabled ? "Enabled" : "Disabled", isSecret: false },
    { label: "Sitemap article count", value: String(indexing.sitemapArticleCount), isSecret: false },
    { label: "RSS", value: indexing.rssEnabled ? "Enabled" : "Disabled", isSecret: false },
    { label: "Eligible published articles", value: String(indexing.eligibleArticleCount), isSecret: false },
    { label: "Noindex eligible articles", value: String(indexing.noindexArticleCount), isSecret: false },
    { label: "Empty active categories", value: String(indexing.emptyCategoryCount), isSecret: false },
    { label: "Empty active tags", value: String(indexing.emptyTagCount), isSecret: false },
    {
      label: "Configured site name",
      value: siteConfig.name,
      isSecret: false,
    },
    {
      label: "Configured site domain",
      value: siteConfig.domain,
      isSecret: false,
    },
    {
      label: "NEXT_PUBLIC_SITE_URL",
      value: siteUrl || "Missing",
      isSecret: false,
    },
    {
      label: "Computed callback URL",
      value: callbackUrl,
      isSecret: false,
    },
    {
      label: "PAYSTACK_SECRET_KEY configured",
      value: yesNo(paystackDiagnostics.secretKey.configured),
      isSecret: true,
    },
    {
      label: "PAYSTACK_SECRET_KEY format valid",
      value: yesNo(paystackDiagnostics.secretKey.formatValid),
      isSecret: true,
    },
    {
      label: "PAYSTACK_SECRET_KEY mode",
      value: paystackDiagnostics.secretKey.mode,
      isSecret: true,
    },
    {
      label: "PAYSTACK_SECRET_KEY has quotes",
      value: yesNo(paystackDiagnostics.secretKey.hasQuotes),
      isSecret: true,
    },
    {
      label: "PAYSTACK_SECRET_KEY has surrounding whitespace",
      value: yesNo(paystackDiagnostics.secretKey.hasSurroundingWhitespace),
      isSecret: true,
    },
    {
      label: "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY configured",
      value: yesNo(paystackDiagnostics.publicKey.configured),
      isSecret: true,
    },
    {
      label: "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY format valid",
      value: yesNo(paystackDiagnostics.publicKey.formatValid),
      isSecret: true,
    },
    {
      label: "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY mode",
      value: paystackDiagnostics.publicKey.mode,
      isSecret: true,
    },
    {
      label: "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY has quotes",
      value: yesNo(paystackDiagnostics.publicKey.hasQuotes),
      isSecret: true,
    },
    {
      label: "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY has surrounding whitespace",
      value: yesNo(paystackDiagnostics.publicKey.hasSurroundingWhitespace),
      isSecret: true,
    },
    {
      label: "Paystack test/live modes match",
      value: yesNo(paystackDiagnostics.keyModesMatch),
      isSecret: true,
    },
    {
      label: "NEXT_PUBLIC_SUPABASE_URL",
      value: configurationStatus(process.env.NEXT_PUBLIC_SUPABASE_URL),
      isSecret: true,
    },
    {
      label: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      value: configurationStatus(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
      isSecret: true,
    },
    {
      label: "SUPABASE_SERVICE_ROLE_KEY",
      value: configurationStatus(process.env.SUPABASE_SERVICE_ROLE_KEY),
      isSecret: true,
    },
    {
      label: "ADMIN_EMAIL",
      value: configurationStatus(process.env.ADMIN_EMAIL),
      isSecret: true,
    },
    {
      label: "Notifications enabled",
      value: email.notificationsEnabled ? "Ready" : "Missing",
      isSecret: false,
    },
    {
      label: "Email provider selected",
      value: providerLabel(email.provider),
      isSecret: false,
    },
    {
      label: "Email provider configured",
      value: yesNo(emailProviderConfigured()),
      isSecret: true,
    },
    {
      label: "Gmail configured",
      value: yesNo(gmailConfigured()),
      isSecret: true,
    },
    {
      label: "Brevo API key configured",
      value: yesNo(email.brevoApiKey),
      isSecret: true,
    },
    {
      label: "Admin notification email configured",
      value: email.adminRecipient ? "Configured, not runtime-tested" : "Missing",
      isSecret: true,
    },
    {
      label: "Customer email status notifications possible",
      value: yesNo(notificationsAreEnabled() && emailProviderConfigured()),
      isSecret: true,
    },
    {
      label: "WhatsApp provider selected",
      value: selectedWhatsAppProvider(),
      isSecret: false,
    },
    {
      label: "WhatsApp provider configured",
      value: yesNo(whatsAppProviderConfigured()),
      isSecret: true,
    },
    {
      label: "Admin WhatsApp recipient configured",
      value: yesNo(Boolean(process.env.ADMIN_NOTIFICATION_WHATSAPP_TO?.trim())),
      isSecret: true,
    },
    {
      label: "Customer WhatsApp status notifications possible",
      value: yesNo(customerWhatsAppStatusNotificationsPossible()),
      isSecret: true,
    },
  ];
  diagnostics.push(
    { label: "General sender configured", value: email.generalSender ? "Configured, not runtime-tested" : "Missing", isSecret: true },
    { label: "Support sender configured", value: email.supportSender ? "Configured, not runtime-tested" : "Missing", isSecret: true },
    { label: "Orders sender configured", value: email.ordersSender ? "Configured, not runtime-tested" : "Missing", isSecret: true },
    { label: "Support Reply-To configured", value: email.replyTo ? "Configured, not runtime-tested" : "Missing", isSecret: true },
    { label: "Contact inbox configured", value: email.contactInbox ? "Configured, not runtime-tested" : "Missing", isSecret: true },
    { label: "Public business email configured", value: email.publicBusiness ? "Ready" : "Missing", isSecret: false },
    { label: "Public support email configured", value: email.publicSupport ? "Ready" : "Missing", isSecret: false },
    { label: "Public orders email configured", value: email.publicOrders ? "Ready" : "Missing", isSecret: false },
    { label: "Sender domain matches shieldsfarms.store", value: email.domainMatches ? "Ready" : "Misconfigured", isSecret: false },
    { label: "Sender domain aligned to deployment", value: email.senderDomainAligned ? "Ready" : "Misconfigured", isSecret: false },
    { label: "Transactional multipart bodies", value: email.htmlAndTextSupported ? "HTML and plain text" : "Missing", isSecret: false },
    { label: "Inbox placement", value: email.inboxPlacementGuaranteed ? "Guaranteed" : "Not guaranteed; externally verify SPF, DKIM and DMARC", isSecret: false },
    { label: "PWA feature flag", value: operationalFeatures.pwaEnabled ? "Enabled" : "Disabled; install controls hidden", isSecret: false },
    { label: "PWA manifest identities", value: "Public /manifest.webmanifest; Admin /admin/manifest.webmanifest", isSecret: false },
    { label: "Web push public key", value: operationalFeatures.vapidPublicKey ? "Configured" : "Missing", isSecret: true },
  );

  return (
    <>
      <AdminHeader
        title="Diagnostics"
        body="Server-side deployment configuration checks. Secret values are never displayed."
      />
      <div className="overflow-hidden rounded-lg bg-white shadow-sm">
        <dl className="divide-y divide-stone-100">
          {diagnostics.map((item) => (
            <div
              key={item.label}
              className="grid gap-2 px-5 py-4 md:grid-cols-[280px_1fr]"
            >
              <dt className="text-sm font-semibold text-stone-600">
                {item.label}
              </dt>
              <dd
                className={`break-all text-sm font-bold ${
                  item.isSecret && item.value === "Missing"
                    ? "text-red-700"
                    : "text-stone-950"
                }`}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <PaystackTestButton />
      <EmailTestButton />
    </>
  );
}


