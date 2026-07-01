# Duplicating This Codebase For Another Farm Brand

Use this guide when creating a separate deployment for another farm brand such as Shields Farms.

1. Clone this repo or create a new deployment from the same source.
2. Create a separate Supabase project for the new farm.
3. Run the schema and seed files needed for the new farm catalogue.
4. Upload the Shields Farms logo to `public/images`, for example `public/images/shields-farms-logo.png`.
5. Set the brand environment variables for Shields Farms, including `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_DOMAIN`, contact details, and `NEXT_PUBLIC_LOGO_PATH`.
6. Set the Shields Farms domain in Vercel.
7. Configure Shields Farms Paystack keys and callback/webhook URLs.
8. Configure Shields Farms Gmail and notification environment variables.
9. Run the admin delivery coverage checker for every launch destination and delivery method.
10. Place one test order before launch and verify checkout, Paystack, email notifications, order status notifications, delivery rates, and tracking.

Important separation rules:

- Use a separate Supabase project to avoid mixing orders, customers, inventory movements, and notifications between farms.
- Use separate Paystack keys or a clearly separated settlement setup.
- Use separate notification email accounts, recipients, and WhatsApp phone/provider settings.
- Do not share production order, payment, notification, or customer tables between farms.
- Do not reuse live Noble Farms transaction data for another brand.

Example Shields Farms brand env values:

```env
NEXT_PUBLIC_SITE_NAME="Shields Farms"
NEXT_PUBLIC_SITE_URL="https://shieldsfarms.example"
NEXT_PUBLIC_SITE_DOMAIN="shieldsfarms.example"
NEXT_PUBLIC_SITE_TAGLINE="Farm produce supplied with care"
NEXT_PUBLIC_SITE_DESCRIPTION="Order fresh farm produce from Shields Farms with secure checkout, delivery tracking, and reliable fulfilment."
NEXT_PUBLIC_BUSINESS_ADDRESS="Shields Farms, Your Address"
NEXT_PUBLIC_BUSINESS_PHONE="+2340000000000"
NEXT_PUBLIC_BUSINESS_EMAIL="info@shieldsfarms.example"
NEXT_PUBLIC_SUPPORT_EMAIL="support@shieldsfarms.example"
NEXT_PUBLIC_ORDERS_EMAIL="orders@shieldsfarms.example"
NEXT_PUBLIC_WHATSAPP_PHONE="+2340000000000"
NEXT_PUBLIC_LOGO_PATH="/images/shields-farms-logo.png"
```

