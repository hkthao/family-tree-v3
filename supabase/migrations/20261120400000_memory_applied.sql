-- "Đưa vào gia phả" (docs/plan-dong-gop-cong-dong.md): đóng góp là NGUỒN, gia phả là bản đã xác nhận.
--
--   * person_memories.applied_to : danh sách nơi nội dung đã được đưa vào gia phả
--     [{type: 'bio'|'photo'|'manual'|'contribution', person_id?, contribution_id?, note?, by, at}].
--   * mark_memory_applied()      : editor+ đánh dấu (sau khi tự cập nhật hồ sơ trong app).
--   * Duyệt đề xuất có proposed_data.source_memory_ids (AI qua MCP luôn chỉ ĐỀ XUẤT) → tự đánh dấu
--     các đóng góp nguồn là đã đưa vào gia phả.

alter table public.person_memories
  add column if not exists applied_to jsonb not null default '[]'::jsonb;

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
      new.applied_to := '[]'::jsonb;
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
      -- "Đã đưa vào gia phả" chỉ editor+ ghi (qua mark_memory_applied / duyệt đề xuất).
      if new.applied_to is distinct from old.applied_to and not public.can_edit_clan(old.clan_id) then
        raise exception 'Chỉ người quản lý dòng họ được đánh dấu đã đưa vào gia phả';
      end if;
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


create or replace function public.mark_memory_applied(p_memory_id uuid, p_target jsonb)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_clan uuid;
  begin
    select clan_id into v_clan from public.person_memories where id = p_memory_id;
    if v_clan is null then
      raise exception 'memory_not_found';
    end if;
    if not public.can_edit_clan(v_clan) then
      raise exception 'Chỉ người quản lý dòng họ được đánh dấu đã đưa vào gia phả';
    end if;
    update public.person_memories
       set applied_to = applied_to || jsonb_build_array(
             coalesce(p_target, '{}'::jsonb)
             || jsonb_build_object('by', (select auth.uid()), 'at', now()))
     where id = p_memory_id;
  end;
  $$;
revoke all on function public.mark_memory_applied(uuid, jsonb) from public, anon;
grant execute on function public.mark_memory_applied(uuid, jsonb) to authenticated;

-- Đề xuất được duyệt → đánh dấu các đóng góp nguồn (cùng dòng họ) đã đưa vào gia phả.
create or replace function public.contributions_mark_source_memories()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_ids uuid[];
  begin
    if new.status <> 'approved' or old.status = 'approved'
       or jsonb_typeof(new.proposed_data -> 'source_memory_ids') <> 'array' then
      return new;
    end if;
    select coalesce(array_agg(x::uuid), '{}')
      into v_ids
      from jsonb_array_elements_text(new.proposed_data -> 'source_memory_ids') as t(x)
     where x ~ '^[0-9a-f-]{36}$';
    update public.person_memories
       set applied_to = applied_to || jsonb_build_array(jsonb_build_object(
             'type', 'contribution',
             'contribution_id', new.id,
             'contribution_type', new.contribution_type,
             'person_id', new.person_id,
             'by', new.reviewer_user_id,
             'at', now()))
     where id = any(v_ids) and clan_id = new.clan_id;
    return new;
  end;
  $$;
drop trigger if exists contributions_mark_source_memories on public.contributions;
create trigger contributions_mark_source_memories
  after update of status on public.contributions
  for each row execute function public.contributions_mark_source_memories();
