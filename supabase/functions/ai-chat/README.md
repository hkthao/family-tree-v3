# ai-chat — trợ lý hỏi đáp gia phả

GĐ 0 + 1 của [docs/plan-ai-tro-ly.md](../../../docs/plan-ai-tro-ly.md): gateway đa nhà
cung cấp + khung chat **chỉ đọc**. Chưa có giọng nói (GĐ 2), hạn mức (GĐ 3), thanh toán
(GĐ 4) hay bóc tách nhập liệu (GĐ 5).

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
ai-chat/index.ts  vòng lặp gọi tool, rate limit, ghi ai_usage
```

## Khoá API — KHÔNG để trong `platform_settings`

`platform_settings` có policy `using (true)`, tức **đọc công khai**. Đó là chỗ để
*tên model*, không phải chỗ để khoá. Khoá đi qua env, giống cách SMTP đang làm:

```yaml
# /root/supabase/docker-compose.override.yml trên VPS
services:
  functions:
    environment:
      OPENAI_API_KEY: sk-...
      # ANTHROPIC_API_KEY / DEEPSEEK_API_KEY nếu muốn đổi provider
```

## Triển khai

```bash
# 1. Migration (áp tay — deploy-vps.yml không chạy migration)
ssh family-tree-db
docker exec -i supabase-db psql -U postgres -d postgres \
  < 20260823120000_ai_usage.sql
# nhớ ghi vào schema_migrations

# 2. Đẩy function
scp -r supabase/functions/_shared supabase/functions/ai-chat \
  root@72.61.143.145:/root/supabase/volumes/functions/

# 3. Khởi động lại
ssh family-tree-db 'cd /root/supabase && docker compose up -d --force-recreate functions'
```

## Bật

Mặc định **tắt**. Hai công tắc, phải bật cả hai:

```sql
update platform_settings set value = 'true' where key = 'ai.enabled';
```

và trong app: Cài đặt dòng họ → Tính năng hiển thị → bật **Trợ lý AI**
(`clans.disabled_features` không chứa `ai_assistant`).

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
| Rate limit | 5 lượt / 5 phút / người | Chống bấm nhanh và vòng lặp lỗi ở client — **không phải** hạn mức kinh doanh |
| Ngữ cảnh gửi lên | 8 lượt gần nhất | Client lưu 40 tin để hiển thị; gửi hết sẽ làm token đầu vào phình lên nhiều lần |
| Timeout | 60s | Người dùng đang ngồi chờ |

## Chưa làm

- Trần chi phí toàn hệ thống (`$20/ngày`) — GĐ 3, cùng với `credit_ledger`.
- Streaming: hiện trả về nguyên câu, UI hiện "Đang nghĩ…". Đủ dùng ở GĐ 1.
