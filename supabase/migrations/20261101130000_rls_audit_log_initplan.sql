-- Cùng cách tối ưu như 20261101120000 cho audit_log: bảng lớn nhất (hàng chục nghìn dòng) và bị
-- bảng điều khiển "Hoạt động gần đây" truy vấn liên tục (kèm đếm toàn bộ dòng của dòng họ), nên gọi
-- is_clan_member() cho từng dòng làm nghẽn máy 1 CPU (19 truy vấn song song mỗi cái ~7 giây).
-- Ngữ nghĩa giữ nguyên: thành viên (không bị khoá) của clan hoặc platform admin.
alter policy audit_log_member_select on public.audit_log
  using ((select public.is_platform_admin()) or clan_id in (select public.my_clan_ids()));
