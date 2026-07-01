-- Sổ tay Văn hoá: cho PUBLIC (khách chưa đăng nhập) đọc bài đã publish, để
-- link chia sẻ ra ngoài (Zalo/Facebook) mở được mà không cần tài khoản.
-- Chỉ thêm quyền ĐỌC cho anon với bài published; ghi vẫn chỉ platform admin;
-- bookmark vẫn chỉ cho user đăng nhập.

grant select on public.custom_entries to anon;

create policy custom_entries_public_read on public.custom_entries
  for select to anon
  using (status = 'published');
