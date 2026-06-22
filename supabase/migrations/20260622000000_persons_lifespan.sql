-- "Tuổi thọ" tự ghi cho người đã mất (hưởng thọ X tuổi). Tự ghi vì các
-- cụ đời trước thường chỉ truyền lại tuổi thọ, không có đủ ngày sinh/mất
-- để tính. Cây gia phả + hồ sơ hiển thị giá trị này; nếu trống thì có
-- thể suy ra từ năm sinh/mất.

alter table public.persons
  add column if not exists lifespan_years int
    check (lifespan_years is null or (lifespan_years >= 0 and lifespan_years <= 150));
