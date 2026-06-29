import type { LucideIcon } from "lucide-react";

export type ProductMedia = {
  id: string;
  productId: string;
  mediaType: "image" | "video";
  url: string;
  storagePath?: string | null;
  altText?: string | null;
  caption?: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt?: string;
};

export type Product = {
  id?: string;
  slug: string;
  name: string;
  price: number;
  unit: string;
  stock: string;
  stockCount: number;
  minimumOrder: number;
  minimumUnit: string;
  category: string;
  availability: string;
  description: string;
  badge: string;
  status?: "active" | "inactive" | "coming_soon";
  availableFrom?: string | null;
  isFeatured?: boolean;
  featuredSortOrder?: number;
  isLiveAnimal?: boolean;
  isProcessed?: boolean;
  supportsWiderDelivery?: boolean;
  pricingMode?: "fixed" | "quote_required";
  isOrderableOnline?: boolean;
  displayPriceLabel?: string | null;
  media?: ProductMedia[];
  primaryMedia?: ProductMedia | null;
};

export type DeliveryZone = {
  id?: string;
  area: string;
  distanceKm: number;
  isActive?: boolean;
};

export type DeliverySettings = {
  fuelPricePerLitre: number;
  vehicleKmPerLitre: number;
  driverFlatFee: number;
  roundTripEnabled: boolean;
  rounding?: number;
};

export type DatabaseOrderStatus =
  | "pending_delivery_quote"
  | "pending_payment"
  | "paid"
  | "processing"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "payment_review"
  | "refunded";

export type DatabasePaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export type OrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  currentStock?: number | null;
};

export type Order = {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryZoneId: string | null;
  deliveryArea: string;
  deliveryMethod: "local_delivery" | "pickup" | "wider_delivery";
  deliveryState: string | null;
  deliveryCity: string | null;
  deliveryQuoteRequired: boolean;
  deliveryFeeConfirmed: boolean;
  deliveryDate: string;
  deliveryNote: string | null;
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentStatus: DatabasePaymentStatus;
  orderStatus: DatabaseOrderStatus;
  paystackReference: string | null;
  paymentProvider: string | null;
  paidAt: string | null;
  inventoryMovementCount: number;
  inventoryDeducted: boolean;
  createdAt: string;
  items: OrderItem[];
};

export type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  orderId: string | null;
  orderItemId: string | null;
  orderReference: string | null;
  movementType:
    | "stock_in"
    | "stock_out"
    | "order_reserved"
    | "order_cancelled"
    | "manual_adjustment";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  createdAt: string;
};

export type OrderStatus = "Pending" | "Paid" | "Preparing" | "Out for delivery";

export type PreviewOrder = {
  id: string;
  customer: string;
  phone: string;
  items: string;
  area: string;
  total: number;
  status: OrderStatus;
};

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type CartLine = {
  slug: string;
  quantity: number;
  product?: Product;
};
