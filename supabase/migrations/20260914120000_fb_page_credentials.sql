-- ============================================================================
-- fb_page_credentials — Page token của Facebook, lưu ở dạng ĐÃ MÃ HOÁ, để
-- admin tự cắm trong app thay vì phải ssh vào máy chủ sửa biến môi trường.
--
-- ⚠️ TUYỆT ĐỐI KHÔNG để trong platform_settings: bảng đó `using (true)`, tức
-- ĐỌC CÔNG KHAI — cắm token vào đó là tặng cả cái Trang cho mọi khách vãng
-- lai. Bảng này đi theo khuôn ai_provider_keys: RLS bật và KHÔNG CÓ POLICY
-- NÀO, nên kể cả platform admin cũng không select được qua PostgREST. Chỉ
-- service role (edge function) đọc nổi.
--
-- Mã hoá AES-256-GCM bằng đúng KEK của khoá AI (AI_KEY_ENCRYPTION_KEY) —
-- dùng lại thay vì đẻ thêm một bí mật nữa phải quản.
--
-- KHÔNG lưu App Secret. Nó chỉ dùng đúng một lần lúc đổi token ngắn sang
-- token dài rồi bỏ; thứ gì không cần giữ thì đừng giữ.
-- ============================================================================

create table public.fb_page_credentials (
  page_id          text primary key,
  page_name        text,
  ciphertext       text not null,        -- base64(iv || Page token đã mã hoá)
  hint             text not null,        -- '••••a1b2' để admin nhận ra token nào
  -- null = token không hết hạn (Page token sinh từ user token dài hạn).
  token_expires_at timestamptz,
  -- Trang đang dùng cho podcast. Một Trang thôi, nhưng để cờ cho dễ đổi.
  is_active        boolean not null default true,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id) on delete set null,

  -- Kết quả lần kiểm tra kết nối gần nhất.
  last_check_at    timestamptz,
  last_check_ok    boolean,
  last_check_error text
);

alter table public.fb_page_credentials enable row level security;

-- Không khai policy nào — xem phần đầu file. Đây là chủ ý, không phải thiếu sót.
revoke all on public.fb_page_credentials from anon, authenticated;

comment on table public.fb_page_credentials is
  'Page token Facebook, đã mã hoá AES-GCM. Không có RLS policy — chỉ service role đọc được.';

-- ─── Metadata cho màn hình quản trị ───────────────────────────────────
-- Admin cần biết "đã nối Trang nào, token còn sống không" mà KHÔNG cần thấy
-- token. Hàm này trả đúng chừng đó.
create or replace function public.fb_page_credentials_status()
  returns table (
    page_id          text,
    page_name        text,
    hint             text,
    token_expires_at timestamptz,
    is_active        boolean,
    updated_at       timestamptz,
    last_check_at    timestamptz,
    last_check_ok    boolean,
    last_check_error text
  )
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Chỉ quản trị nền tảng xem được' using errcode = '42501';
  end if;

  return query
    select c.page_id, c.page_name, c.hint, c.token_expires_at, c.is_active,
           c.updated_at, c.last_check_at, c.last_check_ok, c.last_check_error
    from public.fb_page_credentials c
    order by c.is_active desc, c.page_name;
end;
$$;

revoke execute on function public.fb_page_credentials_status() from public, anon;
grant execute on function public.fb_page_credentials_status() to authenticated;
