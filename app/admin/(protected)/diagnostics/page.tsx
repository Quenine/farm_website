import { connection } from "next/server";
import { AdminHeader } from "@/src/components/admin";
import { siteConfig } from "@/src/config/site";
import { getPaystackEnvironmentDiagnostics } from "@/src/lib/paystack";
import { validateConfiguredSiteUrl } from "@/src/lib/site-url";
import { PaystackTestButton } from "./paystack-test-button";

function configurationStatus(value: string | undefined) {
  return value?.trim() ? "Configured" : "Missing";
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function notificationsAreEnabled() {
  return process.env.NOTIFICATIONS_ENABLED?.trim().toLowerCase() === "true";
}

function selectedEmailProvider() {
  const provider = process.env.EMAIL_PROVIDER?.trim();
  if (provider) return provider;
  return process.env.RESEND_API_KEY?.trim()
    ? "resend (from RESEND_API_KEY)"
    : "Not selected";
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
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.FROM_EMAIL?.trim());
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
  const callbackUrl = siteUrlValidation.valid
    ? `${siteUrlValidation.siteUrl}/payment/callback`
    : `Unavailable: ${siteUrlValidation.reason}`;

  const diagnostics = [
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
      value: yesNo(notificationsAreEnabled()),
      isSecret: false,
    },
    {
      label: "Email provider selected",
      value: selectedEmailProvider(),
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
      label: "Admin notification email configured",
      value: yesNo(Boolean(process.env.ADMIN_NOTIFICATION_EMAIL?.trim())),
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
    </>
  );
}


