"use client";

import { MessageCircle } from "lucide-react";
import { trackLead } from "@/src/lib/analytics";

export function BusinessSupplyWhatsappCta({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackLead("business_supply_whatsapp")}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-green-800 px-6 text-sm font-bold text-green-950"
    >
      <MessageCircle size={17} />
      Contact on WhatsApp
    </a>
  );
}
