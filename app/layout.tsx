import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/src/components/cart/cart-provider";
import { siteConfig } from "@/src/config/site";
import { getSiteUrl } from "@/src/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteName = siteConfig.name;
const description = siteConfig.description;

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${siteConfig.name} | Poultry, Eggs & Fresh Farm Produce`,
    template: `%s | ${siteName}`,
  },
  description,
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#fbf7ed] text-stone-950">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}


