-- Nâng statement_timeout cho service_role để thao tác hàng loạt (import
-- gia phả lớn) không bị giết giữa chừng.
--
-- Lý do: admin_import_giapha có `set local statement_timeout = 0`, nhưng
-- SET LOCAL bên trong function KHÔNG vô hiệu được timeout đã "lên cò"
-- cho chính câu lệnh gọi function (timeout được set khi câu lệnh bắt
-- đầu, trước khi vào thân hàm). Vì vậy phải đặt ở CẤP ROLE — áp dụng
-- ngay khi mở kết nối, trước mọi câu lệnh.
--
-- service_role chỉ dùng ở phía server (Edge Functions / admin), đã tin
-- cậy. Đặt 600s (việc import thực tế ~2s; 600s là dư thừa an toàn, vẫn
-- nhỏ hơn giới hạn wall-clock của Edge Function).

alter role service_role set statement_timeout = '600s';
