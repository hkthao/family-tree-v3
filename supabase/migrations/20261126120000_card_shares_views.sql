-- Thiệp khoe: đếm lượt xem + chỗ lưu ảnh OG riêng (docs/plan-thiep-khoe-design.md, mục 4.1 / 4.3).
-- Khách (anon) KHÔNG được update bảng; lượt xem tăng qua hàm security definer chỉ đụng đúng hai cột đếm và chỉ khi thiệp còn hạn.

alter table public.card_shares
  add column if not exists view_count int not null default 0,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists og_image_path text;

create or replace function public.khoe_register_view(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.card_shares
     set view_count = view_count + 1, last_viewed_at = now()
   where token = p_token and expires_at > now();
$$;

revoke all on function public.khoe_register_view(text) from public;
grant execute on function public.khoe_register_view(text) to anon, authenticated;
