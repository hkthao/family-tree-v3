-- ============================================================================
-- book-exports — nơi tạm giữ Sổ gia phả PDF do Zalo Mini App dựng.
--
-- Trong Zalo không tải file kiểu trình duyệt được (tạo link tạm rồi bấm);
-- Zalo chỉ mở/tải tài liệu từ một ĐỊA CHỈ thật. Nên Mini App dựng PDF, đẩy
-- lên đây, xin một địa chỉ có chữ ký ngắn hạn rồi đưa cho trình xem của Zalo.
--
-- Bucket RIÊNG TƯ. Mỗi người chỉ đụng được thư mục mang chính id của mình
-- (`<uid>/…`): sổ chứa thông tin cả dòng họ, người khác không được đọc dù
-- biết tên file. Mini App ghi đè một file cố định cho mỗi dòng họ
-- (`<uid>/<clan_id>.pdf`) nên không tích dần rác.
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('book-exports', 'book-exports', false)
  on conflict (id) do nothing;

create policy "book-exports select own"
  on storage.objects for select to authenticated
  using (bucket_id = 'book-exports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "book-exports insert own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'book-exports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "book-exports update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'book-exports' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'book-exports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "book-exports delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'book-exports' and (storage.foldername(name))[1] = auth.uid()::text);
