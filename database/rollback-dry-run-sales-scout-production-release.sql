-- Non-destructive rollback rehearsal. Exercises reversible DDL inside a transaction.
begin;
drop function if exists public.record_sales_scout_outreach_outcome(uuid,text,text,text,timestamptz,uuid);
drop function if exists public.approve_sales_scout_outreach_draft(uuid,text,uuid);
drop function if exists public.save_sales_scout_outreach_draft(uuid,uuid,smallint,text,uuid);
drop function if exists public.apply_sales_scout_capture_evidence(uuid,jsonb,uuid);
drop function if exists public.fail_sales_scout_research_run(uuid,text,text,uuid);
drop function if exists public.complete_sales_scout_research_run(uuid,jsonb,uuid);
drop function if exists public.start_sales_scout_research_run(uuid,text[],integer,integer,uuid);
drop function if exists public.save_sales_scout_campaign(uuid,jsonb,uuid);
alter table public.marketing_sales_scout_discovery_candidates drop column if exists contact_evidence;
alter table public.marketing_sales_scout_discovery_runs drop column if exists research_method;
alter table public.marketing_sales_scout_campaigns drop column if exists max_enrichment_candidates;
rollback;
