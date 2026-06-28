import { connection } from "next/server";
import { AdminHeader } from "@/src/components/admin";
import { getPaystackEnvironmentDiagnostics } from "@/src/lib/paystack";
import { validateConfiguredSiteUrl } from "@/src/lib/site-url";
import { PaystackTestButton } from "./paystack-test-button";

function configurationStatus(value: string | undefined) {
  return value?.trim() ? "Configured" : "Missing";
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
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
