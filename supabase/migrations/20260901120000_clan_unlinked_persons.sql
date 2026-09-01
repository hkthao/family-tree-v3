-- ============================================================================
-- "Chưa gắn vào cây" — định nghĩa cho ĐÚNG.
--
-- Bản đầu của kiểu xem thư mục coi "chưa gắn" = không có cha mẹ. Sai:
-- người làm DÂU/RỂ thường không có cha mẹ trong gia phả, nhưng họ CÓ mặt
-- trong cây — đứng cạnh vợ/chồng mình. Kết quả là bà Lê Dậu vừa hiện là
-- vợ cụ Cao Hể ở nhánh trên, vừa bị liệt vào danh sách "chưa gắn" ở dưới.
-- Người dùng nhìn thấy ngay, và nó làm cả con số đếm mất tin cậy.
--
-- Đúng phải là: không có cha mẹ, KHÔNG phải thuỷ tổ, VÀ không phải
-- vợ/chồng của ai. Điều kiện thứ ba không viết được bằng PostgREST nên
-- đưa xuống SQL.
--
-- Dùng `persons_public_safe` / `families_public_safe`: hai view đó đã
-- gộp sẵn cả ba loại người xem (khách xem dòng họ công khai, thành viên,
-- platform admin) và che dữ liệu người còn sống đúng luật. Hàm để
-- SECURITY INVOKER (mặc định) nên quyền của người gọi được giữ nguyên —
-- definer ở đây là tự mở cửa cho người ngoài đọc dòng họ riêng tư.
-- ============================================================================

create or replace function public.clan_unlinked_count(p_clan uuid)
  returns int
  language sql
  stable
as $$
  select count(*)::int
  from public.persons_public_safe p
  where p.clan_id = p_clan
    and p.birth_family_id is null
    and not p.is_root
    and not exists (
      select 1 from public.families_public_safe f
      where f.clan_id = p_clan
        and (f.husband_id = p.id or f.wife_id = p.id)
    );
$$;

create or replace function public.clan_unlinked_persons(
  p_clan uuid,
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
)
  returns setof public.persons_public_safe
  language sql
  stable
as $$
  select p.*
  from public.persons_public_safe p
  where p.clan_id = p_clan
    and p.birth_family_id is null
    and not p.is_root
    and not exists (
      select 1 from public.families_public_safe f
      where f.clan_id = p_clan
        and (f.husband_id = p.id or f.wife_id = p.id)
    )
    -- Tìm không dấu: người dùng gõ "le dau" phải ra "Lê Dậu".
    and (
      nullif(btrim(coalesce(p_search, '')), '') is null
      or p.full_name ilike '%' || btrim(p_search) || '%'
      or p.full_name_unaccent ilike '%' || public.f_unaccent(btrim(p_search)) || '%'
    )
  order by p.full_name
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.clan_unlinked_count(uuid) from public;
revoke execute on function public.clan_unlinked_persons(uuid, text, int, int)
  from public;
-- Chỉ `authenticated`: `anon` vốn không có quyền đọc view public_safe
-- (giống mọi màn khác trong app — khách chưa đăng nhập xem gia phả công
-- khai đi qua đường share riêng). Cấp cho anon thì lời gọi cũng chỉ lỗi
-- "permission denied", tức hứa suông.
grant execute on function public.clan_unlinked_count(uuid) to authenticated;
grant execute on function public.clan_unlinked_persons(uuid, text, int, int)
  to authenticated;
