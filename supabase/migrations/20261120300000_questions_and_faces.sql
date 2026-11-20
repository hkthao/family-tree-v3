-- Đóng góp cộng đồng — P1 "Hỏi ông bà" + P2 "Ảnh: đây là ai?" (docs/plan-dong-gop-cong-dong.md).
--
--   * family_questions : câu hỏi gửi người thân (hỏi ai / về ai). Câu trả lời = person_memories có
--                        question_id (chữ hoặc ghi âm); có câu trả lời đầu tiên → status 'answered'.
--   * person_memories.identify : ảnh "nhờ cả nhà nhận diện".
--   * photo_faces      : khung khuôn mặt khoanh trên ảnh (toạ độ tỉ lệ 0..1) + gợi ý người / tên / nghề.
--                        Gắn một người trong cây là DỮ KIỆN → chỉ editor+ xác nhận (plan §5, câu 3).
-- Khách đi qua edge function community-submit (service role), không mở RLS cho anon.

-- ─── family_questions ────────────────────────────────────────────────
create table if not exists public.family_questions (
  id              uuid primary key default gen_random_uuid(),
  clan_id         uuid not null references public.clans(id) on delete cascade,
  about_person_id uuid references public.persons(id) on delete set null,  -- hỏi VỀ ai (vd cụ Tư)
  ask_person_id   uuid references public.persons(id) on delete set null,  -- hỏi AI (vd bà nội)
  question        text not null check (char_length(btrim(question)) between 3 and 500),
  asked_by        uuid references public.profiles(id) on delete set null,
  status          text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at      timestamptz not null default now(),
  answered_at     timestamptz
);
create index if not exists family_questions_clan_idx on public.family_questions (clan_id, status, created_at desc);

create or replace function public.family_questions_before_write()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if (select auth.uid()) is null then
      return new;
    end if;
    if tg_op = 'INSERT' then
      new.asked_by := (select auth.uid());
      new.status := 'open';
      new.answered_at := null;
    else
      new.clan_id := old.clan_id;
      new.asked_by := old.asked_by;
    end if;
    return new;
  end;
  $$;
drop trigger if exists family_questions_before_write on public.family_questions;
create trigger family_questions_before_write
  before insert or update on public.family_questions
  for each row execute function public.family_questions_before_write();

alter table public.family_questions enable row level security;
drop policy if exists family_questions_select on public.family_questions;
create policy family_questions_select on public.family_questions for select
  using (public.is_clan_member(clan_id));
drop policy if exists family_questions_insert on public.family_questions;
create policy family_questions_insert on public.family_questions for insert
  with check (public.is_clan_member(clan_id));
drop policy if exists family_questions_update on public.family_questions;
create policy family_questions_update on public.family_questions for update
  using (asked_by = (select auth.uid()) or public.can_edit_clan(clan_id))
  with check (asked_by = (select auth.uid()) or public.can_edit_clan(clan_id));
drop policy if exists family_questions_delete on public.family_questions;
create policy family_questions_delete on public.family_questions for delete
  using (asked_by = (select auth.uid()) or public.can_edit_clan(clan_id));

-- Câu trả lời trỏ về câu hỏi.
alter table public.person_memories add column if not exists question_id uuid;
alter table public.person_memories drop constraint if exists person_memories_question_fk;
alter table public.person_memories
  add constraint person_memories_question_fk
  foreign key (question_id) references public.family_questions(id) on delete set null;
create index if not exists person_memories_question_idx
  on public.person_memories (question_id) where question_id is not null;

-- Có câu trả lời (chưa bị ẩn) → câu hỏi chuyển 'answered'.
create or replace function public.person_memories_mark_answered()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if new.question_id is not null and new.status <> 'hidden' then
      update public.family_questions
         set status = 'answered', answered_at = coalesce(answered_at, now())
       where id = new.question_id and status = 'open';
    end if;
    return new;
  end;
  $$;
drop trigger if exists person_memories_mark_answered on public.person_memories;
create trigger person_memories_mark_answered
  after insert or update of status on public.person_memories
  for each row execute function public.person_memories_mark_answered();

-- ─── Ảnh "đây là ai?" ────────────────────────────────────────────────
alter table public.person_memories
  add column if not exists identify boolean not null default false;

create table if not exists public.photo_faces (
  id             uuid primary key default gen_random_uuid(),
  clan_id        uuid not null references public.clans(id) on delete cascade,
  memory_id      uuid not null references public.person_memories(id) on delete cascade,
  box_x          real not null check (box_x >= 0 and box_x <= 1),
  box_y          real not null check (box_y >= 0 and box_y <= 1),
  box_w          real not null check (box_w > 0 and box_w <= 1),
  box_h          real not null check (box_h > 0 and box_h <= 1),
  person_id      uuid references public.persons(id) on delete set null,
  suggested_name text check (suggested_name is null or char_length(suggested_name) <= 120),
  suggested_note text check (suggested_note is null or char_length(suggested_note) <= 200),
  status         text not null default 'suggested' check (status in ('suggested', 'confirmed', 'rejected')),
  tagged_by      uuid references public.profiles(id) on delete set null,
  tagger_name    text check (tagger_name is null or char_length(tagger_name) <= 80),
  guest_key      text,
  reviewed_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint photo_faces_has_label check (person_id is not null or suggested_name is not null),
  constraint photo_faces_tagger check (tagged_by is not null or tagger_name is not null)
);
create index if not exists photo_faces_memory_idx on public.photo_faces (memory_id, created_at);
create index if not exists photo_faces_clan_status_idx on public.photo_faces (clan_id, status);

-- clan_id luôn lấy từ ảnh; người gắn = người gọi; editor+ gắn người trong cây thì xác nhận luôn;
-- đổi trạng thái chỉ editor+.
create or replace function public.photo_faces_before_write()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    select m.clan_id into new.clan_id from public.person_memories m where m.id = new.memory_id;
    if new.clan_id is null then
      raise exception 'memory_not_found';
    end if;
    if new.person_id is not null and not exists (
      select 1 from public.persons p where p.id = new.person_id and p.clan_id = new.clan_id
    ) then
      raise exception 'Người này không thuộc dòng họ';
    end if;
    if (select auth.uid()) is null then
      return new;
    end if;
    if tg_op = 'INSERT' then
      new.tagged_by := (select auth.uid());
      new.tagger_name := null;
      new.guest_key := null;
      new.reviewed_by := null;
      new.status := case
        when new.person_id is not null and public.can_edit_clan(new.clan_id) then 'confirmed'
        else 'suggested' end;
      if new.status = 'confirmed' then
        new.reviewed_by := (select auth.uid());
      end if;
    else
      new.tagged_by := old.tagged_by;
      new.tagger_name := old.tagger_name;
      new.guest_key := old.guest_key;
      if new.status is distinct from old.status then
        if not public.can_edit_clan(old.clan_id) then
          raise exception 'Chỉ người quản lý dòng họ được xác nhận người trong ảnh';
        end if;
        new.reviewed_by := (select auth.uid());
      end if;
    end if;
    return new;
  end;
  $$;
drop trigger if exists photo_faces_before_write on public.photo_faces;
create trigger photo_faces_before_write
  before insert or update on public.photo_faces
  for each row execute function public.photo_faces_before_write();

alter table public.photo_faces enable row level security;
drop policy if exists photo_faces_select on public.photo_faces;
create policy photo_faces_select on public.photo_faces for select
  using (public.is_clan_member(clan_id));
drop policy if exists photo_faces_insert on public.photo_faces;
create policy photo_faces_insert on public.photo_faces for insert
  with check (public.is_clan_member(clan_id));
drop policy if exists photo_faces_update on public.photo_faces;
create policy photo_faces_update on public.photo_faces for update
  using (tagged_by = (select auth.uid()) or public.can_edit_clan(clan_id))
  with check (tagged_by = (select auth.uid()) or public.can_edit_clan(clan_id));
drop policy if exists photo_faces_delete on public.photo_faces;
create policy photo_faces_delete on public.photo_faces for delete
  using (tagged_by = (select auth.uid()) or public.can_edit_clan(clan_id));

-- Hàng chờ của khối "Đóng góp mới": thêm số gợi ý nhận diện chờ xác nhận.
create or replace function public.clan_pending_faces(p_clan_id uuid)
  returns int
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select case when public.can_edit_clan(p_clan_id)
      then (select count(*)::int from public.photo_faces where clan_id = p_clan_id and status = 'suggested')
      else 0 end;
  $$;
revoke all on function public.clan_pending_faces(uuid) from public, anon;
grant execute on function public.clan_pending_faces(uuid) to authenticated;
