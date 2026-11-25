-- Thiệp khoe: thôi cho khách đọc thẳng bảng / liệt kê kho ảnh (rà soát bảo mật trước khi deploy trang công khai).
--
-- Trước đây `card_shares_public_read` cho BẤT KỲ AI có khoá anon (khoá công khai) đọc mọi thiệp còn hạn của mọi dòng họ
-- (kể cả `token`, tiêu đề, đường dẫn ảnh) → liệt kê được cả danh sách thiệp, token bí mật mất tác dụng; policy storage cho mọi
-- người đã đăng nhập liệt kê / ghi đè ảnh của dòng họ khác. Nay trang /khoe/:token đọc qua share-view?khoe= (service role,
-- chỉ thiệp còn hạn), og-khoe cũng service role, còn ảnh phục vụ qua URL công khai của bucket (không cần policy).
--
-- Sau migration: chỉ người tạo thiệp / người sửa được dòng họ đọc bảng (Trung tâm chia sẻ); chỉ thành viên dòng họ tải / ghi đè
-- ảnh trong thư mục `<clan_id>/` của họ. THỨ TỰ DEPLOY: bản web mới (KhoeCard đọc qua function) + function share-view TRƯỚC.

drop policy if exists card_shares_public_read on public.card_shares;
drop policy if exists card_shares_manager_read on public.card_shares;
create policy card_shares_manager_read
  on public.card_shares for select
  to authenticated
  using (created_by = (select auth.uid()) or public.can_edit_clan(clan_id));

-- Ảnh: tên đối tượng dạng `<clan_id>/<token>.png` (hoặc `-og.jpg`); thư mục đầu phải là UUID dòng họ mà người dùng là thành viên.
create or replace function public.card_shares_object_clan_member(object_name text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select case
      when (storage.foldername(object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.is_clan_member(((storage.foldername(object_name))[1])::uuid)
      else false
    end
  $$;
revoke all on function public.card_shares_object_clan_member(text) from public, anon;
grant execute on function public.card_shares_object_clan_member(text) to authenticated;

drop policy if exists "card-shares select auth" on storage.objects;
drop policy if exists "card-shares insert auth" on storage.objects;
drop policy if exists "card-shares update auth" on storage.objects;
drop policy if exists "card-shares select member" on storage.objects;
drop policy if exists "card-shares insert member" on storage.objects;
drop policy if exists "card-shares update member" on storage.objects;
create policy "card-shares select member" on storage.objects for select to authenticated
  using (bucket_id = 'card-shares' and public.card_shares_object_clan_member(name));
create policy "card-shares insert member" on storage.objects for insert to authenticated
  with check (bucket_id = 'card-shares' and public.card_shares_object_clan_member(name));
create policy "card-shares update member" on storage.objects for update to authenticated
  using (bucket_id = 'card-shares' and public.card_shares_object_clan_member(name))
  with check (bucket_id = 'card-shares' and public.card_shares_object_clan_member(name));
