export const adminEntityDefinitions = {
  authors: { table: 'content_authors', select: 'id,name,slug,role_title,bio,avatar_url,avatar_alt,credentials_or_experience,is_active,updated_at,deleted_at,deleted_by', trash: true },
  categories: { table: 'content_categories', select: 'id,name,slug,description,seo_title,seo_description,sort_order,is_active,updated_at,deleted_at,deleted_by', trash: true },
  tags: { table: 'content_tags', select: 'id,name,slug,description,is_active,updated_at,deleted_at,deleted_by', trash: true },
  sources: { table: 'content_sources', select: 'id,title,publisher,url,source_type,publication_date,accessed_at,is_primary_source,internal_note,is_active,updated_at,deleted_at,deleted_by', trash: true },
  posts: { table: 'content_posts', select: 'id,title,slug,excerpt,status,content_format,post_type,audience_scope,contains_affiliate_content,is_featured,published_at,updated_at,deleted_at,deleted_by,content_categories(name,slug),content_authors(name,slug)', trash: true },
  partners: { table: 'affiliate_partners', select: 'id,name,slug,website_url,affiliate_network,default_disclosure,internal_notes,is_active,updated_at,deleted_at,deleted_by', trash: true },
  offers: { table: 'affiliate_offers', select: 'id,partner_id,title,slug,short_description,destination_url,image_url,image_alt,button_label,display_price,currency,price_last_checked_at,available_regions,recommendation_basis,is_featured,is_active,internal_commission_note,updated_at,deleted_at,deleted_by,affiliate_partners(name,slug)', trash: true },
  videos: { table: 'content_videos', select: 'id,post_id,platform,external_video_id,embed_url,watch_url,title,description,thumbnail_url,thumbnail_alt,duration_seconds,upload_date,transcript_markdown,chapters,is_active,updated_at,deleted_at,deleted_by,content_posts(title,slug)', trash: true },
  subscribers: { table: 'content_subscribers', select: 'id,email,status,source_path,subscription_topic,consented_at,unsubscribed_at,created_at,updated_at', trash: false },
};

export function supportsTrash(entity) {
  return adminEntityDefinitions[entity]?.trash === true;
}
