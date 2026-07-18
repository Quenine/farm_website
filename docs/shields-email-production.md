# Shields Farms production email

## Incoming: Namecheap Email Forwarding

Incoming mail uses Namecheap Email Forwarding. The info@shieldsfarms.store, support@shieldsfarms.store, and orders@shieldsfarms.store addresses forward to the private operational Gmail inbox.

The application does not change Namecheap Mail Settings. Brevo transactional sending does not require an MX change for standard sender authentication.

## Outgoing: Brevo transactional API

Set EMAIL_PROVIDER=brevo and configure the server-only BREVO_API_KEY. The application sends through the Brevo HTTPS transactional endpoint. Resend and Gmail SMTP remain supported alternatives; provider selection is explicit and each deployment should configure only the intended provider and corresponding credential.

Authenticate shieldsfarms.store in Brevo using:

- The Brevo verification TXT record.
- The DKIM TXT or CNAME records shown by Brevo.
- A suitable DMARC TXT record.

Exact DNS host names and values must come from the Brevo dashboard. Do not invent or copy sample DNS values, and do not replace the Namecheap forwarding MX configuration.

## Vercel environment

    NEXT_PUBLIC_BUSINESS_EMAIL=info@shieldsfarms.store
    NEXT_PUBLIC_SUPPORT_EMAIL=support@shieldsfarms.store
    NEXT_PUBLIC_ORDERS_EMAIL=orders@shieldsfarms.store
    ADMIN_NOTIFICATION_EMAIL=<private inbox>
    CONTACT_INBOX_EMAIL=<private inbox>
    EMAIL_PROVIDER=brevo
    BREVO_API_KEY=<server-only Brevo API key>
    EMAIL_FROM_GENERAL=Shields Farms <info@shieldsfarms.store>
    EMAIL_FROM_SUPPORT=Shields Farms Support <support@shieldsfarms.store>
    EMAIL_FROM_ORDERS=Shields Farms Orders <orders@shieldsfarms.store>
    EMAIL_REPLY_TO_SUPPORT=support@shieldsfarms.store

Keep private recipients and API credentials server-only. After Brevo authenticates the domain, use protected Admin Diagnostics to send a test email. Then submit a controlled contact inquiry and order, confirm private and customer messages, and verify Reply-To. Never expose or log private recipients or provider credentials.
