import type { Metadata } from "next";
import { CartProvider } from "@/src/components/cart/cart-provider";
import { MarketingRuntime } from "@/src/components/marketing-runtime";
import { siteConfig } from "@/src/config/site";
import { rssDiscoveryEnabled } from "@/src/lib/content-config";
import { getSiteUrl } from "@/src/lib/site-url";
import "./globals.css";

const siteName = siteConfig.name;
const description = siteConfig.description;
const verificationValue = (name: string) => {
  const value = process.env[name]?.trim() ?? "";
  return /^[A-Za-z0-9._=-]{6,200}$/.test(value) ? value : undefined;
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${siteConfig.name} | Poultry, Eggs & Fresh Farm Produce`,
    template: `%s | ${siteName}`,
  },
  description,
  verification: {
    ...(verificationValue("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION") ? { google: verificationValue("NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION") } : {}),
    ...(verificationValue("NEXT_PUBLIC_BING_SITE_VERIFICATION") ? { other: { "msvalidate.01": verificationValue("NEXT_PUBLIC_BING_SITE_VERIFICATION")! } } : {}),
  },
  icons: {
    icon: "/favicon.ico",
    apple: siteConfig.logoPath,
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "/",
    siteName,
    title: `${siteConfig.name} | Poultry, Eggs & Fresh Farm Produce`,
    description,
    images: [siteConfig.logoPath],
  },
  ...(rssDiscoveryEnabled() ? { alternates: { types: { "application/rss+xml": "/blog/feed.xml" } } } : {}),
  twitter: {
    card: "summary",
    title: siteName,
    description,
    images: [siteConfig.logoPath],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#fbf7ed] text-stone-950">
        <CartProvider>{children}<MarketingRuntime /></CartProvider>
      </body>
    </html>
  );
}
