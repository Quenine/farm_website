import { NextRequest } from "next/server";
import { getActiveCampaignBySlug } from "@/src/lib/marketing-campaigns";
import { getSiteUrl } from "@/src/lib/site-url";

export const dynamic = "force-dynamic";

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

function svgCode(value: string) {
  const size = 29;
  const cell = 8;
  const quiet = 2;
  const full = (size + quiet * 2) * cell;
  const seed = hash(value);
  const finder = (x: number, y: number) => `<rect x="${(x + quiet) * cell}" y="${(y + quiet) * cell}" width="${7 * cell}" height="${7 * cell}" fill="#14532d"/><rect x="${(x + quiet + 1) * cell}" y="${(y + quiet + 1) * cell}" width="${5 * cell}" height="${5 * cell}" fill="#fff"/><rect x="${(x + quiet + 2) * cell}" y="${(y + quiet + 2) * cell}" width="${3 * cell}" height="${3 * cell}" fill="#14532d"/>`;
  const blocks: string[] = [finder(0, 0), finder(size - 7, 0), finder(0, size - 7)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inFinder = (x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8);
      if (inFinder) continue;
      const bit = (hash(`${value}:${x}:${y}:${seed}`) % 100) < 38;
      if (bit) blocks.push(`<rect x="${(x + quiet) * cell}" y="${(y + quiet) * cell}" width="${cell}" height="${cell}" fill="#14532d"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${full}" height="${full}" viewBox="0 0 ${full} ${full}" role="img"><title>Tracked campaign code</title><rect width="100%" height="100%" fill="#fff"/>${blocks.join("")}<text x="${full / 2}" y="${full - 8}" text-anchor="middle" font-family="Arial" font-size="10" fill="#14532d">${value.replace(/[<>&]/g, "")}</text></svg>`;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const campaign = await getActiveCampaignBySlug(slug);
  const url = `${getSiteUrl().replace(/\/$/, "")}/go/${campaign?.slug ?? slug}`;
  return new Response(svgCode(url), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-tracked-code.svg"`,
    },
  });
}

