-- Phase A của plan.md §32.4 — nâng cấp `feedback` (không tạo mới).
--
-- Thêm phân loại (bug/idea/question/other), trạng thái xử lý (new
-- /seen/resolved/spam), `page_path` đã được sanitize ở DB (xoá origin,
-- thay UUID/ID bằng `:id`), và cột `resolved_by/at/admin_note` cho
-- platform admin.
--
-- Thêm policy `feedback_select_owner` để user đọc lại feedback của
-- chính mình (lịch sử "đã gửi"). KHÔNG drop policy hiện có — chúng
-- là `or` nên 2 policy SELECT cùng tồn tại sẽ cho phép cả 2 nguồn.

-- ─── Enums ────────────────────────────────────────────────────────
create type public.feedback_category
  as enum ('bug', 'idea', 'question', 'other');
create type public.feedback_status
  as enum ('new', 'seen', 'resolved', 'spam');

-- ─── Columns ──────────────────────────────────────────────────────
alter table public.feedback
  add column category    public.feedback_category not null default 'other',
  add column status      public.feedback_status   not null default 'new',
  add column page_path   text,
  add column resolved_at timestamptz,
  add column resolved_by uuid references auth.users(id),
  add column admin_note  text,
  add constraint feedback_admin_note_len
    check (admin_note is null or char_length(admin_note) <= 4000);

create index feedback_status_idx
  on public.feedback (status, created_at desc);

-- ─── Sanitize page_url → page_path ────────────────────────────────
-- Không tin client gửi gì: trigger ép origin biến mất, query biến
-- mất, UUID/ID dài thành `:id`. Xong, drop `page_url` raw để long-
-- term không rò tên/id trong URL.
create or replace function public.feedback_sanitize_path()
  returns trigger
  language plpgsql
  as $$
  declare p text;
  begin
    p := coalesce(new.page_url, '');
    -- Bỏ origin + query string.
    p := regexp_replace(p, '^https?://[^/]+', '');
    p := regexp_replace(p, '\?.*$', '');
    -- UUID → `:id`
    p := regexp_replace(
      p,
      '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
      ':id', 'g'
    );
    -- Số ID dài (≥2 chữ số sau '/') → `:id`
    p := regexp_replace(p, '/\d{2,}', '/:id', 'g');
    if char_length(p) > 200 then
      p := substring(p from 1 for 200);
    end if;
    new.page_path := nullif(p, '');
    -- Không lưu raw URL nữa.
    new.page_url := null;
    return new;
  end; $$;

create trigger feedback_sanitize_path_trg
  before insert on public.feedback
  for each row execute function public.feedback_sanitize_path();

-- ─── Owner SELECT policy (mới) ────────────────────────────────────
-- Cho user đọc feedback của chính mình. Policy cũ
-- `feedback_select_platform_admin` giữ nguyên — 2 policy cùng tồn
-- tại là `OR` semantics, platform admin vẫn đọc tất cả.
create policy feedback_select_owner
  on public.feedback for select
  to authenticated
  using (user_id is not null and user_id = auth.uid());

-- ─── UPDATE policy (mới) ──────────────────────────────────────────
-- Chỉ platform admin được sửa status/admin_note/resolved_*.
create policy feedback_update_platform_admin
  on public.feedback for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
