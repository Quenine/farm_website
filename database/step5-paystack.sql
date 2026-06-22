-- Run this once in the Supabase SQL Editor for an existing Step 4 database.

alter type public.order_status add value if not exists 'payment_review';
commit;

alter table public.inventory_movements
  add column if not exists order_id uuid
    references public.orders(id) on delete set null,
  add column if not exists order_item_id uuid
    references public.order_items(id) on delete set null;

update public.inventory_movements movement
set order_id = orders.id
from public.orders orders
where movement.order_id is null
  and movement.reason in (
    'Paystack payment confirmed for order ' || orders.order_reference,
    'Payment confirmed for order ' || orders.order_reference
  );

update public.inventory_movements movement
set order_item_id = items.id
from public.order_items items
where movement.order_item_id is null
  and movement.order_id = items.order_id
  and movement.product_id = items.product_id;

update public.inventory_movements
set quantity = abs(quantity)
where movement_type = 'stock_out'
  and quantity < 0;

create index if not exists inventory_movements_order_created_idx
  on public.inventory_movements(order_id, created_at desc);

create unique index if not exists inventory_movements_paid_order_item_uidx
  on public.inventory_movements(order_item_id)
  where order_item_id is not null
    and movement_type = 'stock_out';

create or replace function public.process_paystack_payment(
  p_order_id uuid,
  p_reference text,
  p_amount numeric,
  p_paid_at timestamptz,
  p_raw_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_insufficient boolean := false;
  v_expected_movements integer := 0;
  v_movement_count integer := 0;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.paystack_reference is distinct from p_reference
    and not exists (
      select 1 from public.payments
      where reference = p_reference and order_id = p_order_id
    ) then
    raise exception 'Paystack reference does not belong to this order';
  end if;

  if v_order.total_amount <> p_amount then
    raise exception 'Payment amount does not match order total';
  end if;

  if exists (
    select 1 from public.payments
    where reference = p_reference and order_id <> p_order_id
  ) then
    raise exception 'Paystack reference is linked to another order';
  end if;

  select count(*)
  into v_expected_movements
  from public.order_items
  where order_id = p_order_id
    and product_id is not null;

  select count(*)
  into v_movement_count
  from public.inventory_movements
  where order_id = p_order_id
    and movement_type = 'stock_out';

  if exists (
    select 1 from public.payments
    where reference = p_reference and status = 'paid'
  ) or v_order.payment_status = 'paid' then
    return jsonb_build_object(
      'processed', false,
      'already_processed', true,
      'needs_review', v_order.order_status = 'payment_review',
      'inventory_deducted',
        v_expected_movements > 0
        and v_movement_count = v_expected_movements,
      'movement_count', v_movement_count
    );
  end if;

  if v_movement_count > 0 then
    raise exception 'Inventory movements already exist for unpaid order';
  end if;

  for v_item in
    select
      oi.id as order_item_id,
      oi.product_id,
      oi.quantity,
      p.stock_quantity
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
    order by oi.product_id
    for update of p
  loop
    if v_item.stock_quantity < v_item.quantity then
      v_insufficient := true;
    end if;
  end loop;

  insert into public.payments (
    order_id, provider, reference, amount, status, paid_at, raw_response
  )
  values (
    p_order_id, 'paystack', p_reference, p_amount, 'paid', p_paid_at,
    p_raw_response
  )
  on conflict (reference) do update
  set amount = excluded.amount,
      status = 'paid',
      paid_at = excluded.paid_at,
      raw_response = excluded.raw_response
  where public.payments.order_id = excluded.order_id;

  if v_insufficient then
    update public.orders
    set payment_status = 'paid', order_status = 'payment_review'
    where id = p_order_id;

    return jsonb_build_object(
      'processed', true,
      'already_processed', false,
      'needs_review', true,
      'inventory_deducted', false,
      'movement_count', 0
    );
  end if;

  for v_item in
    select
      oi.id as order_item_id,
      oi.product_id,
      oi.quantity,
      p.stock_quantity
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
    order by oi.product_id
    for update of p
  loop
    update public.products
    set stock_quantity = v_item.stock_quantity - v_item.quantity
    where id = v_item.product_id;

    insert into public.inventory_movements (
      product_id,
      order_id,
      order_item_id,
      movement_type,
      quantity,
      previous_quantity,
      new_quantity,
      reason
    )
    values (
      v_item.product_id,
      p_order_id,
      v_item.order_item_id,
      'stock_out',
      v_item.quantity,
      v_item.stock_quantity,
      v_item.stock_quantity - v_item.quantity,
      'Payment confirmed for order ' || v_order.order_reference
    );
  end loop;

  update public.orders
  set payment_status = 'paid', order_status = 'processing'
  where id = p_order_id;

  return jsonb_build_object(
    'processed', true,
    'already_processed', false,
    'needs_review', false,
    'inventory_deducted', true,
    'movement_count', v_expected_movements
  );
end;
$$;

revoke all on function public.process_paystack_payment(
  uuid, text, numeric, timestamptz, jsonb
) from public;
grant execute on function public.process_paystack_payment(
  uuid, text, numeric, timestamptz, jsonb
) to service_role;
