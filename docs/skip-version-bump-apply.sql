\set ON_ERROR_STOP on
begin;
\i /tmp/migration_skip_bump.sql
-- TEST 1: service_role sửa người dòng họ lịch sử → data_version KHÔNG đổi
savepoint t1;
select data_version as v1 from public.clans where kind='historical' order by id limit 1 \gset
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
update public.persons set bio = coalesce(bio,'') || ' ' where id = (select id from public.persons where clan_id = (select id from public.clans where kind='historical' order by id limit 1) limit 1);
reset role;
select data_version as v2 from public.clans where kind='historical' order by id limit 1 \gset
rollback to savepoint t1;
-- TEST 2: admin (authenticated) sửa → data_version TĂNG
savepoint t2;
select data_version as w1 from public.clans where kind='historical' order by id limit 1 \gset
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"03034d18-8866-4246-a027-6b5bffc55fa9","role":"authenticated"}',true);
update public.persons set bio = coalesce(bio,'') || ' ' where id = (select id from public.persons where clan_id = (select id from public.clans where kind='historical' order by id limit 1) limit 1);
reset role;
select data_version as w2 from public.clans where kind='historical' order by id limit 1 \gset
rollback to savepoint t2;
select (:v2 = :v1 and :w2 > :w1) as ok \gset
select :v1 as service_truoc, :v2 as service_sau, :w1 as admin_truoc, :w2 as admin_sau;
\if :ok
  \echo 'KIEM TRA DAT -> commit'
  commit;
  insert into supabase_migrations.schema_migrations(version,name) values ('20261101150000','skip_version_bump_historical_import') on conflict do nothing;
\else
  \echo 'KIEM TRA KHONG DAT -> rollback'
  rollback;
\endif
