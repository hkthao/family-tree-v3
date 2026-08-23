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
có icon. Văn bản này chỉ chốt lại và nói rõ phần còn thiếu.

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

Script **không chặn commit**. Nó để biết còn nợ bao nhiêu, vì có những chỗ cố ý
không icon (xem mục "Không lạm dụng") mà máy không phân biệt được.

## Tình trạng

| Mốc | Còn thiếu |
|-----|----------:|
| Khi bắt đầu | 292 |
| **Hiện tại** | **258** (92 Button · 109 Input · 32 select · 25 textarea) |

Đã làm xong, chọn theo **lưu lượng thật** chứ không theo thứ tự file:

- `Login` · `Signup` — cửa đăng nhập, nơi phân tích tháng 8 cho thấy một nửa số
  phiên rời đi. Sửa chỗ này trước là hợp lý nhất.
- `NewPerson` · `EditPerson` — màn nhập liệu lõi, 145 lượt sửa người trong tháng 8.
- `People` — 994 lượt xem, nhiều nhất app. Bốn ô lọc chuyển sang `<Select>`.
- `Account` — ô đổi tên, đổi email, đổi mật khẩu.
- `AiSettingsTab` — màn mới, làm chuẩn ngay từ đầu.

Còn lại chủ yếu là **form ít dùng** (`CustomsForm`, `RestingPlaceForm`,
`HeritageForm`, `InlawsNew`) và tab quản trị. Sửa dần, mỗi lần đụng vào màn nào
thì dọn màn đó — đừng làm một lần 258 chỗ, vì mỗi ô cần chọn icon đúng nghĩa
chứ không phải gắn bừa cho hết cảnh báo.
