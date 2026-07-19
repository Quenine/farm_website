# Transactional email deliverability

Shields Farms uses Namecheap forwarding for incoming official addresses and Brevo for outgoing transactional mail. Forwarding does not authenticate outgoing messages.

Every transactional message is submitted with both HTML and plain-text content. A provider acceptance response means that the provider accepted the message; it does not guarantee inbox placement.

Production DNS must retain Brevo's current SPF and DKIM records. Publish exactly one DMARC TXT record at `_dmarc.shieldsfarms.store`; merge policy/reporting changes into that record rather than creating a second record. Confirm the exact record values in Brevo and Namecheap because provider values can change.

Before enabling notifications, verify:

- `EMAIL_PROVIDER=brevo`
- `BREVO_API_KEY` is present only on the server
- official From addresses use the authenticated deployment domain
- Reply-To addresses are intentional
- SPF, DKIM, and the single DMARC record pass an external DNS check

Delivery failures remain non-fatal to orders and inquiries and are logged without recipient addresses, message bodies, or credentials.
