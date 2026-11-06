# Ngôn ngữ thiết kế

Năm quy ước trình bày của app. Quy ước icon là phần dài nhất nên đứng đầu; ba
phần sau (ngày, lưới, danh sách) cùng một loại lỗi: **không ai thấy khi review
code, chỉ lộ ra trên máy người dùng.** Phần ngăn kéo gom cách xem / sửa một bản
ghi và thứ tự nút.

- [Control phải có icon](#control-phải-có-icon)
- [Hiển thị ngày](#hiển-thị-ngày)
- [Lưới trên màn hẹp](#lưới-trên-màn-hẹp)
- [Màn hình danh sách: Danh bạ là chuẩn](#màn-hình-danh-sách-danh-bạ-là-chuẩn)
- [Ngăn kéo xem / sửa](#ngăn-kéo-xem--sửa)

---

# Control phải có icon

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

Hành động của cả thẻ **không đặt ở header** (vd nút "Thêm ảnh" cạnh tiêu đề):
- `Card` → `<CardFooter className="justify-end gap-2 border-t pt-4">`.
- `SectionCard` → prop `footer` (hàng căn phải dưới cùng thẻ), ví dụ link
  "Xem tất cả →". Prop `action` ở header **chỉ dành cho thông tin phụ không bấm
  được** ("3 sự kiện", dung lượng đã dùng).

**Cùng một hàng thì cùng một `size`.** Trộn `size="sm"` (h-10) với mặc định
(h-12) cho ra hai nút cao thấp so le, nhìn như lỗi dựng trang. Muốn nhấn nút
chính thì đổi `variant`, đừng đổi chiều cao.

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

### Hàng nút phải xuống dòng được trên điện thoại

Dùng `<FormActions>` cho hàng nút cuối form. Màn hẹp nhất ghi nhận được là
320px; ba nút "Lưu" · "Lưu & thêm nữa" · "Hủy" cộng lại ~420px, mà
`flex … justify-end` **không tự xuống dòng** — phần dư bị đẩy ra ngoài mép
TRÁI, nơi không cuộn tới được. Nút biến mất chứ không phải bị cắt nửa.

```tsx
<FormActions>
  <Button variant="outline">Hủy</Button>
  <Button type="submit">Lưu</Button>
</FormActions>
```

Với hàng nút không thuộc form (thanh chọn hàng loạt, hàng nút ở trang chi
tiết) thì tối thiểu phải có `flex-wrap`.

Kiểm bằng máy, đừng kiểm bằng mắt: mở app ở 360px rồi tìm phần tử có
`getBoundingClientRect().left < 0` hoặc `right > innerWidth`. Trang app đặt
`overflow-x-clip` nên tràn KHÔNG tạo thanh cuộn — nhìn ảnh chụp rất dễ tưởng
là bình thường.

### Nút xoá dùng đúng một kiểu

| Việc | Kiểu |
|------|------|
| Xoá một mục, có hộp xác nhận, khôi phục được | `variant="destructive-outline"` |
| Không hoàn tác được (xoá tài khoản, xoá sạch danh bạ) | `variant="destructive"` |

Trước đây mỗi nơi ghép một kiểu (`outline` + `text-destructive`, `outline`
trơn, `destructive` nền đặc) nên cùng một hành động lại trông khác nhau tuỳ
màn. Nền đỏ đặc để dành cho điểm dừng cuối — dùng khắp nơi thì nó hết sức
cảnh báo.

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


---

# Hiển thị ngày

## Quy tắc

**Không bao giờ in chuỗi ngày của máy ra cho người đọc.** `2026-09-20` là cách
cơ sở dữ liệu lưu; người Việt đọc `20/09/2026`.

| Loại dữ liệu | Dùng hàm | Ra |
|---|---|---|
| Ngày lịch `yyyy-mm-dd` (ngày sinh, ngày sự kiện) | `formatDateOnly()` | `20/09/2026` |
| Mốc thời gian có giờ (`created_at`…) | `formatDate()` / `formatDateTime()` | `20/09/2026`, `20/09/2026 14:05` |
| Thời gian tương đối | `formatRelative()` | `3 ngày trước` |
| Ngày của một **sự kiện** (dương hoặc âm) | `eventWhenText()` | `20/09/2026 (dương lịch)` · `Ngày 3 tháng 3 (ÂL)` |
| Chỉ cần năm | `.slice(0, 4)` là được | `cụ Tường (1920–1998)` |

## Hai cái bẫy, đều đã sập

**1. Múi giờ.** `new Date("2026-09-20")` là *nửa đêm UTC*. Người dùng ở Mỹ mở
app sẽ thấy **19/09** — ngày giỗ lùi một ngày. Vì thế `formatDateOnly()` cắt
chuỗi chứ không đụng tới `Date`. Chỉ dùng `formatDate()` cho thứ THẬT SỰ có giờ.

**2. Ngày chảy sang chỗ khác.** Chuỗi ngày trong danh sách sự kiện được dùng lại
làm phụ đề **thiệp chia sẻ**. Một chỗ ghép sai là cả dòng họ nhận được tấm thiệp
in `2026-09-20`. Nên mọi nơi hỏi "sự kiện này ngày nào" đều gọi
`eventWhenText()` — đừng tự ghép lại.

---

# Lưới trên màn hẹp

## Quy tắc

Lưới có cột theo breakpoint thì **phải khai báo luôn cột cho màn hẹp**:

```tsx
<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">   // ✅
<ul className="grid gap-2 sm:grid-cols-2">               // ❌ tràn ngang
```

## Vì sao

Thiếu `grid-cols-1`, cột ngầm của CSS Grid là `auto` — nó **nở theo nội dung**,
không co theo màn hình. `min-w-0` ở bên trong không cứu được, vì chính cái ô lưới
mới là thứ nở ra.

Đo thật trên hàng "Sự kiện sắp tới" ở Tổng quan, màn 390px:

| | Bề ngang một hàng | Trang |
|---|---:|---|
| `grid gap-1.5 sm:grid-cols-2` | **523px** | trôi ngang, chữ "Còn 4 ngày" bị cắt |
| thêm `grid-cols-1` | **390px** | vừa khít, tên dài tự cắt bằng ba chấm |

Khai báo `grid-cols-1` biến cột thành `minmax(0, 1fr)` — đó mới là thứ `truncate`
và `min-w-0` cần để làm việc.

Ngoại lệ hợp lệ: `lg:grid lg:grid-cols-[...]` — màn hẹp không phải lưới, mà là
khối xếp chồng bình thường.

---

# Màn hình danh sách: Danh bạ là chuẩn

Mọi màn hình danh sách theo **Danh bạ** (`src/pages/clan/People.tsx`). Lệch khỏi
chuẩn chỉ khi dữ liệu không phải "danh sách để duyệt" (xem Ngoại lệ).

## Bố cục, từ trên xuống

1. `PageHeader` (có `Breadcrumb` ở màn con của một dòng họ).
2. **Một hàng tìm kiếm**: `CollapsibleFilters` + `SearchInput`, phễu nằm *trong* ô
   tìm kiếm. **Mọi bộ lọc nằm trong ngăn kéo của phễu** — loại, trạng thái, vùng,
   và cả việc chọn *nguồn* (vd "Của dòng họ / Sổ tay Văn hoá", "Tỉnh / Xã").
   Không có chip lọc hay tab hiện sẵn trên trang. Phễu hiện số bộ lọc đang bật;
   ngăn kéo có "Đặt lại".
3. **Danh sách một khung chia vạch**:
   `ul.divide-y.overflow-hidden.rounded-xl.border.bg-card.shadow-sm`, mỗi dòng
   `p-3`, `hover:bg-muted/40`, bấm cả dòng.
4. **`Pagination` luôn hiện** (không ẩn khi ít dòng), có chọn 10/20/50 mỗi trang.
5. **Nút nổi `Fab`** để thêm — không nút "Thêm" ở header hay trong thanh lọc.

## Dòng danh sách

- Ô ảnh / icon bên trái là **ô bo góc nằm trong phần đệm của dòng**, cao bằng phần
  nội dung (`HeritageThumb flush`), cỡ vừa (56px, icon 20px). Không dán sát mép thẻ,
  không to hơn chữ — đã thử cả hai và đều xấu.
- Dòng **không có ảnh** (Quỹ họ, Bảng vàng…) vẫn có ô bên trái: `IconTile`
  (`src/components/IconTile.tsx`) — icon + tông màu cùng loại với chip của dòng
  (Thu = tải xuống / xanh, Chi = tải lên / đỏ; công đức theo loại).
- Thứ tự trong dòng: **tên → thông tin (nơi chốn, mô tả) → ngày tạo/cập nhật →
  hàng chip căn phải ở dòng cuối cùng.**
- **Thông tin dài không làm chip.** Tên nghĩa trang, địa chỉ, nơi chôn cất → dòng
  chữ có icon dưới tên (cho xuống dòng, `line-clamp-2`). Chip chỉ cho giá trị
  *ngắn, rời rạc*: loại, trạng thái, số lượng.

## Chip (`src/components/Chip.tsx`)

- **Mọi chip đều có icon** và mỗi nhóm một màu — chip có icon xen chip không icon
  trông lệch.
- Tông theo nghĩa: `success` = tốt / hiện hữu / thu; `warning` = cần để ý / cải
  táng; `danger` = có vấn đề / thất lạc / chi; `info`, `teal`, `violet`, `rose`,
  `orange`, `indigo` = phân loại, chọn để các chip cạnh nhau khác màu.
- **Không chỉ dựa vào màu**: luôn có chữ. Chip không bấm được.
- Một nguồn cho cả chip và ô ảnh đại diện (`heritageCategoryStyle.ts`,
  `restingPlaceStyle.ts`) để hai nơi luôn cùng màu, cùng hình.

## Trạng thái

- Đang tải: hộp `rounded-xl border bg-card p-4` + "Đang tải…".
- Trống: `EmptyState` có icon; **hai thông điệp riêng** — "không khớp bộ lọc" (kèm
  gợi ý bỏ bộ lọc) và "chưa có dữ liệu" (kèm gợi ý nút +).

## Phân trang và URL

Danh sách tải đủ rồi cắt trang ở client dùng `useClientPaging`
(`src/hooks/useClientPaging.ts`): số trang nằm trên URL (`?trang=`).

**Bẫy:** hai setter `useUrlState` gọi liền nhau **ghi đè nhau** (react-router đọc
params của lần render, không phải bản mới nhất). Đổi bộ lọc *và* về trang 1 phải
là một lần ghi: `patchAndResetPage({ loai: "story" })`. Đừng viết
`setLoai(x); setPage("")`.

## Ngoại lệ hợp lệ

- Thư viện ảnh / video (Phòng ký ức, Video): lưới thẻ có hình.
- Dòng tin (Bảng tin): thẻ bài viết, phân trang phía máy chủ — chỉ đồng bộ trạng
  thái trống, tải và chọn số bài mỗi trang.
- Sự kiện: giữ `UpcomingEventRow` vì dùng chung với trang Hôm nay; chỉ đồng bộ
  tìm kiếm / ngăn kéo / phân trang.
- Công cụ thao tác (Việc làm, Gộp trùng): không phải danh sách để duyệt.

---

# Ngăn kéo xem / sửa

Bấm một dòng **không chuyển trang**: mở ngăn kéo bên phải.

## Hai bước: xem rồi mới sửa

1. **Xem** = chính *form sửa* ở chế độ **chỉ đọc** — không dựng một bản "xem nhanh"
   riêng (hai bản sẽ lệch nhau mỗi lần thêm trường). Bật bằng
   `EmbeddedForm.readOnly` (hoặc `readOnly` của form).
   - Toàn bộ ô nằm trong `<fieldset disabled>`; thêm
     `[&_:disabled]:!opacity-100 !cursor-default` để chữ vẫn rõ, không mờ như ô
     bị khoá thông thường.
   - **Nút chỉnh sửa trong thân form ẩn đi** (Gắn người, dấu X gỡ người, Lấy vị trí
     hiện tại, Thêm đoạn, ▲ ▼ ✕): gắn `data-edit-only`, khung chỉ đọc có
     `[&_[data-edit-only]]:hidden`.
   - Thanh nút dính đáy chỉ còn **một nút "Sửa"** (chính), và chỉ hiện với người
     có quyền sửa.
2. **Sửa** = bấm "Sửa" thì ngăn kéo **chuyển sang form sửa** (không chuyển route).
   "Hủy" ở form sửa quay về ngăn kéo xem; "Lưu" xong thì đóng.

Xoá nằm **trong form sửa**, không ở từng dòng danh sách.

## Khối dùng chung

Màn mới (nhất là màn quản trị) không tự dựng lại — dùng:

- `ReadOnlyFieldset` (`ui/readonly-fieldset.tsx`): khung bọc các ô, `readOnly` thì khoá
  nhưng giữ chữ rõ và ẩn `data-edit-only`.
- `ViewEditActions` (`ui/view-edit-actions.tsx`): thanh nút dính đáy đúng thứ tự —
  xem `[ Sửa ]`, sửa `[ Xoá ] [ Hủy ] [ Lưu ]`, tạo `[ Hủy ] [ Thêm ]`.
- `IconTile`, `Chip`: ô icon bên trái và chip ở dòng cuối của mỗi dòng danh sách.
- `useClientPaging` + `useSearchBox` (`hooks/useClientPaging.ts`): phân trang và ô tìm
  kiếm có debounce, cả hai nằm trên URL. Đổi từ khoá / bộ lọc thì về trang đầu trong
  một lần ghi URL.

Khuôn một màn quản trị dạng danh sách (Người dùng, Dòng họ, Góp ý, Thông báo, Podcast):
tìm kiếm + phễu (bộ lọc trong ngăn kéo) → danh sách chia vạch có `IconTile` và chip →
`Pagination` → ngăn kéo xem (chỉ đọc) → "Sửa" → form sửa. Thao tác nguy hiểm (khoá, cấp
quyền, đổi trạng thái) là *trường của form sửa* (checkbox / ô chọn), áp dụng khi Lưu —
không phải nút rời trên dòng.

## Cách điều khiển

- Màn có route chi tiết: `?panel=<id>-view|-edit&pid=` qua `PanelLink` — Back đóng
  ngăn kéo, tải lại khôi phục ngăn kéo, Ctrl/Cmd-click vẫn mở route đầy đủ. Thêm
  loại mới = một `PanelId` trong `usePanel.ts` + một nhánh trong `PanelHost.tsx`.
- Màn chỉ có danh sách (Quỹ họ, Bảng vàng, Danh mục địa giới): trạng thái cục bộ
  `{ mode: "new" | "view" | "edit", … }`. Khác biệt đã biết: Back không đóng ngăn
  kéo, tải lại thì đóng.
- `SidePanel`: `guard={false}` cho chế độ xem (không hỏi "bỏ thay đổi").

## Thanh nút dính đáy

- Dùng `FormActions` — trong ngăn kéo nó tự thành `PanelActionBar` dính đáy.
- **Nút co theo nội dung, dồn phải; đệm hai bên bằng lề của nội dung** — mép phải nút chính thẳng hàng với mép phải các ô nhập, kể cả khi ngăn kéo có thanh cuộn (không để nút nhô ra sát thanh cuộn). Không `flex-1` / full-width (đã bỏ — nút
  giãn kín chiều ngang trông thô và khó phân biệt nút chính).
- **Thứ tự: phá huỷ → phụ → chính**, chính ngoài cùng bên phải. Ví dụ đầy đủ:

  `[ Xoá ]  [ Hủy ]  [ Lưu ]`  ·  tạo mới: `[ Hủy ]  [ Lưu ]`  ·  xem: `[ Sửa ]`

- **Chính = nền đặc** (variant mặc định). Đừng để "Lưu" là `outline` — cạnh "Hủy" cũng
  `outline` thì không còn nút nào nổi bật.
- Xoá dùng `variant="destructive-outline"` (xem "Nút xoá dùng đúng một kiểu").
- "Hủy" luôn có ở form tạo / sửa — kể cả form chỉ có Xoá và Lưu.

## Trường trong ngăn kéo hẹp (~32rem)

- Trường dài mỗi trường **một hàng riêng** (Mục đích, Ngày, Tên…). Chỉ ghép hai
  cột khi cả hai trường đều ngắn (Số tiền + Quỹ).
- Ghi chú dùng `Textarea` (tự giãn theo nội dung, tối thiểu 3 dòng) — không dùng
  ô một dòng `Input`.
- Ô ngày, toạ độ… đều phải có icon (quy ước icon ở đầu tài liệu).

---

# Kiểm tự động

```bash
npx vitest run src/test/ui/conventions.test.ts
```

Hai phép kiểm quét mã nguồn: lưới thiếu cột nền, và ngày thô lọt ra giao diện.
Khác script icon (chỉ liệt kê), hai phép này **chặn CI** — vì cả hai lỗi đều
từng ra tới tay người dùng rồi mới có người báo.
