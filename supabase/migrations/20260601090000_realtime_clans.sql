-- ============================================================================
-- Realtime: subscribe clients to clans row updates.
--
-- The clans.data_version column already increments on every structural
-- change to persons/families/branches (statement-level triggers in
-- triggers.sql). By publishing UPDATE events on the clans table over
-- Supabase Realtime, every open browser tab receives a push the moment
-- another editor mutates the dataset — TanStack Query then invalidates
-- the affected client caches and the UI silently catches up.
--
-- We only need NEW (the post-update row); default REPLICA IDENTITY is
-- enough. RLS on the clans table already restricts SELECT to members /
-- public-clan viewers / platform admins, so Realtime won't leak rows
-- to users who can't see them.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'clans'
  ) then
    alter publication supabase_realtime add table public.clans;
  end if;
end$$;
