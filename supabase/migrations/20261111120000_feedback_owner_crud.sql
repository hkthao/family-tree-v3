-- Người gửi tự sửa / xoá góp ý của mình khi quản trị CHƯA xem (status = 'new').
-- Từ lúc quản trị đã xem hoặc xử lý thì khoá lại, để lịch sử xử lý không bị đổi.
--
-- Chỉ được đổi message, category, contact: trigger chặn người gửi đụng tới
-- trạng thái, ghi chú nội bộ, phản hồi hay các cột còn lại.

create policy feedback_update_owner_new
  on public.feedback for update
  to authenticated
  using (user_id = (select auth.uid()) and status = 'new')
  with check (user_id = (select auth.uid()) and status = 'new');

create policy feedback_delete_owner_new
  on public.feedback for delete
  to authenticated
  using (user_id = (select auth.uid()) and status = 'new');

create or replace function public.feedback_owner_update_guard()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    -- Quản trị nền tảng và service role (auth.uid() null) sửa tự do.
    if auth.uid() is null or public.is_platform_admin() then
      return new;
    end if;
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.clan_id is distinct from old.clan_id
       or new.status is distinct from old.status
       or new.admin_note is distinct from old.admin_note
       or new.admin_reply is distinct from old.admin_reply
       or new.replied_at is distinct from old.replied_at
       or new.resolved_at is distinct from old.resolved_at
       or new.resolved_by is distinct from old.resolved_by
       or new.created_at is distinct from old.created_at
       or new.page_url is distinct from old.page_url
       or new.page_path is distinct from old.page_path
       or new.user_agent is distinct from old.user_agent
       or new.app_version is distinct from old.app_version then
      raise exception 'Chỉ được sửa nội dung, loại và cách liên lạc của góp ý';
    end if;
    return new;
  end; $$;

create trigger feedback_owner_update_guard_trg
  before update on public.feedback
  for each row execute function public.feedback_owner_update_guard();
