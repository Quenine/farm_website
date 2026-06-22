import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "@/src/components/cart/cart-provider";
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

const siteName = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Noble Farms";
const description =
  "Fresh poultry, eggs, processed chicken, and farm products delivered within Ibadan.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description,
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "/",
    siteName,
    title: siteName,
    description,
  },
  twitter: {
    card: "summary",
    title: siteName,
    description,
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
