# Supabase Storage: product-media

Noble Farms product media is stored in a Supabase Storage bucket named `product-media` and referenced from the `public.product_media` table.

## Bucket

Create a bucket:

- Name: `product-media`
- Public read: enabled
- File size guidance:
  - Images: up to 5MB
  - Videos: up to 5MB

Allowed content types in the admin upload actions:

- Images: `image/jpeg`, `image/png`, `image/webp`
- Videos: `video/mp4`, `video/webm`

## Access model

- Public users only receive public media URLs for products that are visible in the shop.
- Admin upload/delete/reorder operations go through server actions using the Supabase service role key server-side.
- The service role key must never be exposed to client components or browser code.

## Recommended Storage policies

If the bucket is public, public read is handled by Supabase Storage public URLs. Keep writes restricted to trusted server-side admin code.

Do not add anonymous upload/update/delete policies for this bucket.

## Migration note

`public.product_media` is the preferred table. Existing `public.product_images` records are copied into `product_media` by `database/seed-full-catalogue.sql` so older image data is not lost.