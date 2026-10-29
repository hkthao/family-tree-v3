-- Viền avatar: mỗi người chọn một khung (vòng nguyệt quế, vàng, bạc, hoàng gia,
-- sen, phúc). Chỉ là hiển thị nên không bị che theo is_living như ảnh.

alter table public.persons
  add column if not exists avatar_frame text
    check (avatar_frame in ('laurel', 'gold', 'silver', 'royal', 'lotus', 'fortune'));

-- View công khai thêm cột avatar_frame ở CUỐI (create or replace chỉ cho thêm cuối).
create or replace view public.persons_public_safe
  with (security_invoker = false) as
 SELECT id,
    clan_id,
    full_name,
    full_name_unaccent,
    gender,
    generation,
    branch_id,
    is_living,
    is_root,
        CASE
            WHEN is_living THEN NULL::date
            ELSE birth_date
        END AS birth_date,
        CASE
            WHEN is_living THEN NULL::text
            ELSE birth_date_precision
        END AS birth_date_precision,
        CASE
            WHEN is_living THEN NULL::date
            ELSE death_date
        END AS death_date,
        CASE
            WHEN is_living THEN NULL::text
            ELSE death_date_precision
        END AS death_date_precision,
        CASE
            WHEN is_living THEN NULL::text
            ELSE birth_place
        END AS birth_place,
        CASE
            WHEN is_living THEN NULL::text
            ELSE burial_place
        END AS burial_place,
        CASE
            WHEN is_living THEN NULL::text
            ELSE photo_path
        END AS photo_path,
        CASE
            WHEN is_living THEN NULL::text
            ELSE bio
        END AS bio,
        CASE
            WHEN is_living THEN NULL::text
            ELSE courtesy_name
        END AS courtesy_name,
        CASE
            WHEN is_living THEN NULL::text
            ELSE posthumous_name
        END AS posthumous_name,
        CASE
            WHEN is_living THEN NULL::text
            ELSE nickname
        END AS nickname,
        CASE
            WHEN is_living THEN NULL::integer
            ELSE birth_lunar_year
        END AS birth_lunar_year,
        CASE
            WHEN is_living THEN NULL::integer
            ELSE birth_lunar_month
        END AS birth_lunar_month,
        CASE
            WHEN is_living THEN NULL::integer
            ELSE birth_lunar_day
        END AS birth_lunar_day,
        CASE
            WHEN is_living THEN NULL::integer
            ELSE death_lunar_year
        END AS death_lunar_year,
        CASE
            WHEN is_living THEN NULL::integer
            ELSE death_lunar_month
        END AS death_lunar_month,
        CASE
            WHEN is_living THEN NULL::integer
            ELSE death_lunar_day
        END AS death_lunar_day,
        CASE
            WHEN is_living THEN NULL::integer
            ELSE death_anniv_lunar_month
        END AS death_anniv_lunar_month,
        CASE
            WHEN is_living THEN NULL::integer
            ELSE death_anniv_lunar_day
        END AS death_anniv_lunar_day,
    death_anniv_lunar_is_leap,
        CASE
            WHEN is_living THEN NULL::integer
            ELSE lifespan_years
        END AS lifespan_years,
    birth_family_id,
    birth_order,
    avatar_frame
   FROM persons p
  WHERE deleted_at IS NULL AND (EXISTS ( SELECT 1
           FROM clans c
          WHERE c.id = p.clan_id AND (c.visibility = 'public'::text AND c.public_show_tree OR is_clan_member(c.id) OR is_platform_admin())));
