import { siteConfig } from "@/src/config/site";
import { PageShell, SectionHeader } from "@/src/components/ui";

export default function PrivacyPolicyPage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Privacy"
          title="Privacy policy"
          body={`${siteConfig.name} collects only the information needed to process orders, accept payment, arrange fulfilment, support customers, and understand non-sensitive marketing performance when customers allow it.`}
        />
        <div className="mt-8 grid gap-5 rounded-lg bg-white p-6 text-sm leading-7 text-stone-700 shadow-sm">
          <p>{siteConfig.name} may collect your name, phone number, email address, delivery location, order details, delivery notes, and payment confirmation details when you place or track an order on {siteConfig.domain}.</p>
          <p>Payment is processed through Paystack. {siteConfig.name} does not store card details on this website.</p>
          <p>We use order information to fulfil purchases, contact customers about orders, manage inventory, arrange delivery or pickup, reconcile payments, and improve customer support.</p>
          <p>Essential browser storage is used for features such as cart contents, checkout continuity, security, order flow, and cookie preference choices. These essential functions remain available even if you reject optional tracking.</p>
          <p>Optional analytics tracking may be used only after analytics consent is granted. Analytics events can help us understand product views, searches, cart actions, checkout flow, and completed purchases. These events should not include customer names, email addresses, phone numbers, or delivery addresses.</p>
          <p>Optional marketing pixels may be used only after marketing consent is granted. Marketing pixels help measure campaign performance and may receive non-sensitive event labels such as product views, cart actions, purchases, or WhatsApp lead actions.</p>
          <p>When you arrive through a tracked link, the website may store UTM campaign values, the referring URL when available, the initial landing path, and the first seen timestamp. The app keeps first-touch and last-touch attribution so we can understand which campaign first introduced a visitor and which campaign was most recent before an order.</p>
          <p>Campaign links may record lightweight click logs for campaign reporting. These logs do not intentionally store IP addresses and do not contain customer names, emails, phone numbers, or delivery addresses.</p>
          <p>If content subscriptions are enabled, we collect the email address, selected topic, source page, consent text, consent timestamp, and unsubscribe token needed to manage update-list subscriptions. Subscriber emails are not shown publicly, are not sent to analytics events, and no automatic email messages are sent in this batch.</p>
          <p>You can reject non-essential tracking when the privacy notice appears. You can also reopen Cookie Preferences from the footer to change or withdraw optional analytics and marketing consent.</p>
          <p>We do not sell customer personal information. We may share necessary order details with fulfilment or delivery partners only when needed to complete your order.</p>
          <p>For privacy questions, contact {siteConfig.supportEmail} or call {siteConfig.phone}. The website URL is {siteConfig.url}.</p>
        </div>
      </section>
    </PageShell>
  );
}
