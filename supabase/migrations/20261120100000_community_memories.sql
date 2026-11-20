-- Đóng góp cộng đồng — P0 (docs/plan-dong-gop-cong-dong.md).
--
-- Tách "ký ức" khỏi "dữ kiện": chuyện kể / ảnh / ghi âm về một người do nhiều người kể,
-- đăng thẳng hoặc chờ duyệt tuỳ admin họ chọn (clans.memory_moderation). Dữ kiện (ngày sinh,
-- quan hệ…) vẫn đi qua `contributions` như cũ.
--
--   * person_memories      : ký ức gắn người (person_id null = ký ức chung của họ).
--   * share_links          : thêm scope 'contribute' — link mời góp, MỌI thành viên tạo được
--                            (tối đa 20 link/người/ngày), ghi tên người nhận; admin xem/thu hồi hết.
--   * clan_visit_daily     : lượt ghé thăm theo ngày (chỉ số đếm, không lưu IP).
--   * community_submit_rate: bộ đếm ngắn hạn chống spam cho khách (IP đã băm, tự dọn).
--   * clan_community_summary(): số liệu + hoạt động gần đây cho khối "Cả nhà đang kể".
--
-- Khách (không tài khoản) KHÔNG ghi thẳng: đi qua edge function community-submit (service role),
-- function đó kiểm tra link, giới hạn tần suất, lưu file vào person-photos/{clan}/memories/guest/.

-- ─── clans: chế độ duyệt ký ức ───────────────────────────────────────
alter table public.clans
  add column if not exists memory_moderation text not null default 'post'
    check (memory_moderation in ('pre', 'post'));

comment on column public.clans.memory_moderation is
  'Ký ức cộng đồng: post = đăng thẳng, admin ẩn sau; pre = chờ editor+ duyệt. Khách mới luôn chờ duyệt.';

-- ─── person_memories ─────────────────────────────────────────────────
create table if not exists public.person_memories (
  id              uuid primary key default gen_random_uuid(),
  clan_id         uuid not null references public.clans(id) on delete cascade,
  person_id       uuid references public.persons(id) on delete set null,
  kind            text not null check (kind in ('story', 'photo', 'audio', 'answer')),
  body            text,
  media_path      text,                -- trong bucket person-photos; KHÔNG lưu URL
  media_mime      text,
  duration_sec    int,
  -- Mốc để sau này ghép tiểu sử / kịch bản video ký ức theo dòng thời gian (P4+):
  year_approx     int check (year_approx is null or year_approx between 1000 and 2200),
  place           text check (place is null or char_length(place) <= 200),
  topic           text check (topic is null or char_length(topic) <= 60),   -- tuổi thơ, nghề nghiệp, chiến tranh…
  source          text check (source is null or char_length(source) <= 200), -- "nghe bố kể", "chính tôi", "giấy tờ"
  transcript      text check (transcript is null or char_length(transcript) <= 20000),
  allow_ai_reuse  boolean not null default true,  -- người kể cho phép dùng vào tiểu sử / video AI
  author_user_id  uuid references public.profiles(id) on delete set null,
  author_name     text,                -- khách
  author_relation text,
  guest_key       text,                -- băm của khoá ngẫu nhiên phía trình duyệt khách → nhận ra khách quen
  via_link_id     uuid references public.share_links(id) on delete set null,
  visibility      text not null default 'clan' check (visibility in ('clan', 'share')),
  status          text not null default 'visible' check (status in ('pending', 'visible', 'hidden')),
  reviewed_by     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint person_memories_author check (author_user_id is not null or author_name is not null),
  constraint person_memories_body_len check (body is null or char_length(body) <= 20000),
  constraint person_memories_author_len check (
    char_length(coalesce(author_name, '')) <= 80 and char_length(coalesce(author_relation, '')) <= 120
  ),
  constraint person_memories_has_content check (
    (kind in ('story', 'answer') and body is not null and char_length(btrim(body)) > 0)
    or (kind in ('photo', 'audio') and media_path is not null)
  ),
  constraint person_memories_media_path check (
    media_path is null or media_path like clan_id::text || '/memories/%'
  )
);

create index if not exists person_memories_person_idx
  on public.person_memories (person_id, created_at desc) where person_id is not null;
create index if not exists person_memories_clan_status_idx
  on public.person_memories (clan_id, status, created_at desc);
create index if not exists person_memories_link_idx
  on public.person_memories (via_link_id, created_at desc) where via_link_id is not null;

-- Trước khi ghi (client đăng nhập): clan_id luôn lấy từ person; tác giả = người gọi;
-- trạng thái do server quyết theo vai trò + cài đặt họ, không tin giá trị client gửi.
-- service role (auth.uid() null — edge function của khách) tự đặt mọi cột.
create or replace function public.person_memories_before_write()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_mod text;
  begin
    if new.person_id is not null then
      select p.clan_id into new.clan_id from public.persons p
       where p.id = new.person_id and p.deleted_at is null;
      if new.clan_id is null then
        raise exception 'person_not_found';
      end if;
    end if;
    new.updated_at := now();

    if (select auth.uid()) is null then
      return new;
    end if;

    if tg_op = 'INSERT' then
      new.author_user_id := (select auth.uid());
      new.author_name := null;
      new.guest_key := null;
      new.via_link_id := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
      if public.can_edit_clan(new.clan_id) then
        new.status := 'visible';
      else
        select c.memory_moderation into v_mod from public.clans c where c.id = new.clan_id;
        new.status := case when v_mod = 'pre' then 'pending' else 'visible' end;
      end if;
    else
      -- UPDATE: đổi trạng thái chỉ editor+; tác giả / nguồn không bao giờ đổi.
      new.author_user_id := old.author_user_id;
      new.author_name := old.author_name;
      new.guest_key := old.guest_key;
      new.via_link_id := old.via_link_id;
      new.clan_id := old.clan_id;
      if new.status is distinct from old.status then
        if not public.can_edit_clan(old.clan_id) then
          raise exception 'Chỉ người quản lý dòng họ được duyệt / ẩn ký ức';
        end if;
        new.reviewed_by := (select auth.uid());
        new.reviewed_at := now();
      else
        new.reviewed_by := old.reviewed_by;
        new.reviewed_at := old.reviewed_at;
      end if;
    end if;
    return new;
  end;
  $$;

drop trigger if exists person_memories_before_write on public.person_memories;
create trigger person_memories_before_write
  before insert or update on public.person_memories
  for each row execute function public.person_memories_before_write();

alter table public.person_memories enable row level security;

-- Đọc: thành viên thấy bài hiện + bài của chính mình; editor+ thấy cả bài chờ / đã ẩn.
drop policy if exists person_memories_select on public.person_memories;
create policy person_memories_select on public.person_memories for select
  using (
    public.is_clan_member(clan_id)
    and (
      status = 'visible'
      or author_user_id = (select auth.uid())
      or public.can_edit_clan(clan_id)
    )
  );

drop policy if exists person_memories_insert on public.person_memories;
create policy person_memories_insert on public.person_memories for insert
  with check (public.is_clan_member(clan_id));

-- Sửa: tác giả sửa nội dung của mình; editor+ sửa / đổi trạng thái (trigger chặn phần còn lại).
drop policy if exists person_memories_update on public.person_memories;
create policy person_memories_update on public.person_memories for update
  using (author_user_id = (select auth.uid()) or public.can_edit_clan(clan_id))
  with check (author_user_id = (select auth.uid()) or public.can_edit_clan(clan_id));

drop policy if exists person_memories_delete on public.person_memories;
create policy person_memories_delete on public.person_memories for delete
  using (author_user_id = (select auth.uid()) or public.can_edit_clan(clan_id));

-- Ảnh / ghi âm của thành viên: {clan_id}/memories/{user_id}/{uuid}.ext (giống mảnh ảnh ghép).
-- Khách: {clan_id}/memories/guest/… do edge function ghi bằng service role.
drop policy if exists person_photos_memory_member_insert on storage.objects;
create policy person_photos_memory_member_insert
  on storage.objects for insert
  with check (
    bucket_id = 'person-photos'
    and (storage.foldername(name))[2] = 'memories'
    and (storage.foldername(name))[3] = (select auth.uid())::text
    and public.is_clan_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists person_photos_memory_member_delete on storage.objects;
create policy person_photos_memory_member_delete
  on storage.objects for delete
  using (
    bucket_id = 'person-photos'
    and (storage.foldername(name))[2] = 'memories'
    and (storage.foldername(name))[3] = (select auth.uid())::text
  );

-- ─── share_links: link mời góp ───────────────────────────────────────
alter table public.share_links
  add column if not exists recipient_label text
    check (recipient_label is null or char_length(recipient_label) <= 80),
  add column if not exists allow jsonb not null default '{}'::jsonb,
  add column if not exists use_count int not null default 0;

create index if not exists share_links_creator_idx
  on public.share_links (created_by, created_at desc) where scope = 'contribute';

-- Thành viên (không chỉ admin) tạo / xem / thu hồi link mời góp CỦA MÌNH.
-- Policy admin cũ (share_links_admin_all) giữ nguyên: admin thấy và thu hồi mọi link.
drop policy if exists share_links_contribute_member_select on public.share_links;
create policy share_links_contribute_member_select on public.share_links for select
  using (scope = 'contribute' and created_by = (select auth.uid()) and public.is_clan_member(clan_id));

drop policy if exists share_links_contribute_member_insert on public.share_links;
create policy share_links_contribute_member_insert on public.share_links for insert
  with check (
    scope = 'contribute'
    and created_by = (select auth.uid())
    and public.is_clan_member(clan_id)
    and expires_at <= now() + interval '90 days'
  );

drop policy if exists share_links_contribute_member_update on public.share_links;
create policy share_links_contribute_member_update on public.share_links for update
  using (scope = 'contribute' and created_by = (select auth.uid()))
  with check (scope = 'contribute' and created_by = (select auth.uid()));

-- Giới hạn 20 link mời góp / người / ngày (admin họ không giới hạn).
create or replace function public.share_links_contribute_quota()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_count int;
  begin
    if new.scope <> 'contribute' or (select auth.uid()) is null then
      return new;
    end if;
    new.created_by := (select auth.uid());
    if public.is_clan_admin(new.clan_id) then
      return new;
    end if;
    select count(*) into v_count from public.share_links
     where created_by = new.created_by and scope = 'contribute'
       and created_at > now() - interval '1 day';
    if v_count >= 20 then
      raise exception 'Bạn đã tạo 20 link mời góp trong 24 giờ qua, vui lòng thử lại sau';
    end if;
    return new;
  end;
  $$;

drop trigger if exists share_links_contribute_quota on public.share_links;
create trigger share_links_contribute_quota
  before insert on public.share_links
  for each row execute function public.share_links_contribute_quota();

-- Thu hồi link mời góp → ẩn luôn các ký ức CHƯA DUYỆT gửi qua link đó.
create or replace function public.share_links_revoke_pending_memories()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if new.is_revoked and not old.is_revoked then
      update public.person_memories
         set status = 'hidden', reviewed_at = now(), reviewed_by = (select auth.uid())
       where via_link_id = new.id and status = 'pending';
    end if;
    return new;
  end;
  $$;

drop trigger if exists share_links_revoke_pending_memories on public.share_links;
create trigger share_links_revoke_pending_memories
  after update of is_revoked on public.share_links
  for each row execute function public.share_links_revoke_pending_memories();

-- ─── Lượt ghé thăm ──────────────────────────────────────────────────
create table if not exists public.clan_visit_daily (
  clan_id uuid not null references public.clans(id) on delete cascade,
  day     date not null,
  source  text not null check (source in ('share', 'member')),
  visits  int not null default 0,
  primary key (clan_id, day, source)
);

alter table public.clan_visit_daily enable row level security;
drop policy if exists clan_visit_daily_member_select on public.clan_visit_daily;
create policy clan_visit_daily_member_select on public.clan_visit_daily for select
  using (public.is_clan_member(clan_id));

-- Gọi từ edge function share-view (service role) — nguồn 'share'.
create or replace function public.bump_clan_visit(p_clan_id uuid, p_source text)
  returns void
  language sql
  security definer
  set search_path = public, pg_temp
  as $$
    insert into public.clan_visit_daily (clan_id, day, source, visits)
    values (p_clan_id, (now() at time zone 'Asia/Ho_Chi_Minh')::date, p_source, 1)
    on conflict (clan_id, day, source) do update set visits = clan_visit_daily.visits + 1;
  $$;
revoke all on function public.bump_clan_visit(uuid, text) from public, anon, authenticated;
grant execute on function public.bump_clan_visit(uuid, text) to service_role;

-- Thành viên mở trang họ: client gọi tối đa 1 lần / ngày / trình duyệt.
-- KHÔNG đếm admin dòng họ và admin hệ thống (is_clan_admin gồm cả platform admin) — họ vào
-- trang để quản lý, đếm vào sẽ làm số "lượt ghé" ảo.
create or replace function public.record_member_visit(p_clan_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if not public.is_clan_member(p_clan_id) or public.is_clan_admin(p_clan_id) then
      return;
    end if;
    perform public.bump_clan_visit(p_clan_id, 'member');
  end;
  $$;
revoke all on function public.record_member_visit(uuid) from public, anon;
grant execute on function public.record_member_visit(uuid) to authenticated;

-- ─── Bộ đếm chống spam cho khách ────────────────────────────────────
create table if not exists public.community_submit_rate (
  bucket       text not null,          -- 'ip:<sha256>' | 'link:<uuid>'
  window_start timestamptz not null,   -- đầu giờ
  hits         int not null default 0,
  primary key (bucket, window_start)
);
alter table public.community_submit_rate enable row level security;  -- không policy: chỉ service role

-- Tăng bộ đếm và trả số lượt trong giờ hiện tại (gọi từ community-submit).
create or replace function public.bump_community_submit_rate(p_bucket text)
  returns int
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_hits int;
    v_window timestamptz := date_trunc('hour', now());
  begin
    insert into public.community_submit_rate (bucket, window_start, hits)
    values (p_bucket, v_window, 1)
    on conflict (bucket, window_start) do update set hits = community_submit_rate.hits + 1
    returning hits into v_hits;
    -- dọn lượt cũ (rẻ: chỉ khi vào giờ mới)
    if v_hits = 1 then
      delete from public.community_submit_rate where window_start < now() - interval '1 day';
    end if;
    return v_hits;
  end;
  $$;
revoke all on function public.bump_community_submit_rate(text) from public, anon, authenticated;
grant execute on function public.bump_community_submit_rate(text) to service_role;

-- Số liệu công khai cho trang chia sẻ (share-view, service role): lượt ghé + số người đã góp.
create or replace function public.clan_public_community_stats(p_clan_id uuid)
  returns jsonb
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select jsonb_build_object(
      'visits_total', coalesce((select sum(visits) from public.clan_visit_daily where clan_id = p_clan_id), 0),
      'visits_week', coalesce((
        select sum(visits) from public.clan_visit_daily
         where clan_id = p_clan_id and day > (now() at time zone 'Asia/Ho_Chi_Minh')::date - 7), 0),
      'contributors', (
        select count(*) from (
          select coalesce(author_user_id::text, 'g:' || coalesce(guest_key, author_name))
            from public.person_memories where clan_id = p_clan_id and status = 'visible'
          union
          select coalesce(submitter_user_id::text, 'g:' || submitter_name)
            from public.contributions where clan_id = p_clan_id and status = 'approved'
        ) a),
      'memories', (
        select count(*) from public.person_memories where clan_id = p_clan_id and status = 'visible')
    );
  $$;
revoke all on function public.clan_public_community_stats(uuid) from public, anon, authenticated;
grant execute on function public.clan_public_community_stats(uuid) to service_role;

-- ─── Số liệu cho khối "Cả nhà đang kể" ──────────────────────────────
-- Một lần gọi: số liệu 7 ngày + 10 hoạt động gần nhất (ký ức hiện + đóng góp mới).
-- Hàng chờ (ký ức pending, đóng góp pending) chỉ có ý nghĩa với editor+; viewer nhận 0.
create or replace function public.clan_community_summary(p_clan_id uuid)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_since timestamptz := now() - interval '7 days';
    v_editor boolean;
    v_result jsonb;
  begin
    if not public.is_clan_member(p_clan_id) then
      raise exception 'not_a_member';
    end if;
    v_editor := public.can_edit_clan(p_clan_id);

    select jsonb_build_object(
      'visits_week', coalesce((
        select sum(visits) from public.clan_visit_daily
         where clan_id = p_clan_id and day > (now() at time zone 'Asia/Ho_Chi_Minh')::date - 7), 0),
      'visits_total', coalesce((select sum(visits) from public.clan_visit_daily where clan_id = p_clan_id), 0),
      'memories_week', (
        select count(*) from public.person_memories
         where clan_id = p_clan_id and status = 'visible' and created_at > v_since),
      'contributors_week', (
        select count(distinct coalesce(author_user_id::text, 'g:' || coalesce(guest_key, author_name)))
          from public.person_memories where clan_id = p_clan_id and created_at > v_since)
        + (select count(distinct coalesce(submitter_user_id::text, 'g:' || submitter_name))
          from public.contributions where clan_id = p_clan_id and created_at > v_since),
      'pending_memories', case when v_editor then (
        select count(*) from public.person_memories where clan_id = p_clan_id and status = 'pending') else 0 end,
      'pending_contributions', case when v_editor then (
        select count(*) from public.contributions where clan_id = p_clan_id and status = 'pending') else 0 end,
      'recent', coalesce((
        select jsonb_agg(r order by r.created_at desc) from (
          select 'memory' as type, m.id, m.kind, m.person_id, p.full_name as person_name,
                 coalesce(pr.display_name, m.author_name) as author_name, m.created_at
            from public.person_memories m
            left join public.persons p on p.id = m.person_id
            left join public.profiles pr on pr.id = m.author_user_id
           where m.clan_id = p_clan_id and m.status = 'visible'
          union all
          select 'contribution', c.id, c.contribution_type, c.person_id, p.full_name,
                 coalesce(pr.display_name, c.submitter_name), c.created_at
            from public.contributions c
            left join public.persons p on p.id = c.person_id
            left join public.profiles pr on pr.id = c.submitter_user_id
           where c.clan_id = p_clan_id and v_editor
           order by 7 desc
           limit 10
        ) r), '[]'::jsonb)
    ) into v_result;
    return v_result;
  end;
  $$;
revoke all on function public.clan_community_summary(uuid) from public, anon;
grant execute on function public.clan_community_summary(uuid) to authenticated;
