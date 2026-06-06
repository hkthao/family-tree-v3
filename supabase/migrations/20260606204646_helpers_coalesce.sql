-- Coerce is_clan_admin / can_edit_clan to return false (not NULL)
-- when the caller has no clan_members row and isn't platform admin.
--
-- Three-valued SQL bites plpgsql callers that use the result in an
-- `if not …` guard: `if not NULL then …` skips the THEN branch silently,
-- which let non-admins slip past checks in the RPCs added with the
-- in-law links feature. Wrapping in `coalesce(…, false)` keeps the
-- behaviour everywhere policies use these helpers (NULL ≡ false in
-- USING/WITH CHECK already) AND makes plpgsql checks fire as intended.
--
-- `is_clan_member` already used `IS NOT NULL` so it never returned
-- NULL — left untouched.

create or replace function public.is_clan_admin(target_clan uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select coalesce(
      public.is_platform_admin()
        or public.clan_role(target_clan) = 'admin',
      false
    );
  $$;

create or replace function public.can_edit_clan(target_clan uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select coalesce(
      public.is_platform_admin()
        or public.clan_role(target_clan) in ('admin', 'editor'),
      false
    );
  $$;
