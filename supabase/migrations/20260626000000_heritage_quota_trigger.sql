-- Chặn TRẦN DUNG LƯỢNG di sản ở tầng server (không lách được qua API).
-- Trước đây chỉ chặn ở giao diện. Trần = 500MB media (ảnh + ghi âm) mỗi
-- dòng họ. Link ngoài (bytes = null) KHÔNG tính.

create or replace function public.heritage_media_enforce_quota()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    cid uuid;
    used bigint;
    quota bigint := 524288000; -- 500 MB
  begin
    if new.bytes is null then
      return new; -- link ngoài không tính dung lượng
    end if;
    -- Lấy clan từ item (không phụ thuộc thứ tự trigger sync clan_id).
    select clan_id into cid from public.heritage_items where id = new.item_id;
    if cid is null then
      return new;
    end if;
    select coalesce(sum(bytes), 0) into used
      from public.heritage_media where clan_id = cid;
    if used + new.bytes > quota then
      raise exception 'Vượt giới hạn dung lượng di sản (500MB) của dòng họ. Hãy xoá bớt ảnh/ghi âm cũ hoặc dùng liên kết ngoài.';
    end if;
    return new;
  end; $$;

-- Tên "zquota" để chạy SAU trigger sync clan_id (thứ tự theo tên).
create trigger heritage_media_zquota
  before insert on public.heritage_media
  for each row execute function public.heritage_media_enforce_quota();
