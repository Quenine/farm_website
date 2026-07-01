function publicEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

const defaultSiteUrl = "https://noblefarms.xyz";
const configuredUrl = publicEnv("NEXT_PUBLIC_SITE_URL", defaultSiteUrl);
const domainFromUrl = (() => {
  try {
    return new URL(configuredUrl).hostname;
  } catch {
    return "noblefarms.xyz";
  }
})();

export const siteConfig = {
  name: publicEnv("NEXT_PUBLIC_SITE_NAME", "Noble Farms"),
  url: configuredUrl,
  domain: publicEnv("NEXT_PUBLIC_SITE_DOMAIN", domainFromUrl),
  tagline: publicEnv("NEXT_PUBLIC_SITE_TAGLINE", "Poultry, eggs & fresh produce"),
  description: publicEnv(
    "NEXT_PUBLIC_SITE_DESCRIPTION",
    "Order eggs, broilers, fresh crop produce, tomatoes, peppers, potatoes, onions, and selected farm inputs from Noble Farms. Secure checkout, order tracking, and reliable fulfilment.",
  ),
  address: publicEnv("NEXT_PUBLIC_BUSINESS_ADDRESS", "Noble Farms, Alapata, Ibadan, Nigeria"),
  phone: publicEnv("NEXT_PUBLIC_BUSINESS_PHONE", "+2349035712314"),
  email: publicEnv("NEXT_PUBLIC_BUSINESS_EMAIL", "info@noblefarms.xyz"),
  supportEmail: publicEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "info@noblefarms.xyz"),
  ordersEmail: publicEnv("NEXT_PUBLIC_ORDERS_EMAIL", "info@noblefarms.xyz"),
  whatsappPhone: publicEnv("NEXT_PUBLIC_WHATSAPP_PHONE", "+2349035712314"),
  logoPath: publicEnv("NEXT_PUBLIC_LOGO_PATH", "/images/noble-farms-logo.png"),
};

export const siteContact = {
  phoneHref: `tel:${siteConfig.phone}`,
  emailHref: `mailto:${siteConfig.email}`,
  supportEmailHref: `mailto:${siteConfig.supportEmail}`,
  ordersEmailHref: `mailto:${siteConfig.ordersEmail}`,
  whatsappHref: `https://wa.me/${phoneDigits(siteConfig.whatsappPhone)}`,
  trackOrderUrl: `${siteConfig.url.replace(/\/$/, "")}/track-order`,
};

