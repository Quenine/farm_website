import {
  BarChart3,
  Boxes,
  CircleGauge,
  ClipboardList,
  FileText,
  Handshake,
  ListChecks,
  MapPin,
  MapPinned,
  Megaphone,
  PackageCheck,
  Settings,
} from "lucide-react";
import { contentPublicConfig } from "@/src/config/site";
import { formatNaira } from "@/src/lib/format";
import type {
  AdminNavItem,
  DeliverySettings,
  DeliveryZone,
  PreviewOrder,
  Product,
} from "@/src/types";

export const products: Product[] = [
  {
    slug: "live-broiler-chicken",
    name: "Live Broiler Chicken",
    price: 2650,
    unit: "kg",
    stock: "300 kg available",
    stockCount: 300,
    minimumOrder: 15,
    minimumUnit: "kg",
    category: "Broilers",
    availability: "Available now",
    description:
      "Healthy farm-raised broilers available for scheduled orders. Suitable for households, food vendors, restaurants, caterers, and bulk buyers.",
    badge: "Best for bulk kitchens",
    status: "active",
    isLiveAnimal: true,
    pricingMode: "fixed",
    isOrderableOnline: true,
  },
  {
    slug: "processed-whole-chicken",
    name: "Processed Whole Chicken",
    price: 3650,
    unit: "kg",
    stock: "90 kg available",
    stockCount: 90,
    minimumOrder: 20,
    minimumUnit: "kg",
    category: "Processed Birds",
    availability: "Available now",
    description:
      "Cleaned whole chicken prepared for convenient cooking, retail supply, events, and catering.",
    badge: "Ready to cook",
    status: "active",
    isProcessed: true,
    pricingMode: "fixed",
    isOrderableOnline: true,
  },
  {
    slug: "crate-of-eggs",
    name: "Crate of Eggs",
    price: 5000,
    unit: "crate",
    stock: "35 crates available weekly",
    stockCount: 35,
    minimumOrder: 5,
    minimumUnit: "crates",
    category: "Eggs",
    availability: "Weekly supply",
    description:
      "Fresh eggs packed in crates for homes, bakeries, food vendors, restaurants, and resellers.",
    badge: "Weekly harvest",
    status: "active",
    pricingMode: "fixed",
    isOrderableOnline: true,
  },
  {
    slug: "half-crate-of-eggs",
    name: "Half Crate of Eggs",
    price: 2500,
    unit: "half-crate",
    stock: "35 half-crates available weekly",
    stockCount: 35,
    minimumOrder: 5,
    minimumUnit: "half-crates",
    category: "Eggs",
    availability: "Weekly supply",
    description:
      "A practical egg pack for households, small kitchens, and regular buyers.",
    badge: "Compact pack",
    status: "active",
    pricingMode: "fixed",
    isOrderableOnline: true,
  },
  {
    slug: "old-layers",
    name: "Old Layers",
    price: 8600,
    unit: "bird",
    stock: "190 birds",
    stockCount: 190,
    minimumOrder: 10,
    minimumUnit: "birds",
    category: "Broilers",
    availability: "Available from December 2026",
    description:
      "Mature birds for customers who prefer firm, flavorful chicken for soups, stews, and local dishes. Availability may be seasonal.",
    badge: "Coming December",
    status: "coming_soon",
    availableFrom: "2026-12-01",
    isLiveAnimal: true,
    pricingMode: "fixed",
    isOrderableOnline: true,
  },
  {
    slug: "4-week-broilers",
    name: "4-Week Broilers",
    price: 0,
    unit: "bird",
    stock: "Confirm availability",
    stockCount: 0,
    minimumOrder: 1,
    minimumUnit: "bird",
    category: "Broilers",
    availability: "Confirm before ordering",
    description:
      "Young healthy broilers available for customers who want to continue rearing or purchase birds before table-size maturity.",
    badge: "Check Availability",
    status: "active",
    isLiveAnimal: true,
    pricingMode: "quote_required",
    isOrderableOnline: false,
    displayPriceLabel: "Check Availability",
  },
  {
    slug: "6-week-table-size-broilers",
    name: "6-Week Table-Size Broilers",
    price: 0,
    unit: "bird",
    stock: "Confirm availability",
    stockCount: 0,
    minimumOrder: 1,
    minimumUnit: "bird",
    category: "Broilers",
    availability: "Confirm before ordering",
    description:
      "Table-size broilers suitable for households, restaurants, caterers, food vendors, and bulk buyers.",
    badge: "Check Availability",
    status: "active",
    isLiveAnimal: true,
    pricingMode: "quote_required",
    isOrderableOnline: false,
    displayPriceLabel: "Check Availability",
  },
  ...[
    [
      "irish-potatoes",
      "Irish Potatoes",
      "Fresh Irish potatoes suitable for homes, restaurants, food vendors, and bulk kitchen supply.",
    ],
    [
      "bell-peppers",
      "Bell Peppers",
      "Fresh bell peppers supplied for cooking, food prep, restaurants, caterers, and resale.",
    ],
    [
      "onions",
      "Onions",
      "Fresh onions available for household cooking, food vendors, restaurants, and bulk buyers.",
    ],
    [
      "sweet-potatoes",
      "Sweet Potatoes",
      "Nutritious sweet potatoes supplied for homes, kitchens, food vendors, and resellers.",
    ],
    [
      "pepper-ata-rodo",
      "Pepper (Ata Rodo)",
      "Fresh Ata Rodo pepper for cooking, sauces, soups, stews, and food business supply.",
    ],
    [
      "carrots",
      "Carrots",
      "Fresh carrots suitable for meals, salads, juice preparation, restaurants, and produce resale.",
    ],
    [
      "cabbage",
      "Cabbage",
      "Fresh cabbage for homes, restaurants, caterers, salads, and bulk produce buyers.",
    ],
    [
      "broccoli",
      "Broccoli",
      "Fresh broccoli supplied for homes, healthy meals, restaurants, and produce buyers.",
    ],
    [
      "avocado",
      "Avocado",
      "Fresh avocados available for homes, food vendors, restaurants, and healthy meal preparation.",
    ],
    [
      "cucumber",
      "Cucumber",
      "Fresh cucumbers suitable for salads, meals, juice preparation, restaurants, and resale.",
    ],
    [
      "shombo-pepper",
      "Shombo Pepper",
      "Fresh Shombo pepper for stews, sauces, soups, and local food preparation.",
    ],
    [
      "cauliflower",
      "Cauliflower",
      "Fresh cauliflower supplied for homes, restaurants, healthy meals, and produce buyers.",
    ],
    [
      "basket-of-tomatoes",
      "Basket of Tomatoes",
      "Fresh tomatoes supplied by basket for homes, food vendors, restaurants, caterers, and market resellers.",
    ],
  ].map(([slug, name, description]) => ({
    slug,
    name,
    price: 0,
    unit: slug === "basket-of-tomatoes" ? "basket" : "unit",
    stock: "Confirm availability",
    stockCount: 0,
    minimumOrder: 1,
    minimumUnit: slug === "basket-of-tomatoes" ? "basket" : "unit",
    category: "Crop Produce",
    availability: "Confirm before ordering",
    description,
    badge: "Check Availability",
    status: "active" as const,
    pricingMode: "quote_required" as const,
    isOrderableOnline: false,
    displayPriceLabel: "Check Availability",
  })),
  {
    slug: "manure",
    name: "Manure",
    price: 1200,
    unit: "bag",
    stock: "10 bags available",
    stockCount: 10,
    minimumOrder: 3,
    minimumUnit: "bags",
    category: "Farm Inputs",
    availability: "Available now",
    description:
      "Organic poultry manure for gardens, farms, soil improvement, and crop production.",
    badge: "For growers",
    status: "active",
    pricingMode: "fixed",
    isOrderableOnline: true,
  },
];

export const cartItems = [
  { product: products[0], quantity: 15 },
  { product: products[2], quantity: 5 },
];

export const deliverySettings: DeliverySettings = {
  fuelPricePerLitre: 1325,
  vehicleKmPerLitre: 10,
  driverFlatFee: 2000,
  roundTripEnabled: true,
};

export const deliveryAreas: DeliveryZone[] = [
  { area: "Bodija", distanceKm: 8 },
  { area: "Akobo", distanceKm: 12 },
  { area: "Dugbe", distanceKm: 10 },
  { area: "Challenge", distanceKm: 14 },
  { area: "Ring Road", distanceKm: 13 },
  { area: "Eleyele", distanceKm: 11 },
  { area: "Moniya", distanceKm: 18 },
  { area: "Apata", distanceKm: 16 },
];

export const orders: PreviewOrder[] = [
  {
    id: "NF-1024",
    customer: "Tinu Adeyemi",
    phone: "0803 555 1144",
    items: "15 kg broiler, 5 egg crates",
    area: "Bodija",
    total: 68875,
    status: "Preparing",
  },
  {
    id: "NF-1023",
    customer: "Baker's Table",
    phone: "0812 440 9921",
    items: "12 egg crates",
    area: "Ring Road",
    total: 65000,
    status: "Out for delivery",
  },
  {
    id: "NF-1022",
    customer: "Iya Alata Foods",
    phone: "0706 212 7388",
    items: "25 kg processed chicken",
    area: "Challenge",
    total: 97450,
    status: "Paid",
  },
];

export const adminNav: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/products", label: "Products", icon: PackageCheck },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/delivery-rates", label: "Delivery Rates", icon: MapPin },
  { href: "/admin/delivery-coverage", label: "Delivery Coverage", icon: MapPinned },
  ...(contentPublicConfig.hubEnabled ? [{ href: "/admin/content", label: "Content", icon: FileText }] : []),
  ...(contentPublicConfig.affiliateEnabled ? [{ href: "/admin/affiliate", label: "Affiliate", icon: Handshake }] : []),
  { href: "/admin/marketing/campaigns", label: "Marketing", icon: Megaphone },
  { href: "/admin/launch-checklist", label: "Launch Checklist", icon: ListChecks },
  { href: "/admin/diagnostics", label: "Diagnostics", icon: CircleGauge },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export { formatNaira };

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}



