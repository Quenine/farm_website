import { formatNaira } from "@/src/lib/format";

export function CartSummary({
  subtotal,
  deliveryFee,
  deliveryFeeLabel,
}: {
  subtotal: number;
  deliveryFee?: number;
  deliveryFeeLabel?: string;
}) {
  const total = subtotal + (deliveryFee ?? 0);

  return (
    <div className="rounded-lg bg-green-950 p-6 text-white shadow-sm">
      <h2 className="text-xl font-bold">Cart summary</h2>
      <div className="mt-5 grid gap-3 text-sm">
        <div className="flex justify-between">
          <span className="text-green-100">Subtotal</span>
          <span className="font-bold">{formatNaira(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-green-100">Estimated delivery</span>
          <span className="font-bold">
            {deliveryFeeLabel ?? (deliveryFee === undefined ? "Select at checkout" : formatNaira(deliveryFee))}
          </span>
        </div>
        <div className="flex justify-between border-t border-white/20 pt-4 text-base">
          <span className="font-bold">Total</span>
          <span className="font-bold">{formatNaira(total)}</span>
        </div>
      </div>
    </div>
  );
}
