# Ngôn ngữ thiết kế — control phải có icon

## Vì sao

Người dùng chính của app là **người lớn tuổi**. Với họ, đọc một dải chữ để tìm
đúng nút là việc mệt; nhận ra hình thì nhanh hơn nhiều. Icon không phải trang trí —
nó là **điểm neo thị giác** giúp quét màn hình mà không phải đọc.

Ba lý do cụ thể, đều đã gặp trong dữ liệu của chính app này:

1. **Chữ không phóng to được.** `index.html` đặt `user-scalable=no` và `main.tsx`
   chặn `gesturestart` (trang Cây cần thế). Mắt kém mà chữ nhỏ thì icon là thứ
   còn nhận ra được.
2. **Màn hình hẹp.** Umami ghi nhận màn 320×568 — nhãn dài bị cắt, icon thì không.
3. **Quen tay.** Người ta nhớ "cái hình cây" chứ ít khi nhớ chữ "Cây gia phả".

Quy ước này **đã tồn tại không thành văn**: 191/298 `<Button>` trong repo vốn đã
có icon. Văn bản này chốt lại, và đợt rà tháng 8/2026 đã phủ kín phần còn lại.

## Quy tắc

| Control | Bắt buộc | Vị trí icon |
|---------|----------|-------------|
| `<Button>` có chữ | ✅ | Trước chữ |
| `<Button size="icon">` | ✅ | Là toàn bộ nội dung, **bắt buộc có `aria-label`** |
| `<Input>` | ✅ | Trong ô, sát mép trái |
| `<Select>` | ✅ | Trong ô, sát mép trái (mũi tên bên phải là của trình duyệt) |
| `<Textarea>` | ⬜ tuỳ | Trên nhãn, nếu ô đứng một mình thì thường không cần |

### Kích thước

- Trong nút chữ và trong ô nhập: `h-4 w-4`
- Nút chỉ-có-icon: `h-5 w-5`, vùng chạm tối thiểu `h-11 w-11` (44px)
- Tiêu đề mục / `PageHeader`: `h-7 w-7`

### Không lạm dụng

Thêm icon vào những nút này chỉ làm nhiễu, **đừng thêm**:

- Huỷ · Đóng · Bỏ qua · Để sau · Quay lại
- Có / Không, OK, Xong
- Nút phân trang bằng số

Nguyên tắc: icon phải **nói thêm** điều gì đó. "Huỷ" ai cũng hiểu; một dấu X cạnh
chữ "Huỷ" là thừa. "Xuất Excel" thì icon tải xuống giúp nhận ra ngay giữa một dải nút.

### Đặt hành động ở đâu

Hai chỗ, chọn theo việc control có nằm trong card hay không.

**Trong card → mọi hành động dồn xuống `<CardFooter>`.**

```tsx
<Card>
  <CardHeader>…tiêu đề + chip trạng thái…</CardHeader>
  <CardContent><Input icon={<IconKey />} … /></CardContent>
  <CardFooter className="justify-between gap-3 border-t pt-4">
    <span className="text-xs text-muted-foreground">…meta…</span>
    <div className="flex flex-wrap gap-2">…nút…</div>
  </CardFooter>
</Card>
```

Vì sao không để nút cạnh ô nhập: ở màn hẹp chúng **bóp ô nhập còn vài ký tự**,
mà ô nhập mới là thứ người ta cần nhìn. Dồn xuống footer thì ô nhập luôn được
trọn chiều ngang, và mắt có một chỗ cố định để tìm nút — không phải dò từng hàng.

Thứ tự trong footer: **phá huỷ → phụ → chính**, chính nằm ngoài cùng bên phải
(gần ngón cái nhất trên điện thoại). Meta text đẩy sang trái để hai bên cân nhau.

**Không dùng card, và chỉ có ĐÚNG MỘT hành động → đưa vào trong ô nhập.**

```tsx
<Input
  icon={<IconSearch />}
  placeholder="Tìm theo tên…"
  action={
    <Button size="icon" variant="ghost" aria-label="Tìm">
      <IconArrowRight className="h-4 w-4" />
    </Button>
  }
/>
```

Một nút rời cạnh ô nhập chiếm cả một ô lưới chỉ để làm một việc hiển nhiên.
Đưa vào trong ô thì gọn hơn và quan hệ giữa ô với hành động là hiển nhiên.

Từ **hai hành động trở lên** thì đừng nhồi vào ô — bọc card rồi xuống footer.

### Nút của một dòng, không phải của cả thẻ

Rule "dồn xuống footer" chỉ áp cho hành động **của cả thẻ**. Nút thuộc về một
dòng hay một nhóm cụ thể thì ở nguyên chỗ đó:

- nút xoá từng link mời trong danh sách
- nút "Thêm" của từng nhóm quan hệ (cha mẹ / vợ chồng / con) ở trang cá nhân
- nút "Lấy vị trí hiện tại" nằm cạnh hai ô toạ độ

Kéo chúng xuống footer là mất thông tin "nút này tác động lên cái nào" — người
dùng phải đoán. Thử nhanh: nếu nhãn nút cần thêm chữ để biết nó nhắm vào đâu
("Xoá **link thứ hai**"), thì nó không thuộc về footer.

### Thẻ có form: `<form>` bọc cả content lẫn footer

```tsx
<Card>
  <CardHeader>…</CardHeader>
  <form onSubmit={…}>
    <CardContent className="space-y-4">…ô nhập…</CardContent>
    <CardFooter className="justify-end border-t pt-4">
      <Button type="submit">Lưu</Button>
    </CardFooter>
  </form>
</Card>
```

Nếu chỉ kéo nút ra ngoài `<form>`, nút submit rời khỏi form: bấm Enter trong ô
nhập không còn gửi được, mà đó lại là cách người quen máy tính hay dùng.

### Icon-only phải có nhãn cho trình đọc màn hình

```tsx
<Button size="icon" aria-label="Xoá lịch sử trò chuyện">
  <IconTrash className="h-5 w-5" />
</Button>
```

Thiếu `aria-label` là nút vô hình với người dùng trình đọc màn hình.

## Cách thêm icon vào ô nhập

Đừng tự dựng layout ở từng chỗ. Component đã nhận prop `icon`:

```tsx
import { IconSearch, IconUser } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

<Input icon={<IconSearch />} placeholder="Tìm theo tên…" />
<Select icon={<IconUser />} value={v} onChange={…}>…</Select>
<Textarea icon={<IconScroll />} label="Tiểu sử" />
```

Component tự lo padding trái, canh giữa theo chiều dọc, màu `text-muted-foreground`,
và `pointer-events-none` để icon không nuốt cú bấm vào ô.

## Bảng icon theo ngữ nghĩa

Dùng đúng bảng này để cùng một việc luôn cùng một hình, xuyên suốt app.

| Việc | Icon |
|------|------|
| Tìm kiếm | `IconSearch` |
| Thêm mới | `IconPlus` |
| Sửa | `IconPencil` |
| Xoá | `IconTrash` |
| Lưu / gửi | `IconCheck` · `IconSend` |
| Tải lên / xuống | `IconUpload` · `IconDownload` |
| Người / thành viên | `IconUser` · `IconUsers` |
| Cây gia phả | `IconTree` |
| Ngày tháng, sự kiện | `IconCalendar` |
| Địa điểm | `IconMapPin` |
| Email | `IconMail` |
| Khoá, bảo mật | `IconLock` · `IconShield` |
| Cấu hình | `IconSettings` |
| Trợ lý AI, tính năng thông minh | `IconSparkles` |
| Chia sẻ, liên kết | `IconShare` · `IconLink` |
| Ảnh, máy ảnh | `IconCamera` |
| Ghi âm, giọng nói | `IconMicrophone` |
| Tiền, quỹ | `IconWallet` |
| Mộ phần | `IconGrave` |
| Văn bản, sổ tay | `IconScroll` · `IconBook` |
| Làm mới, thử lại | `IconRefresh` |
| Khoá API, bí mật | `IconKey` |
| Cảnh báo, quan trọng | `IconFlame` |

Thiếu icon cho việc mới thì **thêm vào `src/components/icons.tsx`**, đừng import
lẻ từ thư viện khác — cả app dùng chung một bộ nét để nhìn không lệch nhau.

## Rà soát

```bash
node scripts/audit-control-icons.mjs        # liệt kê chỗ còn thiếu
node scripts/audit-control-icons.mjs --json # cho công cụ khác dùng
```

Script **không chặn commit**. Nó để biết còn nợ bao nhiêu.

Chỗ cố ý không icon thì **đánh dấu ngay tại chỗ**, kèm lý do:

```tsx
{/* icon-audit: ok — ba ô hẹp dưới 100px, nhãn đã nằm ngay trên */}
```

Dấu này che 14 dòng ngay dưới nó, đủ cho cả một khối (một hàng nhập, hai nút
của hộp thoại). **Bắt buộc có lý do sau dấu gạch** — miễn trừ không giải thích
thì lần sau không ai dám sửa. Có cơ chế này để danh sách "còn thiếu" chỉ chứa
việc thật; lẫn hơn chục chỗ cố ý vào đó là lần sau không ai buồn đọc.

## Tình trạng

| Mốc | Còn thiếu |
|-----|----------:|
| Khi bắt đầu | 292 |
| Sau đợt đầu (Login, NewPerson, People, Account…) | 258 |
| **Hiện tại** | **0** |

Đã quét hết. Con số 0 **không có nghĩa là mọi control đều có icon** — nó có
nghĩa là mọi control còn thiếu đều đã được cân nhắc, và chỗ nào cố ý bỏ trống
thì có dấu `icon-audit: ok` kèm lý do ngay tại chỗ.

Các nhóm cố ý bỏ trống, để khỏi tranh luận lại:

| Chỗ | Vì sao |
|-----|--------|
| Ba ô ngày/tháng/năm (`CalendarDateInput`) | Lưới 3 cột, mỗi ô dưới 100px; ba icon lịch giống hệt nhau chỉ gây rối |
| Hàng nhập nhiều người (`QuickAddSheet`) | Một hàng đã có số thứ tự, nút giới tính, hai ô năm và nút xoá |
| Ô nhập của khung chat | Chiếm gần hết chiều ngang, nút gửi nằm ngay cạnh |
| Nút cỡ chữ "A / A+" | Chính chữ cái là ký hiệu |
| Nút ★/☆ lưu bài | Hình sao vừa là icon vừa là trạng thái |
| Nút đăng nhập Google | Logo thương hiệu, không thuộc bộ icon chung |
| Component nhận icon qua prop (`EmptyState`, `SubscribeToggle`, `ConfirmDialog`…) | Nơi gọi quyết định icon |

Khi thêm màn mới, chạy lại script trước khi mở PR — 0 là mốc cần giữ.
