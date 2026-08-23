-- ============================================================================
-- ai_provider_keys — khoá API của nhà cung cấp AI, lưu ở dạng ĐÃ MÃ HOÁ.
--
-- Trước đây plan chốt để khoá trong env (docker-compose.override.yml). Đổi
-- sang đây để admin tự cắm và kiểm tra kết nối trong app, không phải ssh.
--
-- ⚠️ TUYỆT ĐỐI KHÔNG dùng platform_settings cho việc này: bảng đó có policy
-- `using (true)`, tức ĐỌC CÔNG KHAI. Đây là bảng riêng, và cách bảo vệ mạnh
-- nhất của nó là KHÔNG CÓ POLICY NÀO CẢ — kể cả platform admin cũng không
-- select được qua PostgREST. Chỉ service role (edge function) đọc nổi.
--
-- Mã hoá: AES-256-GCM ở edge function (_shared/llm/crypto.ts), khoá KEK ở
-- biến môi trường AI_KEY_ENCRYPTION_KEY. Postgres không bao giờ thấy bản rõ
-- lẫn KEK. Xem file đó để biết cách này chống được gì và KHÔNG chống được gì.
-- ============================================================================

create table public.ai_provider_keys (
  -- 'openai' | 'anthropic' | 'deepseek' — khớp ModelEntry.credential
  provider        text primary key,
  ciphertext      text not null,          -- base64(iv || ciphertext+tag)
  hint            text not null,          -- '••••a1b2' để admin nhận ra
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null,

  -- Kết quả lần kiểm tra kết nối gần nhất.
  last_test_at    timestamptz,
  last_test_ok    boolean,
  last_test_model text,
  last_test_error text,
  last_test_ms    int
);

alter table public.ai_provider_keys enable row level security;

-- KHÔNG khai policy nào. RLS bật + không policy = chặn sạch mọi vai trò đi
-- qua PostgREST (anon, authenticated, kể cả platform admin). Service role
-- bỏ qua RLS nên edge function vẫn đọc/ghi được. Đây là chủ ý, không thiếu sót.
revoke all on public.ai_provider_keys from anon, authenticated;

comment on table public.ai_provider_keys is
  'Khoá API nhà cung cấp AI, đã mã hoá AES-GCM. Không có RLS policy — chỉ service role đọc được.';

-- ─── Metadata cho màn hình quản trị ───────────────────────────────────
-- Admin cần biết "đã cắm khoá nào, còn dùng được không" mà KHÔNG cần thấy
-- bản mã. Hàm này trả đúng chừng đó.
create or replace function public.ai_provider_keys_status()
  returns table (
    provider        text,
    hint            text,
    updated_at      timestamptz,
    last_test_at    timestamptz,
    last_test_ok    boolean,
    last_test_model text,
    last_test_error text,
    last_test_ms    int
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
    select k.provider, k.hint, k.updated_at, k.last_test_at, k.last_test_ok,
           k.last_test_model, k.last_test_error, k.last_test_ms
    from public.ai_provider_keys k
    order by k.provider;
end;
$$;

revoke execute on function public.ai_provider_keys_status() from public, anon;
grant execute on function public.ai_provider_keys_status() to authenticated;
