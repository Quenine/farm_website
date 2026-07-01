import "server-only";

import nodemailer from "nodemailer";
import { formatNaira } from "@/src/lib/format";
import { getSiteUrl } from "@/src/lib/site-url";
import { createAdminSupabaseClient } from "@/src/lib/supabase/admin";
import type { DatabaseOrderStatus, DeliveryMethod } from "@/src/types";

export type NotificationOrderRow = {
  id: string;
  order_reference: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_method: DeliveryMethod | null;
  delivery_state: string | null;
  delivery_city: string | null;
  delivery_fee: number | string;
  total_amount: number | string;
  paystack_reference: string | null;
  order_status?: DatabaseOrderStatus;
  admin_email_notified_at: string | null;
  admin_whatsapp_notified_at: string | null;
  customer_email_notified_at: string | null;
  order_items?: Array<{
    product_name: string;
    quantity: number | string;
    unit: string;
    unit_price: number | string;
    total_price: number | string;
  }>;
};

type NotificationChannel =
  | "admin_email_notified_at"
  | "admin_whatsapp_notified_at"
  | "customer_email_notified_at";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

type CustomerStatusNotificationStatus =
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

type StatusNotificationChannel = "customer_email" | "customer_whatsapp";

type StatusNotificationResult = {
  attempted: boolean;
  emailSent: boolean;
  whatsappSent: boolean;
};

const customerStatusNotificationStatuses = new Set<string>([
  "packed",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

const customerStatusLabels: Record<CustomerStatusNotificationStatus, string> = {
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const customerStatusSubjects: Record<CustomerStatusNotificationStatus, string> = {
  packed: "Your Noble Farms order is packed",
  out_for_delivery: "Your Noble Farms order is out for delivery",
  delivered: "Your Noble Farms order has been delivered",
  cancelled: "Your Noble Farms order was cancelled",
};

const customerStatusMessages: Record<CustomerStatusNotificationStatus, string> = {
  packed: "Your order has been packed and is being prepared for dispatch.",
  out_for_delivery:
    "Your order is now out for delivery. Please keep your phone available in case our delivery team needs to reach you.",
  delivered: "Your order has been marked as delivered. Thank you for ordering from Noble Farms.",
  cancelled:
    "Your order has been cancelled. If you believe this is a mistake or need help, please contact Noble Farms.",
};

function notificationsEnabled() {
  return process.env.NOTIFICATIONS_ENABLED?.trim().toLowerCase() === "true";
}

function deliveryMethodLabel(method: DeliveryMethod | null) {
  return {
    home_delivery: "Home Delivery",
    pickup_point: "Pickup Point Delivery",
    farm_pickup: "Farm Pickup / Direct Arrangement",
  }[method ?? "home_delivery"];
}

function deliveryLocation(order: NotificationOrderRow) {
  return [order.delivery_city, order.delivery_state].filter(Boolean).join(", ") || "Not specified";
}

function itemSummary(order: NotificationOrderRow) {
  return (order.order_items ?? [])
    .map(
      (item) =>
        `- ${item.quantity} ${String(item.unit).replaceAll("_", " ")} ${item.product_name} (${formatNaira(Number(item.total_price))})`,
    )
    .join("\n");
}

function adminOrderMessage(order: NotificationOrderRow) {
  const siteUrl = getSiteUrl();
  return `New paid order on Noble Farms

Order: ${order.order_reference}
Customer: ${order.customer_name}
Phone: ${order.customer_phone || "Not provided"}
Email: ${order.customer_email || "Not provided"}
Delivery: ${deliveryMethodLabel(order.delivery_method)}
Location: ${deliveryLocation(order)}
Delivery fee: ${formatNaira(Number(order.delivery_fee))}
Total paid: ${formatNaira(Number(order.total_amount))}

Items:
${itemSummary(order)}

Open admin dashboard:
${siteUrl}/admin/orders`;
}

function adminEmailHtml(order: NotificationOrderRow) {
  const siteUrl = getSiteUrl();
  return `
    <h2>New paid order on Noble Farms</h2>
    <p><strong>Order:</strong> ${order.order_reference}</p>
    <p><strong>Customer:</strong> ${order.customer_name}</p>
    <p><strong>Phone:</strong> ${order.customer_phone || "Not provided"}</p>
    <p><strong>Email:</strong> ${order.customer_email || "Not provided"}</p>
    <p><strong>Delivery method:</strong> ${deliveryMethodLabel(order.delivery_method)}</p>
    <p><strong>Delivery location:</strong> ${deliveryLocation(order)}</p>
    <p><strong>Address:</strong> ${order.delivery_address || "Not provided"}</p>
    <p><strong>Delivery fee:</strong> ${formatNaira(Number(order.delivery_fee))}</p>
    <p><strong>Total paid:</strong> ${formatNaira(Number(order.total_amount))}</p>
    <p><strong>Payment reference:</strong> ${order.paystack_reference || "Not available"}</p>
    <h3>Items</h3>
    <pre>${itemSummary(order)}</pre>
    <p><a href="${siteUrl}/admin/orders">Open admin orders</a></p>
  `;
}

function customerEmailHtml(order: NotificationOrderRow) {
  const siteUrl = getSiteUrl();
  return `
    <h2>Your Noble Farms order is confirmed</h2>
    <p>Thank you for your order. We have confirmed your payment.</p>
    <p><strong>Order:</strong> ${order.order_reference}</p>
    <p><strong>Payment status:</strong> Paid</p>
    <p><strong>Order total:</strong> ${formatNaira(Number(order.total_amount))}</p>
    <p><strong>Delivery method:</strong> ${deliveryMethodLabel(order.delivery_method)}</p>
    <p><strong>Delivery location:</strong> ${deliveryLocation(order)}</p>
    <p>You can track your order at <a href="${siteUrl}/track-order">${siteUrl}/track-order</a> using your order reference and phone number.</p>
    <p>Need help? Call or WhatsApp +2349035712314, or email info@noblefarms.xyz.</p>
  `;
}

function customerStatusEmailHtml(order: NotificationOrderRow, status: CustomerStatusNotificationStatus) {
  const siteUrl = getSiteUrl();
  const statusLabel = customerStatusLabels[status];
  return `
    <h2>Your Noble Farms order update</h2>
    <p>Hello ${order.customer_name || "there"},</p>
    <p>${customerStatusMessages[status]}</p>
    <p><strong>Order:</strong> ${order.order_reference}</p>
    <p><strong>Current status:</strong> ${statusLabel}</p>
    <p><strong>Delivery method:</strong> ${deliveryMethodLabel(order.delivery_method)}</p>
    <p><strong>Delivery location:</strong> ${deliveryLocation(order)}</p>
    <p><strong>Order total:</strong> ${formatNaira(Number(order.total_amount))}</p>
    <p>You can track your order at <a href="${siteUrl}/track-order">${siteUrl}/track-order</a> using your order reference and phone number.</p>
    <p>Need help? Call or WhatsApp +2349035712314, or email info@noblefarms.xyz.</p>
  `;
}

function customerStatusMessage(order: NotificationOrderRow, status: CustomerStatusNotificationStatus) {
  const siteUrl = getSiteUrl();
  return `Noble Farms order update

Hello ${order.customer_name || "there"},
${customerStatusMessages[status]}

Order: ${order.order_reference}
Status: ${customerStatusLabels[status]}
Delivery: ${deliveryMethodLabel(order.delivery_method)}
Location: ${deliveryLocation(order)}
Total: ${formatNaira(Number(order.total_amount))}

Track your order: ${siteUrl}/track-order
Need help? Call or WhatsApp +2349035712314, or email info@noblefarms.xyz.`;
}

function selectedEmailProvider() {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (provider) return provider;
  return process.env.RESEND_API_KEY?.trim() ? "resend" : "";
}

function gmailSmtpSecure() {
  const value = process.env.GMAIL_SMTP_SECURE?.trim().toLowerCase();
  if (!value) return true;
  return value === "true";
}

function normalizeStatusForCustomerNotification(
  status: DatabaseOrderStatus | "dispatched",
): CustomerStatusNotificationStatus | null {
  const normalized = status === "dispatched" ? "out_for_delivery" : status;
  return customerStatusNotificationStatuses.has(normalized)
    ? (normalized as CustomerStatusNotificationStatus)
    : null;
}

async function sendGmailEmail({ to, subject, html }: EmailPayload) {
  const host = process.env.GMAIL_SMTP_HOST?.trim() || "smtp.gmail.com";
  const port = Number(process.env.GMAIL_SMTP_PORT?.trim() || 465);
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  const from = process.env.FROM_EMAIL?.trim();
  const replyTo = process.env.REPLY_TO_EMAIL?.trim();

  if (!host || !Number.isInteger(port) || port <= 0 || !user || !pass || !from || !to.trim()) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: gmailSmtpSecure(),
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });

  return true;
}

async function sendResendEmail({ to, subject, html }: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.FROM_EMAIL?.trim();
  if (!apiKey || !from || !to.trim()) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend email failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  return true;
}

async function sendEmail(payload: EmailPayload) {
  const provider = selectedEmailProvider();

  if (provider === "gmail") {
    return sendGmailEmail(payload);
  }

  if (provider === "resend") {
    return sendResendEmail(payload);
  }

  return false;
}

async function markChannelSent(orderId: string, channel: NotificationChannel) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("orders")
    .update({ [channel]: new Date().toISOString() })
    .eq("id", orderId)
    .is(channel, null);

  if (error) {
    console.error("[Order Notification Timestamp Failed]", {
      orderId,
      channel,
      reason: error.message,
    });
  }
}

async function statusNotificationAlreadySent({
  orderId,
  status,
  channel,
  recipient,
}: {
  orderId: string;
  status: CustomerStatusNotificationStatus;
  channel: StatusNotificationChannel;
  recipient: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("order_status_notifications")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", status)
    .eq("channel", channel)
    .eq("recipient", recipient)
    .maybeSingle();

  if (error) {
    console.error("[Order Status Notification Check Failed]", {
      orderId,
      status,
      channel,
      reason: error.message,
    });
    return true;
  }

  return Boolean(data);
}

async function markStatusNotificationSent({
  orderId,
  status,
  channel,
  recipient,
}: {
  orderId: string;
  status: CustomerStatusNotificationStatus;
  channel: StatusNotificationChannel;
  recipient: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("order_status_notifications").insert({
    order_id: orderId,
    status,
    channel,
    recipient,
  });

  if (error && error.code !== "23505") {
    console.error("[Order Status Notification Timestamp Failed]", {
      orderId,
      status,
      channel,
      reason: error.message,
    });
  }
}

export async function sendAdminEmailNotification(order: NotificationOrderRow) {
  if (order.admin_email_notified_at) return;
  const to = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!to) return;

  const sent = await sendEmail({
    to,
    subject: `New paid order \u2014 Noble Farms #${order.order_reference}`,
    html: adminEmailHtml(order),
  });

  if (sent) await markChannelSent(order.id, "admin_email_notified_at");
}

export async function sendCustomerOrderConfirmation(order: NotificationOrderRow) {
  if (order.customer_email_notified_at || !order.customer_email?.trim()) return;

  const sent = await sendEmail({
    to: order.customer_email,
    subject: "Your Noble Farms order is confirmed",
    html: customerEmailHtml(order),
  });

  if (sent) await markChannelSent(order.id, "customer_email_notified_at");
}

export async function sendAdminWhatsAppNotification(order: NotificationOrderRow) {
  if (order.admin_whatsapp_notified_at) return;
  const provider = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  const to = process.env.ADMIN_NOTIFICATION_WHATSAPP_TO?.trim();
  if (!provider || !to) return;

  if (provider === "webhook") {
    const url = process.env.WHATSAPP_WEBHOOK_URL?.trim();
    if (!url) return;
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
      headers["x-webhook-secret"] = secret;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to,
        message: adminOrderMessage(order),
        order: {
          id: order.id,
          reference: order.order_reference,
          totalAmount: Number(order.total_amount),
          deliveryFee: Number(order.delivery_fee),
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
        },
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`WhatsApp webhook failed with status ${response.status}: ${body.slice(0, 500)}`);
    }
    await markChannelSent(order.id, "admin_whatsapp_notified_at");
    return;
  }

  if (provider === "callmebot") {
    // CallMeBot is suitable for low-volume internal testing/personal-use notifications only.
    // For production WhatsApp Business messaging, use WhatsApp Cloud API.
    const apiKey = process.env.CALLMEBOT_API_KEY?.trim();
    if (!apiKey) return;

    const url = new URL("https://api.callmebot.com/whatsapp.php");
    url.searchParams.set("phone", to);
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("text", adminOrderMessage(order));

    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`CallMeBot WhatsApp failed with status ${response.status}: ${body.slice(0, 500)}`);
    }

    await markChannelSent(order.id, "admin_whatsapp_notified_at");
    return;
  }

  if (provider === "cloud") {
    const token = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const templateName = process.env.WHATSAPP_ADMIN_TEMPLATE_NAME?.trim();
    const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en";
    if (!token || !phoneNumberId || !templateName) return;

    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: order.order_reference },
                { type: "text", text: order.customer_name },
                { type: "text", text: order.customer_phone || "Not provided" },
                { type: "text", text: formatNaira(Number(order.total_amount)) },
              ],
            },
          ],
        },
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`WhatsApp Cloud API failed with status ${response.status}: ${body.slice(0, 500)}`);
    }
    await markChannelSent(order.id, "admin_whatsapp_notified_at");
  }
}

export async function sendCustomerStatusEmailNotification(
  order: NotificationOrderRow,
  newStatus: DatabaseOrderStatus | "dispatched",
) {
  if (!notificationsEnabled()) return false;

  const status = normalizeStatusForCustomerNotification(newStatus);
  const recipient = order.customer_email?.trim();
  if (!status || !recipient) return false;

  if (
    await statusNotificationAlreadySent({
      orderId: order.id,
      status,
      channel: "customer_email",
      recipient,
    })
  ) {
    return false;
  }

  const sent = await sendEmail({
    to: recipient,
    subject: customerStatusSubjects[status],
    html: customerStatusEmailHtml(order, status),
  });

  if (sent) {
    await markStatusNotificationSent({
      orderId: order.id,
      status,
      channel: "customer_email",
      recipient,
    });
  }

  return sent;
}

export async function sendCustomerStatusWhatsAppNotification(
  order: NotificationOrderRow,
  newStatus: DatabaseOrderStatus | "dispatched",
) {
  if (!notificationsEnabled()) return false;

  const status = normalizeStatusForCustomerNotification(newStatus);
  const recipient = order.customer_phone?.trim();
  const provider = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase();
  if (!status || !recipient || !provider || provider === "callmebot") return false;

  if (
    await statusNotificationAlreadySent({
      orderId: order.id,
      status,
      channel: "customer_whatsapp",
      recipient,
    })
  ) {
    return false;
  }

  if (provider === "webhook") {
    const url = process.env.WHATSAPP_WEBHOOK_URL?.trim();
    if (!url) return false;
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) {
      headers.Authorization = `Bearer ${secret}`;
      headers["x-webhook-secret"] = secret;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: recipient,
        message: customerStatusMessage(order, status),
        orderReference: order.order_reference,
        status,
        statusLabel: customerStatusLabels[status],
        trackOrderUrl: `${getSiteUrl()}/track-order`,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Customer WhatsApp webhook failed with status ${response.status}: ${body.slice(0, 500)}`);
    }

    await markStatusNotificationSent({
      orderId: order.id,
      status,
      channel: "customer_whatsapp",
      recipient,
    });
    return true;
  }

  if (provider === "cloud") {
    const token = process.env.WHATSAPP_CLOUD_API_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const templateName = process.env.WHATSAPP_CUSTOMER_STATUS_TEMPLATE_NAME?.trim();
    const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en";
    if (!token || !phoneNumberId || !templateName) return false;

    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: order.customer_name || "Customer" },
                { type: "text", text: order.order_reference },
                { type: "text", text: customerStatusLabels[status] },
                { type: "text", text: customerStatusMessages[status] },
                { type: "text", text: `${getSiteUrl()}/track-order` },
              ],
            },
          ],
        },
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Customer WhatsApp Cloud API failed with status ${response.status}: ${body.slice(0, 500)}`);
    }

    await markStatusNotificationSent({
      orderId: order.id,
      status,
      channel: "customer_whatsapp",
      recipient,
    });
    return true;
  }

  return false;
}

export async function sendCustomerOrderStatusNotification(
  order: NotificationOrderRow,
  newStatus: DatabaseOrderStatus | "dispatched",
): Promise<StatusNotificationResult> {
  if (!notificationsEnabled()) {
    return { attempted: false, emailSent: false, whatsappSent: false };
  }

  const status = normalizeStatusForCustomerNotification(newStatus);
  if (!status) {
    return { attempted: false, emailSent: false, whatsappSent: false };
  }

  const result: StatusNotificationResult = {
    attempted: true,
    emailSent: false,
    whatsappSent: false,
  };

  const tasks: Array<[keyof Pick<StatusNotificationResult, "emailSent" | "whatsappSent">, () => Promise<boolean>]> = [
    ["emailSent", () => sendCustomerStatusEmailNotification(order, status)],
    ["whatsappSent", () => sendCustomerStatusWhatsAppNotification(order, status)],
  ];

  for (const [key, task] of tasks) {
    try {
      result[key] = await task();
    } catch (error) {
      console.error("[Order Status Notification Failed]", {
        orderReference: order.order_reference,
        status,
        channel: key === "emailSent" ? "customer_email" : "customer_whatsapp",
        reason: error instanceof Error ? error.message : "Unknown notification error",
      });
    }
  }

  return result;
}

export async function sendAdminOrderNotifications(order: NotificationOrderRow) {
  if (!notificationsEnabled()) return;

  const tasks: Array<[string, () => Promise<void>]> = [
    ["admin_email", () => sendAdminEmailNotification(order)],
    ["admin_whatsapp", () => sendAdminWhatsAppNotification(order)],
    ["customer_email", () => sendCustomerOrderConfirmation(order)],
  ];

  for (const [channel, task] of tasks) {
    try {
      await task();
    } catch (error) {
      console.error("[Order Notification Failed]", {
        orderReference: order.order_reference,
        channel,
        reason: error instanceof Error ? error.message : "Unknown notification error",
      });
    }
  }
}

export async function sendPaidOrderNotifications(orderId: string) {
  if (!notificationsEnabled()) return;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      order_reference,
      customer_name,
      customer_email,
      customer_phone,
      delivery_address,
      delivery_method,
      delivery_state,
      delivery_city,
      delivery_fee,
      total_amount,
      paystack_reference,
      order_status,
      admin_email_notified_at,
      admin_whatsapp_notified_at,
      customer_email_notified_at,
      order_items (
        product_name,
        quantity,
        unit,
        unit_price,
        total_price
      )
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("[Order Notification Load Failed]", { orderId, reason: error.message });
    return;
  }
  if (!data) return;

  await sendAdminOrderNotifications(data as unknown as NotificationOrderRow);
}
