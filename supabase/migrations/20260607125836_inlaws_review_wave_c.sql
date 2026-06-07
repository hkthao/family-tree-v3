-- Code-review Wave C — defense-in-depth.
--
-- #9   Constrain invite_token length so a manual INSERT (or future
--      bug in proposeLink) can't seed a 4-character bearer secret
--      that an attacker could enumerate against resolve_link_token.
--      The client generates 16 random bytes → base64url(22) chars,
--      so 22 is the natural floor. Allow NULL because the column is
--      nulled out after confirm/revoke.

alter table public.person_links
  drop constraint if exists invite_token_min_length;
alter table public.person_links
  add constraint invite_token_min_length
  check (invite_token is null or length(invite_token) >= 22);
