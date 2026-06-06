-- Audit logging for person_links.
--
-- Each lifecycle event (propose, confirm, revoke, delete) lands in
-- audit_log so admin A can replay the history of a link from
-- /clans/:id/audit alongside person/family/branch changes.
--
-- We log under clan_a_id (the proposer's side) because:
--   1. A side is always set; B side only after confirm.
--   2. The proposer drove the lifecycle and gets the canonical trail.
-- Admin B sees the same data via /inlaws (status + counterparts);
-- they don't need a parallel audit row.
--
-- Restore via restore_audit_entry is intentionally NOT extended: the
-- protect_person_link_transitions trigger blocks rollback to pending,
-- and re-inserting a previously-revoked link would conflict with the
-- partial unique index. The audit row is informational; admins
-- re-propose to recreate a link.

------------------------------------------------------------------------
-- 1. Extend audit_log.entity_type to accept 'person_link'.
------------------------------------------------------------------------
alter table public.audit_log
  drop constraint audit_log_entity_type_check;
alter table public.audit_log
  add constraint audit_log_entity_type_check
  check (entity_type in ('person', 'family', 'branch', 'person_link'));

------------------------------------------------------------------------
-- 2. Trigger function — same shape as write_audit_log but keyed by
--    clan_a_id rather than the generic NEW.clan_id (which doesn't
--    exist on person_links). Each row writes ONE audit entry.
------------------------------------------------------------------------
create or replace function public.write_person_link_audit()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if TG_OP = 'INSERT' then
      insert into public.audit_log(
        clan_id, entity_type, entity_id, action, before, after, changed_by
      )
      values (
        NEW.clan_a_id, 'person_link', NEW.id, 'insert',
        null, to_jsonb(NEW), auth.uid()
      );
      return NEW;

    elsif TG_OP = 'UPDATE' then
      insert into public.audit_log(
        clan_id, entity_type, entity_id, action, before, after, changed_by
      )
      values (
        NEW.clan_a_id, 'person_link', NEW.id, 'update',
        to_jsonb(OLD), to_jsonb(NEW), auth.uid()
      );
      return NEW;

    elsif TG_OP = 'DELETE' then
      insert into public.audit_log(
        clan_id, entity_type, entity_id, action, before, after, changed_by
      )
      values (
        OLD.clan_a_id, 'person_link', OLD.id, 'delete',
        to_jsonb(OLD), null, auth.uid()
      );
      return OLD;
    end if;

    return null;
  end;
  $$;

create trigger person_links_audit_trg
  after insert or update or delete on public.person_links
  for each row execute function public.write_person_link_audit();
