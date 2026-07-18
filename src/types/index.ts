import type { LucideIcon } from "lucide-react";

export type DeliveryMethod = "home_delivery" | "pickup_point" | "farm_pickup";

export type DeliveryClass =
  | "standard"
  | "fragile"
  | "perishable"
  | "fragile_produce"
  | "heavy_produce"
  | "live_animal"
  | "fresh_food"
  | "bulky_farm_input";

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
  stockAlertThreshold?: number | null;
  minimumOrder: number;
  minimumUnit: string;
  quantityStep?: number;
  quantityInputType?: "whole" | "decimal";
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
  deliveryClass?: DeliveryClass;
  deliveryUnitValue?: number;
  handlingFee?: number;
  supportsHomeDelivery?: boolean;
  supportsPickupPoint?: boolean;
  supportsFarmPickup?: boolean;
  requiresDeliveryConfirmation?: boolean;
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

export type DeliveryRate = {
  id?: string;
  state: string;
  city: string;
  deliveryMethod: DeliveryMethod;
  baseFee: number;
  baseDeliveryUnits: number;
  extraFeePerUnit: number;
  estimatedDeliveryTime?: string | null;
  isActive: boolean;
  sortOrder: number;
};
export type ProductDeliveryRate = {
  id?: string;
  productId: string;
  productName?: string;
  productSlug?: string;
  state: string;
  city: string;
  deliveryMethod: DeliveryMethod;
  packageSize: number;
  firstPackageFee: number;
  extraPackageFee: number;
  estimatedDeliveryTime?: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type DeliveryRateBreakdownLine = {
  productName: string;
  quantity: number;
  packageSize: number;
  packageCount: number;
  firstPackageFee: number;
  extraPackageFee: number;
  isBaseLine: boolean;
  lineDeliveryCharge: number;
  matchingRateSource?: "exact" | "all_city_fallback" | "missing";
};

export type DeliveryRateBreakdown = {
  model: "product_rate";
  state: string;
  city: string;
  deliveryMethod: DeliveryMethod;
  estimatedDeliveryTime?: string | null;
  lines: DeliveryRateBreakdownLine[];
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
  deliveryMethod: DeliveryMethod;
  deliveryState: string | null;
  deliveryCity: string | null;
  deliveryRateId: string | null;
  deliveryUnits: number;
  handlingFee: number;
  deliveryPricingModel: "product_rate" | "legacy_rate" | string;
  deliveryPackageCount: number;
  deliveryRateBreakdown: DeliveryRateBreakdown | null;
  estimatedDeliveryTime: string | null;
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




