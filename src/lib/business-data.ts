import {
  BarChart3,
  Boxes,
  CircleGauge,
  ClipboardList,
  MapPin,
  PackageCheck,
  Settings,
} from "lucide-react";
import { formatNaira } from "@/src/lib/format";
import type {
  AdminNavItem,
  DeliverySettings,
  DeliveryZone,
  MockOrder,
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
  },
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

export const orders: MockOrder[] = [
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
  { href: "/admin/delivery-zones", label: "Delivery Zones", icon: MapPin },
  { href: "/admin/diagnostics", label: "Diagnostics", icon: CircleGauge },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export { formatNaira };

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}
