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
  "Order eggs, broilers, fresh crop produce, tomatoes, peppers, potatoes, onions, and selected farm inputs from Noble Farms. Secure checkout, order tracking, and reliable fulfilment.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Noble Farms | Poultry, Eggs & Fresh Farm Produce",
    template: `%s | ${siteName}`,
  },
  description,
  icons: {
    icon: "/favicon.ico",
    apple: "/images/noble-farms-logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "/",
    siteName,
    title: "Noble Farms | Poultry, Eggs & Fresh Farm Produce",
    description,
    images: ["/images/noble-farms-logo.png"],
  },
  twitter: {
    card: "summary",
    title: siteName,
    description,
    images: ["/images/noble-farms-logo.png"],
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