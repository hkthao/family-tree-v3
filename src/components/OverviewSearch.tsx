import { t } from "@lingui/core/macro";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { IconSearch, IconSparkles } from "@/components/icons";
import { track } from "@/lib/analytics";

/**
 * Ô "Tìm người trong họ" ở ĐẦU Tổng quan. Số liệu Umami: tìm người (`people_searched`) là thao tác dùng nhiều thứ
 * hai của app (770 lần/90 ngày, hơn cả mở cây) nhưng trước đây phải vào Danh bạ mới có ô tìm. Nhập rồi Enter → mở
 * Danh bạ với từ khoá đã điền sẵn (`?q=`), dùng lại đúng bộ tìm không dấu của Danh bạ.
 *
 * Nếu trợ lý AI đang bật, có thêm một lối vào nhỏ dưới ô: hỏi bằng lời cho câu hỏi tìm không ra (xưng hô, giỗ…).
 */
export function OverviewSearch({
  clanId,
  aiLink = false,
}: {
  clanId: string;
  aiLink?: boolean;
}) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    track("overview_search", { hasQuery: text.length > 0 });
    navigate(
      text
        ? `/clans/${clanId}/people?q=${encodeURIComponent(text)}`
        : `/clans/${clanId}/people`,
    );
  }

  return (
    <div className="space-y-1.5">
      <form onSubmit={submit} role="search">
        <label className="relative block">
          <span className="sr-only">{t`Tìm người trong họ`}</span>
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            enterKeyHint="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t`Tìm người trong họ (gõ không dấu cũng được)…`}
            className="h-12 w-full rounded-lg border bg-card pl-9 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </form>
      {aiLink && (
        <Link
          to={`/clans/${clanId}/tro-ly`}
          onClick={() => track("overview_ai_click")}
          className="ml-1 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <IconSparkles className="h-4 w-4" />
          {t`Hoặc hỏi trợ lý AI bằng lời`}
        </Link>
      )}
    </div>
  );
}
