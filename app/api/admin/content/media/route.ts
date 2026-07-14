import { NextResponse } from "next/server";
import { ensureContentAdmin } from "@/src/lib/content-admin";
import { createContentAdminSupabaseClient } from "@/src/lib/supabase/content-admin-server";

export const dynamic = "force-dynamic";

const contentImageTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const contentImageMaxBytes = 5 * 1024 * 1024;

function failure(message: string, fieldErrors?: Record<string, string[]>, status = 400) {
  return NextResponse.json({ ok: false, message, fieldErrors }, { status });
}

function safeFileName(name: string) {
  return name.replace(/.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "content-image";
}

export async function POST(request: Request) {
  try {
    await ensureContentAdmin("posts");
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) return failure("Choose an image file to upload.", { image: ["Choose an image file to upload."] });
    const extension = contentImageTypes[file.type];
    if (!extension) return failure("Upload a JPEG, PNG, or WebP image. SVG files are not allowed.", { image: ["Upload a JPEG, PNG, or WebP image. SVG files are not allowed."] });
    if (file.size <= 0) return failure("The selected image is empty.", { image: ["The selected image is empty."] });
    if (file.size > contentImageMaxBytes) return failure("Image must be 5MB or smaller.", { image: ["Image must be 5MB or smaller."] });

    const supabase = createContentAdminSupabaseClient();
    const storagePath = `content/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeFileName(file.name)}.${extension}`;
    const { error } = await supabase.storage.from("content-media").upload(storagePath, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) {
      const missing = /bucket|not found|does not exist/i.test(error.message);
      return failure(missing ? "The content-media storage bucket is missing." : error.message, { image: [missing ? "The content-media storage bucket is missing." : error.message] }, missing ? 503 : 400);
    }
    const { data } = supabase.storage.from("content-media").getPublicUrl(storagePath);
    if (!data.publicUrl) return failure("Public media URL generation failed.", { image: ["Public media URL generation failed."] }, 500);
    return NextResponse.json({ ok: true, message: "Image uploaded.", media: { url: data.publicUrl, path: storagePath, mimeType: file.type, size: file.size } });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to upload image.", undefined, 500);
  }
}
