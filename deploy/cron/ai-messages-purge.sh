#!/bin/bash
# Xoá lịch sử trò chuyện với trợ lý đã quá hạn giữ (mặc định 90 ngày,
# đổi bằng platform_settings["ai.chat_retention_days"]).
#
# Vì sao là cron chứ không phải trigger: trigger chỉ cắt được số tin mỗi
# người (40 tin, đã có trong migration ai_messages). Còn hạn giữ theo
# NGÀY thì không có sự kiện nào để bám vào — người bỏ dùng trợ lý ba
# tháng trước sẽ không bao giờ ghi thêm tin để trigger chạy, và lịch sử
# của họ nằm đó mãi. Chính sách giữ 90 ngày mà không có ai xoá thì đó
# không phải chính sách, chỉ là một câu nói.
#
# Chạy thẳng psql trong container thay vì gọi Edge Function: hàm này chỉ
# service role gọi được và không cần HTTP, thêm một function chỉ để bấm
# một câu SQL là thừa.
#
# Cài trên máy chủ database:
#   scp deploy/cron/ai-messages-purge.sh family-tree-db:/root/
#   ssh family-tree-db "chmod +x /root/ai-messages-purge.sh"
#   # rồi thêm vào crontab: 40 3 * * * /root/ai-messages-purge.sh
set -euo pipefail

LOG=/root/ai-messages-purge.log
COUNT=$(docker exec -i supabase-db psql -U postgres -d postgres -tAc \
  "select public.ai_messages_purge_expired();" 2>>"$LOG")

echo "[$(date -u +%FT%TZ)] đã xoá ${COUNT:-?} tin quá hạn" >> "$LOG"
