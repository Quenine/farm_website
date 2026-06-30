import type {
  DatabaseOrderStatus,
  DatabasePaymentStatus,
} from "@/src/types";

const orderLabels: Record<DatabaseOrderStatus, string> = {
  pending_delivery_quote: "Delivery Arrangement Needed",
  pending_payment: "Pending Payment",
  paid: "Paid",
  processing: "Processing",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_review: "Payment Review",
  refunded: "Refunded",
};

const paymentLabels: Record<DatabasePaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

export function formatOrderStatus(status: DatabaseOrderStatus) {
  return orderLabels[status];
}

export function formatPaymentStatus(status: DatabasePaymentStatus) {
  return paymentLabels[status];
}

export function formatOrderDate(date: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
