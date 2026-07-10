export function formatProductUnit(unit: string) {
  return unit.trim().replaceAll("_", " ").replaceAll("-", " ");
}

export function normalizeProductUnitKey(unit: string) {
  return unit.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function pluralizeProductUnit(unit: string, quantity: number) {
  const label = formatProductUnit(unit);
  if (label === "kg") return "kg";
  if (quantity === 1) return label;

  const irregular: Record<string, string> = {
    "half crate": "half crates",
    "custard rubber": "custard rubbers",
    "farmers basket": "farmers baskets",
    "big paint": "big paints",
    "big rubber": "big rubbers",
  };

  return irregular[label] ?? `${label}s`;
}