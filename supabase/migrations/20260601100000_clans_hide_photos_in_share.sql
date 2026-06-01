-- ============================================================================
-- Per-clan toggle: hide uploaded photos from anonymous share-view links.
--
-- Public share links serve a redacted tree (dates / places / bio masked
-- for living members). Real avatar photos were always served because
-- some clans want a recognisable family album; others — especially
-- with children or sensitive members in the tree — would rather show
-- only the gendered illustration to anonymous viewers.
--
-- Default false (photos visible) preserves prior behaviour. Admins can
-- flip it per clan in Settings; share-view/index.ts reads the flag
-- and skips the signed-URL minting when on.
-- ============================================================================

alter table public.clans
  add column if not exists hide_photos_in_share boolean not null default false;
