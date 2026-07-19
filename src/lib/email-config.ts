import "server-only";

import { siteConfig } from "@/src/config/site";

function value(name: string) { return process.env[name]?.trim() || ""; }
const fallbackFrom = value("FROM_EMAIL");
const fallbackReplyTo = value("REPLY_TO_EMAIL");

export const emailConfig = {
  provider: value("EMAIL_PROVIDER").toLowerCase(),
  publicBusinessEmail: siteConfig.email,
  publicSupportEmail: siteConfig.supportEmail,
  publicOrdersEmail: siteConfig.ordersEmail,
  adminNotificationEmail: value("ADMIN_NOTIFICATION_EMAIL"),
  contactInboxEmail: value("CONTACT_INBOX_EMAIL") || value("ADMIN_NOTIFICATION_EMAIL"),
  fromGeneral: value("EMAIL_FROM_GENERAL") || fallbackFrom,
  fromSupport: value("EMAIL_FROM_SUPPORT") || fallbackFrom,
  fromOrders: value("EMAIL_FROM_ORDERS") || fallbackFrom,
  replyToSupport: value("EMAIL_REPLY_TO_SUPPORT") || fallbackReplyTo || siteConfig.supportEmail,
  notificationsEnabled: value("NOTIFICATIONS_ENABLED").toLowerCase() === "true",
};

export function senderDomainMatches(expected = "shieldsfarms.store") {
  const senders = [emailConfig.fromGeneral, emailConfig.fromSupport, emailConfig.fromOrders].filter(Boolean);
  return senders.length > 0 && senders.every((sender) => sender.toLowerCase().includes(`@${expected}`));
}

export function emailDiagnostics() {
  const expectedDomain = siteConfig.url.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  return {
    provider: emailConfig.provider || "Missing",
    generalSender: Boolean(emailConfig.fromGeneral), supportSender: Boolean(emailConfig.fromSupport), ordersSender: Boolean(emailConfig.fromOrders),
    replyTo: Boolean(emailConfig.replyToSupport), adminRecipient: Boolean(emailConfig.adminNotificationEmail), contactInbox: Boolean(emailConfig.contactInboxEmail),
    publicBusiness: Boolean(emailConfig.publicBusinessEmail), publicSupport: Boolean(emailConfig.publicSupportEmail), publicOrders: Boolean(emailConfig.publicOrdersEmail),
    domainMatches: senderDomainMatches(), notificationsEnabled: emailConfig.notificationsEnabled,
    brevoApiKey: Boolean(value("BREVO_API_KEY")),
    senderDomainAligned: senderDomainMatches(expectedDomain),
    htmlAndTextSupported: true,
    externalDomainAuthenticationRequired: true,
    inboxPlacementGuaranteed: false,
  };
}
