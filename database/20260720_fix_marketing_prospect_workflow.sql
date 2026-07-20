-- Commercial Operations Batch 4.1B: reconcile and atomically operate the prospect workflow.
-- Repeat-safe. Does not touch orders, revenue, inventory, checkout, payments, delivery, or attribution.

create table if not exists public.marketing_prospect_activities (id uuid);
alter table public.marketing_prospect_activities add column if not exists prospect_id uuid;
alter table public.marketing_prospect_activities add column if not exists activity_type text;
alter table public.marketing_prospect_activities add column if not exists stage_from text;
alter table public.marketing_prospect_activities add column if not exists stage_to text;
alter table public.marketing_prospect_activities add column if not exists summary text;
alter table public.marketing_prospect_activities add column if not exists occurred_at timestamptz;
alter table public.marketing_prospect_activities add column if not exists next_follow_up_at timestamptz;
alter table public.marketing_prospect_activities add column if not exists created_by uuid;
alter table public.marketing_prospect_activities add column if not exists created_at timestamptz;

alter table public.marketing_prospect_activities alter column id set default gen_random_uuid();
alter table public.marketing_prospect_activities alter column occurred_at set default now();
alter table public.marketing_prospect_activities alter column created_at set default now();
update public.marketing_prospect_activities set occurred_at=coalesce(occurred_at,created_at,now()),created_at=coalesce(created_at,occurred_at,now()) where occurred_at is null or created_at is null;
alter table public.marketing_prospect_activities alter column id set not null;
alter table public.marketing_prospect_activities alter column prospect_id set not null;
alter table public.marketing_prospect_activities alter column activity_type set not null;
alter table public.marketing_prospect_activities alter column summary set not null;
alter table public.marketing_prospect_activities alter column occurred_at set not null;
alter table public.marketing_prospect_activities alter column created_at set not null;

do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.marketing_prospect_activities'::regclass and contype='p') then
    alter table public.marketing_prospect_activities add constraint marketing_prospect_activities_pkey primary key(id);
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.marketing_prospect_activities'::regclass and contype='f' and confrelid='public.marketing_prospects'::regclass) then
    alter table public.marketing_prospect_activities add constraint marketing_prospect_activities_prospect_id_fkey foreign key(prospect_id) references public.marketing_prospects(id) on delete cascade;
  end if;
end $$;

alter table public.marketing_prospect_activities drop constraint if exists marketing_prospect_activities_activity_type_check;
alter table public.marketing_prospect_activities add constraint marketing_prospect_activities_activity_type_check check(activity_type in ('note','phone_call','whatsapp','email','meeting','proposal_sent','quotation_sent','follow_up','stage_change','trial_order','won','lost'));
alter table public.marketing_prospect_activities drop constraint if exists marketing_prospect_activities_stage_from_check;
alter table public.marketing_prospect_activities add constraint marketing_prospect_activities_stage_from_check check(stage_from is null or stage_from in ('identified','contacted','responded','requirements_received','proposal_sent','negotiating','trial_order','recurring_customer','won','lost'));
alter table public.marketing_prospect_activities drop constraint if exists marketing_prospect_activities_stage_to_check;
alter table public.marketing_prospect_activities add constraint marketing_prospect_activities_stage_to_check check(stage_to is null or stage_to in ('identified','contacted','responded','requirements_received','proposal_sent','negotiating','trial_order','recurring_customer','won','lost'));
alter table public.marketing_prospect_activities drop constraint if exists marketing_prospect_activities_summary_check;
alter table public.marketing_prospect_activities add constraint marketing_prospect_activities_summary_check check(char_length(trim(summary)) between 1 and 2000);

create index if not exists marketing_prospect_activities_prospect_occurred_idx on public.marketing_prospect_activities(prospect_id,occurred_at desc);
alter table public.marketing_prospect_activities enable row level security;
revoke all on public.marketing_prospect_activities from public,anon,authenticated;
grant select,insert,update,delete on public.marketing_prospect_activities to service_role;

create or replace function public.change_marketing_prospect_stage(p_prospect_id uuid,p_stage text,p_summary text,p_created_by uuid)
returns table(previous_stage text,new_stage text,changed boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_previous text; v_type text;
begin
  if p_stage is null or p_stage not in ('identified','contacted','responded','requirements_received','proposal_sent','negotiating','trial_order','recurring_customer','won','lost') then raise exception using errcode='22023',message='invalid prospect stage'; end if;
  select stage into v_previous from public.marketing_prospects where id=p_prospect_id for update;
  if not found then raise exception using errcode='P0002',message='prospect not found'; end if;
  if v_previous=p_stage then return query select v_previous,p_stage,false; return; end if;
  update public.marketing_prospects set stage=p_stage,updated_at=now() where id=p_prospect_id;
  v_type=case when p_stage='won' then 'won' when p_stage='lost' then 'lost' when p_stage='trial_order' then 'trial_order' else 'stage_change' end;
  insert into public.marketing_prospect_activities(prospect_id,activity_type,stage_from,stage_to,summary,occurred_at,created_by) values(p_prospect_id,v_type,v_previous,p_stage,coalesce(nullif(trim(p_summary),''),'Stage changed from '||v_previous||' to '||p_stage||'.'),now(),p_created_by);
  return query select v_previous,p_stage,true;
end $$;

create or replace function public.record_marketing_prospect_activity(p_prospect_id uuid,p_activity_type text,p_summary text,p_occurred_at timestamptz,p_next_follow_up_at timestamptz,p_created_by uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_occurred timestamptz:=coalesce(p_occurred_at,now());
begin
  if p_activity_type is null or p_activity_type not in ('note','phone_call','whatsapp','email','meeting','proposal_sent','quotation_sent','follow_up','trial_order') then raise exception using errcode='22023',message='invalid activity type'; end if;
  if nullif(trim(p_summary),'') is null then raise exception using errcode='22023',message='activity summary required'; end if;
  perform 1 from public.marketing_prospects where id=p_prospect_id for update;
  if not found then raise exception using errcode='P0002',message='prospect not found'; end if;
  insert into public.marketing_prospect_activities(prospect_id,activity_type,summary,occurred_at,next_follow_up_at,created_by) values(p_prospect_id,p_activity_type,p_summary,v_occurred,p_next_follow_up_at,p_created_by) returning id into v_id;
  update public.marketing_prospects set last_contact_at=case when p_activity_type in ('phone_call','whatsapp','email','meeting','follow_up') then v_occurred else last_contact_at end,assigned_follow_up_at=coalesce(p_next_follow_up_at,assigned_follow_up_at),updated_at=now() where id=p_prospect_id;
  return v_id;
end $$;

create or replace function public.complete_marketing_prospect_follow_up(p_prospect_id uuid,p_summary text,p_created_by uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
  perform 1 from public.marketing_prospects where id=p_prospect_id for update;
  if not found then raise exception using errcode='P0002',message='prospect not found'; end if;
  insert into public.marketing_prospect_activities(prospect_id,activity_type,summary,occurred_at,created_by) values(p_prospect_id,'follow_up',coalesce(nullif(trim(p_summary),''),'Scheduled follow-up completed.'),now(),p_created_by) returning id into v_id;
  update public.marketing_prospects set assigned_follow_up_at=null,last_contact_at=now(),updated_at=now() where id=p_prospect_id;
  return v_id;
end $$;

revoke all on function public.change_marketing_prospect_stage(uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.complete_marketing_prospect_follow_up(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.change_marketing_prospect_stage(uuid,text,text,uuid) to service_role;
grant execute on function public.record_marketing_prospect_activity(uuid,text,text,timestamptz,timestamptz,uuid) to service_role;
grant execute on function public.complete_marketing_prospect_follow_up(uuid,text,uuid) to service_role;
notify pgrst,'reload schema';
