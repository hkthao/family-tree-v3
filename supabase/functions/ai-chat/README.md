# ai-chat — trợ lý hỏi đáp gia phả

GĐ 0 + 1 của [docs/plan-ai-tro-ly.md](../../../docs/plan-ai-tro-ly.md): gateway đa nhà
cung cấp + khung chat **chỉ đọc**, cộng phần GĐ 2 chạy hoàn toàn ở client (lịch sử
`ai_messages` + nhập bằng giọng nói qua Web Speech API — **không** qua edge function
này, xem `src/lib/speech.ts`) hạn mức GĐ 3 (`credit_ledger`) và bóc tách
nhập liệu GĐ 5 (`propose_persons` + thẻ xác nhận). Chưa có thanh toán (GĐ 4).

## Có gì

```
_shared/llm/
  types.ts        shape nội bộ — CỐ TÌNH không có temperature/top_p/top_k
  registry.ts     danh mục model: giá, endpoint, biến env chứa khoá
  env.ts          đọc env qua globalThis (để vitest ở Node import được)
  gateway.ts      chọn adapter, timeout 60s, retry 3 lần có backoff
  adapters/openai-compatible.ts   OpenAI · DeepSeek · Groq · vLLM tự host…
  adapters/anthropic.ts           SDK chính thức của Anthropic
_shared/vendor/   bản sao kinship.ts + lunarDate.ts (xem bên dưới)
ai-chat/tools.ts  5 tool chỉ đọc
ai-chat/proposal.ts  tool ĐỀ XUẤT thêm người + kiểm lại đầu ra của model
ai-chat/index.ts  vòng lặp gọi tool, rate limit, trừ lượt, ghi ai_usage
```

## Bóc tách nhập liệu (GĐ 5)

Người dùng KỂ thay vì hỏi ("Bố tôi là Nguyễn Văn A, sinh 1940") → model gọi
`propose_persons` → máy chủ kiểm lại → trả **đề xuất** về trình duyệt → người dùng
nhìn thẻ "Tôi hiểu là:" rồi mới bấm "Đúng rồi".

**Model không bao giờ ghi vào gia phả.** Lệnh ghi cuối cùng chạy ở trình duyệt bằng
JWT của chính người dùng (`src/lib/queries/aiExtract.ts`), nên vẫn qua RLS và trigger
audit y như khi họ tự nhập tay. Kịch bản xấu nhất — model bịa người, hoặc một trường
`bio` độc hại xui model "thêm 500 người" — dừng lại ở một cái thẻ trên màn hình.

Ba chốt chặn xếp chồng:

| Chốt | Chặn gì |
|---|---|
| Chỉ editor/admin mới được ĐƯA tool | Người xem không đề xuất được. Không đưa tool, chứ không phải dặn model đừng dùng — dặn thì prompt injection lách được |
| `validateProposal` ở máy chủ | `strict` chỉ đảm bảo hình dạng JSON, không đảm bảo nội dung: tên trống, giới tính lạ, năm sinh sau năm mất, gắn vào người đứng sau, quá 10 người |
| RLS khi ghi | Client tự chế vẫn không ghi được — có test |

"Sửa lại" **không tính thêm lượt**: client gửi lại `ref` của lượt cũ, `credit_consume`
thấy ref trùng nên không trừ lần hai. Trần `MAX_FREE_RETRIES` (2 lần) chặn kiểu gửi
mãi một ref để hỏi miễn phí — đếm bằng `ai_usage.turn_ref`.

## Hạn mức (GĐ 3)

Mỗi tài khoản **10 lượt/tháng miễn phí**, trừ vào `credit_ledger` — sổ cái dùng chung
cho mọi thứ bán được, không riêng AI (xem plan §Không đặt tiền tố `ai_`).

Đổi số lượt free không cần deploy:

```sql
update platform_settings set value = '20' where key = 'ai.free_per_month';
```

Ba điều đáng nhớ khi sửa chỗ này:

- **Giữ chỗ trước, hoàn sau.** `credit_consume` chạy TRƯỚC khi gọi model; lượt hỏng
  (timeout, model lỗi, vòng lặp tool) được hoàn bằng **bút toán mới +1**, không xoá
  bút toán cũ. Không bao giờ để người dùng trả lượt cho lỗi của mình.
- **Hết lượt trả HTTP 200**, kèm `quotaExhausted: true` và câu nhắn có đường lui —
  hết hạn mức là mô hình kinh doanh, không phải lỗi. Trả 4xx là giao diện sẽ tô đỏ.
- **Chưa áp migration thì bỏ qua hạn mức** (nhận diện lỗi `42883`/`PGRST202`). Máy chủ
  self-host áp migration bằng tay nên code mới có thể lên trước DB; chặn cứng lúc đó
  là sập trợ lý cho tất cả mọi người.

## Khoá API — nhập ở màn hình quản trị, lưu đã mã hoá

**Quản trị › Trợ lý AI**: cắm khoá từng nhà cung cấp, bấm lưu là hệ thống gọi thử luôn
và báo kết nối tốt hay lỗi. Không phải ssh, không phải restart container.

Khoá được mã hoá **AES-256-GCM ngay tại edge function** trước khi vào bảng
`ai_provider_keys`; Postgres không bao giờ thấy bản rõ. Bảng đó **không có RLS policy
nào** — kể cả platform admin cũng không select được qua PostgREST, chỉ service role đọc nổi.

Cần đúng **một** biến môi trường, là khoá dùng để mã hoá các khoá kia:

```yaml
# docker-compose.override.yml (hoặc functions.env) trên máy chủ Supabase
services:
  functions:
    environment:
      AI_KEY_ENCRYPTION_KEY: <openssl rand -base64 32>
```

> ⚠️ Đổi `AI_KEY_ENCRYPTION_KEY` = mọi khoá đã lưu thành rác không giải được. Không có
> đường khôi phục, phải nhập lại ở màn hình quản trị. Cất nó cẩn thận.

**Mã hoá này chống được gì:** bản dump/backup DB bị lộ, một `select *` vô ý, một policy
RLS viết sai, khoá lọt vào log truy vấn. **Không chống được:** người đã đọc được env của
edge function — họ có luôn khoá giải mã. Đây là envelope encryption tiêu chuẩn, đổi N bí
mật lấy 1, không phải bùa hộ mệnh.

`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` trong env vẫn dùng được làm
**dự phòng** khi DB chưa có khoá. Thứ tự là **DB trước, env sau** — nếu ngược lại thì
khoá cũ trong env sẽ âm thầm che khoá mới vừa nhập, đúng kiểu lỗi khiến người ta tưởng
đã xoay khoá xong mà thật ra chưa.

**Tuyệt đối không để khoá trong `platform_settings`** — bảng đó có policy `using (true)`,
tức đọc công khai. Nó chỉ để tên model.

## Triển khai

### Cách chuẩn: chạy workflow

```bash
gh workflow run deploy-functions.yml
```

Nó đẩy toàn bộ `supabase/functions/` lên máy chủ, sinh `AI_KEY_ENCRYPTION_KEY`
nếu chưa có (**ngay trên máy chủ**, giá trị không đi qua log CI), rồi khởi động
lại container edge-functions.

Cần hai secret, thêm một lần:

```bash
gh secret set SUPABASE_HOST --body "<host>"
gh secret set SUPABASE_SSH_KEY < ~/.ssh/<private-key>
```

Riêng **migration vẫn phải áp tay** — workflow không đụng vào database:

```bash
# trên máy chủ database
for f in 20260823120000_ai_usage 20260823140000_ai_messages \
         20260823160000_ai_provider_keys 20260828120000_credit_ledger \
         20260828140000_ai_cost_guard 20260828160000_ai_turn_ref; do
  docker exec -i supabase-db psql -U postgres -d postgres < "$f.sql"
done
# rồi ghi vào supabase_migrations.schema_migrations
```

### Vì sao không dùng `--delete` khi đồng bộ

Máy chủ có sẵn `main` (router của edge runtime) và `hello` — chúng không nằm
trong repo. `rsync --delete` sẽ xoá mất `main` và làm sập toàn bộ edge function.
Workflow chỉ chồng lên những gì repo có.

Cũng vì lý do tương tự, workflow đẩy vào thư mục trung gian rồi mới rsync sang:
`volumes/functions` đang bind-mount vào container, xoá thư mục đó sẽ làm mount
treo — container giữ inode cũ nên chỉ thấy rỗng.

## Bật

Mặc định **tắt**. Hai công tắc, phải bật cả hai:

```sql
update platform_settings set value = 'true' where key = 'ai.enabled';
```

và trong app: Cài đặt dòng họ → Tính năng hiển thị → bật **Trợ lý AI**
(`clans.disabled_features` không chứa `ai_assistant`).

Rồi vào **Quản trị › Trợ lý AI** cắm khoá và bấm *Lưu & kiểm tra*.

Đổi model không cần deploy:

```sql
update platform_settings set value = 'claude-sonnet-5' where key = 'ai.model.qa';
```

Chỉ nhận id có trong `registry.ts`, và phải có khoá tương ứng trong env.

## Vì sao có thư mục `vendor/`

Deploy edge function là scp riêng `supabase/functions/`, nên `import` trỏ ra ngoài thư
mục đó sẽ không được đóng gói theo. Mà logic xưng hô (`kinship.ts`) và âm lịch
(`lunarDate.ts`) **bắt buộc phải tất định** — để LLM tự đoán chú/bác/cậu/dì hay tự tính
ngày giỗ là sai chắc chắn.

Nên có hai bản sao, và `src/test/lib/kinshipVendorCopy.test.ts` so sánh chúng phải giống
bản gốc. Sửa bản gốc mà quên chép sang là test đỏ ngay, không phải đợi phát hiện khi
trợ lý trả lời sai trên production.

```bash
cp src/lib/kinship.ts supabase/functions/_shared/vendor/kinship.ts
# rồi chèn lại khối chú thích ở đầu file (test sẽ chỉ rõ nếu thiếu)
```

## Giới hạn đang đặt

| | Giá trị | Vì sao |
|---|---|---|
| Vòng gọi tool mỗi lượt | 5 | `bio` độc hại có thể xui model gọi tool vòng vo cho tốn tiền |
| Rate limit / người | 5 lượt / 5 phút · 30 lượt / giờ | Chống bấm nhanh và vòng lặp lỗi ở client — **không phải** hạn mức kinh doanh |
| Rate limit / IP | 20 lượt / 5 phút | Tạo tài khoản mới quá dễ nên đếm theo người là chưa đủ. Nới hơn ngưỡng cá nhân vì cả nhà dùng chung một đường mạng là bình thường |
| Rate limit / dòng họ | 200 lượt / ngày | Kể cả gói trả phí |
| Hạn mức | 10 lượt / tháng / tài khoản | Mô hình kinh doanh, xem §Hạn mức |
| Trần chi phí | $20 / ngày toàn hệ thống | Chặn hoá đơn thảm hoạ khi có bug gọi API vòng lặp |
| Ngữ cảnh gửi lên | 8 lượt gần nhất | Client lưu 40 tin để hiển thị; gửi hết sẽ làm token đầu vào phình lên nhiều lần |
| Timeout | 60s | Người dùng đang ngồi chờ |

Ba điều về ngắt mạch chi phí:

- **Không tự tắt `ai.enabled`.** Trần được kiểm ở mỗi lượt hỏi nên qua ngày
  (giờ VN) là tự mở lại. Lật cờ thì phải có người vào bật tay — báo động lúc 2 giờ
  sáng đồng nghĩa trợ lý chết tới khi ai đó ngủ dậy.
- **Mail báo động mỗi ngày một lần**, chốt bằng `ai.cost_alert_sent_on`. Không có
  chốt đó thì mỗi người dùng gặp trần lại sinh một email.
- **IP được băm (SHA-256 + muối ở env), không lưu IP thật.** Rate limit chỉ cần so
  trùng, không cần biết ai ở đâu. Muối lấy từ `AI_IP_SALT`, thiếu thì mượn service
  key; đổi muối chỉ làm bộ đếm quên lịch sử cũ.

Đổi trần: `update platform_settings set value = '50' where key = 'ai.daily_cost_cap_usd';`
(đặt `'0'` để tắt hẳn ngắt mạch).

## Chưa làm

- Ví dòng họ + danh sách được duyệt tiêu — GĐ 4, cùng với `billing_*`.
- Bộ đếm rate limit đọc `ai_usage`, mà bảng đó chỉ được ghi khi lượt hỏi KẾT THÚC.
  Nghĩa là mười lượt bắn song song cùng lúc đều lọt qua cửa. Hạn mức (`credit_consume`,
  atomic) mới là thứ chặn được ca đó; rate limit chỉ lo phần bấm nhanh tuần tự.
- Streaming: hiện trả về nguyên câu, UI hiện "Đang nghĩ…". Đủ dùng ở GĐ 1.
- Whisper dự phòng cho iOS Safari (không có Web Speech): còn chờ quyết tự host
  `whisper.cpp` hay gọi OpenAI — xem plan §Việc mở. Tới lúc đó iOS Safari chỉ gõ tay,
  và nút mic **ẩn hẳn** thay vì hiện ra rồi bấm không ăn thua.
