-- Ảnh xem trước (Open Graph 1200×630) của TRANG CHỦ dòng họ khi dán link /share/<mã> hoặc /xem/clans/<id> lên Facebook / Zalo.
-- Admin chọn kiểu + app dựng JPEG lưu ở bucket công khai card-shares (<clan>/clan-og-<ts>.jpg); function og-post (kind=clan) đọc.
-- Chưa đặt → og-post trả thẻ chung của ứng dụng (không lộ tên dòng họ).
alter table public.clans
  add column if not exists share_og_path text,
  add column if not exists share_og_style text,
  add column if not exists share_og_updated_at timestamptz;

comment on column public.clans.share_og_path is 'Đường dẫn ảnh OG trong bucket card-shares; null = dùng thẻ chung.';
comment on column public.clans.share_og_style is 'Kiểu ảnh OG đã chọn (classic | paper | crimson) để mở lại đúng kiểu khi chỉnh.';
