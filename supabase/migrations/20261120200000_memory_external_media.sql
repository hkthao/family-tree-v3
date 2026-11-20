-- Đóng góp ảnh / ghi âm bằng LINK ngoài (Google Photos, Drive, YouTube…) thay vì tải tệp lên:
-- server self-host hạn chế ổ cứng (docs/plan-dong-gop-cong-dong.md). Chỉ nhận https; không tải về.

alter table public.person_memories
  add column if not exists external_url text
    check (external_url is null or (external_url ~ '^https://[^\s]+$' and char_length(external_url) <= 1000));

-- Ảnh / ghi âm: có tệp trong bucket HOẶC link ngoài.
alter table public.person_memories drop constraint if exists person_memories_has_content;
alter table public.person_memories add constraint person_memories_has_content check (
  (kind in ('story', 'answer') and body is not null and char_length(btrim(body)) > 0)
  or (kind in ('photo', 'audio') and (media_path is not null or external_url is not null))
);
