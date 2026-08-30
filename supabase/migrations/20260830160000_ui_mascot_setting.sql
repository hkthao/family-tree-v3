-- ============================================================================
-- Công tắc ẩn/hiện linh vật, đặt ở Quản trị › Cấu hình.
--
-- Đọc CÔNG KHAI như mọi khoá platform_settings khác — ở đây không sao,
-- nó chỉ là một cờ giao diện, không phải bí mật.
--
-- Mặc định 'true': app đang có linh vật, và một migration không nên âm
-- thầm đổi giao diện của mọi người.
-- ============================================================================

insert into public.platform_settings (key, value)
values ('ui.mascot_enabled', 'true')
on conflict (key) do nothing;
