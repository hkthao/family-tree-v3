-- Cho phép chia sẻ công khai một mục di sản (heritage_items) qua share link,
-- giống root_resting_place_id / root_person_id đã có. Edge function share-view
-- đọc bằng service_role nên không cần policy cho anon.

alter table public.share_links
  add column root_heritage_item_id uuid
    references public.heritage_items(id) on delete cascade;
