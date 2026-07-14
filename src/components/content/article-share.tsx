"use client";

import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { trackShareContent } from "@/src/lib/content-analytics";

type Props = { title: string; text: string; canonicalUrl: string; slug: string };

function encoded(input: string) { return encodeURIComponent(input); }

export function ArticleShare({ title, text, canonicalUrl, slug }: Props) {
  const [message, setMessage] = useState("");
  const links = useMemo(() => {
    const url = encoded(canonicalUrl);
    const label = encoded(title);
    return {
      whatsapp: `https://wa.me/?text=${encoded(`${title} ${canonicalUrl}`)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      x: `https://twitter.com/intent/tweet?url=${url}&text=${label}`,
    };
  }, [canonicalUrl, title]);

  const copyLink = async (method = "copy") => {
    try {
      await navigator.clipboard?.writeText(canonicalUrl);
      setMessage("Article link copied.");
      trackShareContent(slug, method);
    } catch {
      setMessage("Copy failed. Select the URL from your browser address bar.");
    }
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: canonicalUrl });
        trackShareContent(slug, "native");
        return;
      }
      await copyLink("copy_fallback");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Share was not completed.");
    }
  };

  const track = (method: string) => trackShareContent(slug, method);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={nativeShare} aria-label={`Share ${title}`} className="inline-flex items-center gap-2 rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950">
        <Share2 size={16} /> Share
      </button>
      <a href={links.whatsapp} onClick={() => track("whatsapp")} target="_blank" rel="noopener noreferrer" aria-label={`Share ${title} on WhatsApp`} className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950">WhatsApp</a>
      <a href={links.facebook} onClick={() => track("facebook")} target="_blank" rel="noopener noreferrer" aria-label={`Share ${title} on Facebook`} className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950">Facebook</a>
      <a href={links.x} onClick={() => track("x")} target="_blank" rel="noopener noreferrer" aria-label={`Share ${title} on X`} className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950">X</a>
      <button type="button" onClick={() => copyLink("copy")} className="rounded-full border border-green-800 px-5 py-3 text-sm font-bold text-green-950">Copy Link</button>
      {message ? <span className="text-sm font-bold text-green-800" role="status">{message}</span> : null}
    </div>
  );
}