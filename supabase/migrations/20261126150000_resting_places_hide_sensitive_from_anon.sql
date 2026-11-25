-- Mộ phần: người ngoài dòng họ KHÔNG đọc thẳng bảng qua REST (toạ độ, địa chỉ, ghi chú).
--
-- Trước đây `resting_places_select` (role public) có nhánh "dòng họ công khai bật mục Mộ phần" → bất kỳ ai ĐÃ ĐĂNG NHẬP (kể cả tài khoản
-- tự đăng ký, không thuộc dòng họ) đọc được TOÀN BỘ cột mộ phần của họ đó, kể cả latitude, longitude, address, location_detail, notes — dù trang
-- dòng họ cố ý chỉ hiện tên, nơi, tình trạng, năm xây. (Khoá anon thì không đọc được: policy truy vấn bảng `clans` mà anon không có quyền SELECT.)
-- Nay (docs/bao-mat-trang-cong-khai.md, rủi ro 2): chỉ thành viên dòng họ và admin nền tảng đọc bảng; người ngoài xem mộ phần qua trang dòng họ
-- (edge function share-view, service role, đã bỏ toạ độ / địa chỉ). Anon bị thu hồi SELECT rõ ràng cho đỡ phụ thuộc vào một lỗi quyền gián tiếp.
-- Trang dòng họ / OG / MCP không bị ảnh hưởng (service role hoặc JWT thành viên).

drop policy if exists resting_places_select on public.resting_places;
create policy resting_places_select on public.resting_places for select to authenticated
  using (public.is_clan_member(clan_id) or public.is_platform_admin());

drop policy if exists rpo_select on public.resting_place_occupants;
create policy rpo_select on public.resting_place_occupants for select to authenticated
  using (public.is_clan_member(clan_id) or public.is_platform_admin());

drop policy if exists rpp_select on public.resting_place_photos;
create policy rpp_select on public.resting_place_photos for select to authenticated
  using (public.is_clan_member(clan_id) or public.is_platform_admin());

revoke select on public.resting_places, public.resting_place_occupants, public.resting_place_photos from anon;
