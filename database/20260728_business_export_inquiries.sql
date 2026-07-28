-- Extend the server-managed contact inquiry audit for structured business/export leads.
begin;
alter table public.contact_inquiries
  add column if not exists company_name text,
  add column if not exists inquiry_details jsonb;
alter table public.contact_inquiries drop constraint if exists contact_inquiries_inquiry_type_check;
alter table public.contact_inquiries add constraint contact_inquiries_inquiry_type_check
  check (inquiry_type in ('product_availability','order_support','bulk_business_supply','export_supply','delivery_question','partnership','other'));
comment on column public.contact_inquiries.inquiry_details is
  'Structured, server-validated business or export enquiry requirements and consented campaign attribution.';
alter table public.contact_inquiries enable row level security;
revoke all on public.contact_inquiries from anon, authenticated;
commit;
