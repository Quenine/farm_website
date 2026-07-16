# Shields Farms production email

## Inbound email

Application code does not create inboxes. Configure domain mailboxes or forwarding so `info@shieldsfarms.store`, `support@shieldsfarms.store`, and `orders@shieldsfarms.store` reach the private operational inbox. Test each address externally before launch.

## Outbound email

Verify `shieldsfarms.store` with the selected Gmail or Resend configuration. Add the provider-issued SPF and DKIM records, complete provider domain verification, and add a DMARC policy appropriate to the rollout. Provider-generated DNS values must come from the provider dashboard and must not be copied from this document.

Configure these Vercel variables:

```env
NEXT_PUBLIC_BUSINESS_EMAIL=info@shieldsfarms.store
NEXT_PUBLIC_SUPPORT_EMAIL=support@shieldsfarms.store
NEXT_PUBLIC_ORDERS_EMAIL=orders@shieldsfarms.store
ADMIN_NOTIFICATION_EMAIL=<private inbox>
CONTACT_INBOX_EMAIL=<private inbox>
EMAIL_FROM_GENERAL=Shields Farms <info@shieldsfarms.store>
EMAIL_FROM_SUPPORT=Shields Farms Support <support@shieldsfarms.store>
EMAIL_FROM_ORDERS=Shields Farms Orders <orders@shieldsfarms.store>
EMAIL_REPLY_TO_SUPPORT=support@shieldsfarms.store
```

Keep the private recipients server-only. After deployment, use protected Admin Diagnostics to send a test email, submit one contact inquiry, confirm the private notification, confirm the customer acknowledgement, and verify Reply-To. Then place a controlled order and confirm the orders sender. Never expose or log private recipient values.
