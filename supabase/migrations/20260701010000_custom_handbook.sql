-- ============================================================================
-- "Sổ tay Văn hoá – Phong tục" — nội dung TOÀN NỀN TẢNG (global), không theo
-- dòng họ. Đọc: mọi user đăng nhập (chỉ bài đã publish). Ghi: platform admin.
-- Khuôn theo module Di sản (heritage_items): sections jsonb plain-text, không
-- HTML thô → gần như không bề mặt XSS.
-- ============================================================================

create type public.custom_category as enum
  ('tho_cung', 'vong_doi', 'le_tet', 'le_hoi', 'sinh_hoat');
create type public.custom_scope as enum
  ('gia_dinh', 'dong_ho', 'lang_xa', 'ton_giao');
create type public.custom_mandatory as enum
  ('bat_buoc', 'khuyen_khich', 'dia_phuong');
create type public.custom_origin as enum
  ('nho_giao', 'phat_giao', 'dao_mau', 'dan_gian', 'trung_hoa', 'dia_phuong');
create type public.custom_status as enum
  ('draft', 'needs_review', 'published');

create table public.custom_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 200),
  aliases text[] not null default '{}',          -- tên gọi khác (search synonym)
  short_description text,
  category public.custom_category not null,
  regions text[] not null default '{}',          -- Bắc/Trung/Nam/dân tộc (mở rộng)
  lunar_month int check (lunar_month between 1 and 12),  -- Trục D timeline (tuỳ chọn)
  timing text,
  scope public.custom_scope,
  mandatory_level public.custom_mandatory,
  origin public.custom_origin,
  reliability int check (reliability between 1 and 5),
  applicable_to text,
  sources text,
  sections jsonb not null default '[]'::jsonb,    -- [{heading, body}]
  faq jsonb not null default '[]'::jsonb,         -- [{q, a}]
  cover_image_url text,                           -- https (validate ở app)
  status public.custom_status not null default 'draft',
  search_text text,                               -- blob không dấu để tìm nhanh
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index custom_entries_category_idx on public.custom_entries (category)
  where deleted_at is null;
create index custom_entries_status_idx on public.custom_entries (status)
  where deleted_at is null;
create index custom_entries_search_idx on public.custom_entries
  using gin (search_text gin_trgm_ops);
create index custom_entries_lunar_idx on public.custom_entries (lunar_month)
  where deleted_at is null and lunar_month is not null;

-- updated_at + search_text tự cập nhật.
create or replace function public.custom_entries_touch()
  returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at := now();
    -- Gom title + aliases + short_description + sections/faq text (đã bỏ dấu).
    new.search_text := public.f_unaccent(lower(
      coalesce(new.title, '') || ' ' ||
      array_to_string(new.aliases, ' ') || ' ' ||
      coalesce(new.short_description, '') || ' ' ||
      coalesce((select string_agg(coalesce(s->>'heading','') || ' ' || coalesce(s->>'body',''), ' ')
                from jsonb_array_elements(new.sections) s), '')
    ));
    return new;
  end;
  $$;

create trigger custom_entries_touch_trg
  before insert or update on public.custom_entries
  for each row execute function public.custom_entries_touch();

-- Bookmark cá nhân.
create table public.custom_bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_id uuid not null references public.custom_entries(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.custom_entries enable row level security;
alter table public.custom_bookmarks enable row level security;

-- Đọc: bài đã publish cho mọi user đăng nhập; platform admin thấy tất cả.
create policy custom_entries_select on public.custom_entries
  for select to authenticated
  using (status = 'published' or public.is_platform_admin());

-- Ghi: chỉ platform admin.
create policy custom_entries_insert on public.custom_entries
  for insert to authenticated
  with check (public.is_platform_admin());
create policy custom_entries_update on public.custom_entries
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy custom_entries_delete on public.custom_entries
  for delete to authenticated
  using (public.is_platform_admin());

-- Bookmark: mỗi user quản dòng của mình.
create policy custom_bookmarks_all on public.custom_bookmarks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.custom_entries from anon;
revoke all on public.custom_bookmarks from anon;
