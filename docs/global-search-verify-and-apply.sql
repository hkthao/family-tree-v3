\set ON_ERROR_STOP on
begin;
\i /tmp/migration_global_search.sql

-- TEST 1: người dùng không thuộc dòng họ nào → KHÔNG thấy người của dòng họ riêng tư (chỉ dòng họ lịch sử công khai)
savepoint t1;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select count(*) as t1_leak from public.global_search('nguyen', 20) g
 where g.kind in ('person','grave','heritage','event','post','contribution','inlaw')
   and not exists (select 1 from public.clans c where c.id = g.clan_id and c.kind = 'historical' and c.visibility = 'public') \gset
reset role;
rollback to savepoint t1;

-- TEST 2: thành viên admin của một dòng họ thường tìm được người của dòng họ đó
savepoint t2;
select cm.user_id as uid, cm.clan_id as cid,
       (select split_part(p.full_name, ' ', array_length(string_to_array(p.full_name, ' '), 1)) from public.persons p
         where p.clan_id = cm.clan_id and p.deleted_at is null and char_length(p.full_name) > 5 limit 1) as nm
  from public.clan_members cm join public.clans c on c.id = cm.clan_id
 where cm.role = 'admin' and c.kind <> 'historical' and c.person_count > 3 limit 1 \gset
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'role', 'authenticated')::text, true);
select count(*) as t2_hits from public.global_search(:'nm', 20) g where g.kind = 'person' and g.clan_id = :'cid' \gset
select count(*) as t2_foreign from public.global_search(:'nm', 20) g
 where g.kind = 'person' and g.clan_id <> :'cid'
   and not exists (select 1 from public.clans c where c.id = g.clan_id and c.kind = 'historical' and c.visibility = 'public')
   and not (g.clan_id in (select public.my_clan_ids())) \gset
reset role;
rollback to savepoint t2;

-- TEST 3: thời gian một lần tìm (admin nền tảng, từ khoá phổ biến)
savepoint t3;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"03034d18-8866-4246-a027-6b5bffc55fa9","role":"authenticated"}',true);
select clock_timestamp() as t0 \gset
select count(*) as t3_rows from public.global_search('nguyen', 5) \gset
select round(extract(milliseconds from clock_timestamp() - :'t0'::timestamptz)::numeric, 1) as t3_ms \gset
reset role;
rollback to savepoint t3;

select :t1_leak as t1_ro_ri, :t2_hits as t2_thay_dong_ho_minh, :t2_foreign as t2_thay_dong_ho_khac, :t3_rows as t3_so_dong, :t3_ms as t3_ms;
select (:t1_leak = 0 and :t2_hits > 0 and :t2_foreign = 0 and :t3_rows > 0 and :t3_ms < 1500) as ok \gset
\if :ok
  \echo 'KIEM TRA DAT -> commit'
  commit;
  insert into supabase_migrations.schema_migrations(version,name) values ('20261101160000','global_search') on conflict do nothing;
\else
  \echo 'KIEM TRA KHONG DAT -> rollback'
  rollback;
\endif
