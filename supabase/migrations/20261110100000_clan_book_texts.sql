-- Văn bản tự soạn cho Sổ gia phả (theo bố cục bộ gia phả hoàn chỉnh):
-- địa danh ở tựa, lời nói đầu, phả ký, ngoại phả (lễ cúng/nhà thờ), phụ khảo.
-- Mỗi dòng họ đúng một dòng. Đọc = thành viên, sửa = can_edit_clan.
create table public.clan_book_texts (
  clan_id      uuid primary key references public.clans(id) on delete cascade,
  place_line   text,   -- địa danh hành chính ghi dưới tựa: thôn, xã, huyện, tỉnh
  preface      text,   -- lời nói đầu
  phaky        text,   -- phả ký: phát tích, tổ quán, truyền thống, phương hướng
  ngoai_pha    text,   -- ngoại phả: lễ cúng, văn khấn, nhà thờ, hội đồng gia tộc
  phu_khao     text,   -- phụ khảo: địa chí xóm ấp, đình làng, nghề truyền thống
  updated_at   timestamptz not null default now(),
  constraint clan_book_texts_len check (
    char_length(coalesce(place_line, '')) <= 300
    and char_length(coalesce(preface, '')) <= 20000
    and char_length(coalesce(phaky, '')) <= 60000
    and char_length(coalesce(ngoai_pha, '')) <= 30000
    and char_length(coalesce(phu_khao, '')) <= 30000
  )
);

create trigger clan_book_texts_set_updated_at
  before update on public.clan_book_texts
  for each row execute function public.set_updated_at();

alter table public.clan_book_texts enable row level security;

create policy clan_book_texts_select on public.clan_book_texts for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy clan_book_texts_insert on public.clan_book_texts for insert
  with check (public.can_edit_clan(clan_id));
create policy clan_book_texts_update on public.clan_book_texts for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy clan_book_texts_delete on public.clan_book_texts for delete
  using (public.can_edit_clan(clan_id));
