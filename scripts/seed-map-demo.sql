-- Dữ liệu GIẢ để kiểm tra trang Bản đồ (/clans/:id/map). CHỈ chạy trên DB local / dev, KHÔNG chạy trên prod.
--
--   docker exec -i supabase_db_family-tree-v3 psql -U postgres -d postgres -v clan=<uuid-dòng-họ> -f - < scripts/seed-map-demo.sql
--
-- Chạy lại được (idempotent): xoá địa chỉ giả cũ + di sản "[Demo bản đồ]" của dòng họ rồi dựng lại.
-- Phân bố có trọng số kiểu một dòng họ thật: tập trung ở vài tỉnh, rải rác ở nơi khác, vài người ở nước ngoài.
\set ON_ERROR_STOP on
begin;

delete from public.person_addresses where clan_id = :'clan';
delete from public.heritage_items where clan_id = :'clan' and title like '[Demo bản đồ]%';

-- Trọng số theo mã tỉnh (34 tỉnh sau sáp nhập): Hà Nội, Thanh Hoá, Nghệ An, Hải Phòng, TP.HCM...
create temp table w(code text, weight int) on commit drop;
insert into w values
  ('01',18),('38',14),('40',10),('31',8),('79',16),('48',6),('92',4),('75',4),('68',3),('22',4),
  ('46',3),('56',3),('33',3),('37',3),('25',2),('24',2),('19',2),('14',1),('15',1),('04',1),
  ('42',2),('44',1),('51',1),('52',1),('66',1),('80',1),('82',1),('86',1),('91',1),('96',1);

-- Bảng dải tích luỹ để chọn tỉnh theo trọng số.
create temp table wr as
  select code, sum(weight) over (order by code) - weight as lo, sum(weight) over (order by code) as hi from w;

-- ~70% người có địa chỉ trong nước (xã/phường chọn ngẫu nhiên trong tỉnh); ~5% ở nước ngoài; còn lại để trống.
with tot as (select max(hi) as t from wr),
picked as (
  select p.id as person_id, p.clan_id, random() as r1, floor(random() * (select t from tot))::int as pick
  from public.persons p
  where p.clan_id = :'clan' and p.deleted_at is null
)
insert into public.person_addresses (person_id, clan_id, province_code, ward_code, street_detail, country)
select pk.person_id, pk.clan_id,
       case when pk.r1 < 0.70 then wr.code end,
       case when pk.r1 < 0.70 then (select w2.code from public.vn_wards w2 where w2.province_code = wr.code order by random() limit 1) end,
       case when pk.r1 < 0.70 and random() < 0.4 then 'Số ' || (1 + floor(random() * 90))::int || ', thôn Demo' end,
       case when pk.r1 >= 0.70 and pk.r1 < 0.75 then 'US' else 'VN' end
from picked pk
join wr on pk.pick >= wr.lo and pk.pick < wr.hi
where pk.r1 < 0.75;

-- Mộ phần: gán tỉnh + toạ độ GPS cho các nơi an nghỉ có sẵn (xoay vòng Thanh Hoá / Hà Nội / Nghệ An / Hải Phòng).
with g as (
  select id, row_number() over (order by created_at) as rn from public.resting_places
  where clan_id = :'clan' and deleted_at is null
), pv as (select * from (values (1,'38',19.8067,105.7852),(2,'01',21.0285,105.8542),(3,'40',18.6796,105.6813),(4,'31',20.8449,106.6881)) v(rn, code, lat, lng))
update public.resting_places r
   set province_code = pv.code, latitude = pv.lat, longitude = pv.lng,
       ward_code = (select w2.code from public.vn_wards w2 where w2.province_code = pv.code order by random() limit 1)
  from g join pv on pv.rn = ((g.rn - 1) % 4) + 1
 where r.id = g.id;

-- Di sản kiểu nơi chốn (từ đường / đền / chùa).
-- Hai mục có GPS (ghim đỏ), một mục chỉ có tỉnh (ghim xám ở tâm tỉnh).
insert into public.heritage_items (clan_id, category, title, province_code, ward_code, location_name, latitude, longitude)
select :'clan', 'place', t.title, t.code,
       (select w2.code from public.vn_wards w2 where w2.province_code = t.code order by random() limit 1), t.loc, t.lat, t.lng
from (values
  ('[Demo bản đồ] Từ đường họ', '38', 'Làng gốc', 19.8300::float8, 105.7700::float8),
  ('[Demo bản đồ] Đền thờ tổ', '01', 'Khu phố cổ', 21.0340::float8, 105.8500::float8),
  ('[Demo bản đồ] Chùa họ', '40', 'Quê nội', null::float8, null::float8)
) as t(title, code, loc, lat, lng);

commit;

select 'người có tỉnh' as m, count(*) from public.person_addresses where clan_id = :'clan' and province_code is not null
union all select 'người ở nước ngoài', count(*) from public.person_addresses where clan_id = :'clan' and country <> 'VN'
union all select 'mộ có tỉnh', count(*) from public.resting_places where clan_id = :'clan' and province_code is not null
union all select 'di sản có tỉnh', count(*) from public.heritage_items where clan_id = :'clan' and province_code is not null;
