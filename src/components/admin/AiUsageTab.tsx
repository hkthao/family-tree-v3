import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatTokens,
  formatUsd,
  formatVnd,
  getAiUsageByClan,
  getAiUsageByModel,
  getAiUsageDaily,
  getAiUsageOverview,
  getCreditOverview,
  type AiUsageDay,
} from "@/lib/queries/aiReports";

/**
 * Báo cáo sử dụng trợ lý AI.
 *
 * Bảng này phải trả lời được bốn câu trong năm giây:
 *   1. Đang tốn bao nhiêu tiền, và có sát trần ngày không?
 *   2. Có đang hỏng nhiều không (lượt lỗi, độ trễ)?
 *   3. Prompt caching còn chạy không? — cache hỏng âm thầm là hoá đơn
 *      tăng gấp mấy lần mà không ai báo.
 *   4. Hạn mức 10 lượt/tháng có chật quá không? (bao nhiêu người hết lượt)
 *
 * Cố ý KHÔNG có nội dung hội thoại ở đây: `ai_usage` không lưu câu hỏi,
 * và đó là điều khiến admin xem được báo cáo mà không đọc được chuyện
 * riêng của các gia đình.
 *
 * Về hình: cột ngang một màu, dài–ngắn là thứ mang thông tin. Không tô
 * mỗi ngày một màu — màu ở đây không mã hoá gì cả, tô nhiều màu chỉ làm
 * mắt phải giải mã một thứ vô nghĩa.
 */

const RANGES = [7, 30, 90] as const;

export function AiUsageTab() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);

  const overview = useQuery({
    queryKey: ["ai-usage-overview", days],
    queryFn: () => getAiUsageOverview(days),
    retry: false,
  });
  const daily = useQuery({
    queryKey: ["ai-usage-daily", days],
    queryFn: () => getAiUsageDaily(days),
    retry: false,
  });
  const byModel = useQuery({
    queryKey: ["ai-usage-model", days],
    queryFn: () => getAiUsageByModel(days),
    retry: false,
  });
  const byClan = useQuery({
    queryKey: ["ai-usage-clan", days],
    queryFn: () => getAiUsageByClan(days),
    retry: false,
  });
  const credits = useQuery({
    queryKey: ["credit-overview"],
    queryFn: getCreditOverview,
    retry: false,
  });

  if (overview.isLoading) return <LoadingState />;
  if (overview.error)
    return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;

  const o = overview.data!;

  return (
    <div className="space-y-4">
      {/* Bộ lọc thời gian: một hàng, ngay trên số liệu. */}
      <div className="flex items-center gap-3">
        <SegmentedControl ariaLabel="Khoảng thời gian">
          {RANGES.map((r) => (
            <SegmentedButton
              key={r}
              active={days === r}
              onClick={() => setDays(r)}
            >
              {r} ngày
            </SegmentedButton>
          ))}
        </SegmentedControl>
        <p className="text-sm text-muted-foreground">
          Tính theo giờ Việt Nam
        </p>
      </div>

      {/* Số liệu đầu bảng — cái nhìn năm giây. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Stat label="Lượt hỏi" value={o.requests.toLocaleString("vi-VN")} />
        <Stat label="Người dùng" value={o.users.toLocaleString("vi-VN")} />
        <Stat
          label="Chi phí"
          value={formatUsd(o.cost_usd)}
          hint={formatVnd(o.cost_usd)}
        />
        <Stat
          label="Lượt lỗi"
          value={o.failed.toLocaleString("vi-VN")}
          tone={o.failed > 0 && o.failed / Math.max(o.requests, 1) > 0.05 ? "bad" : undefined}
          hint={o.requests ? `${Math.round((o.failed / o.requests) * 100)}%` : undefined}
        />
        <Stat
          label="Cache đầu vào"
          value={`${Math.round(o.cached_ratio * 100)}%`}
          // Cache tụt là hoá đơn tăng âm thầm — cảnh báo sớm hơn là đợi
          // nhìn thấy tiền.
          tone={o.requests > 20 && o.cached_ratio < 0.3 ? "bad" : undefined}
          hint={`${formatTokens(o.input_tokens)} token vào`}
        />
        <Stat
          label="Hài lòng"
          value={
            o.liked_ratio === null
              ? "—"
              : `${Math.round(o.liked_ratio * 100)}%`
          }
          hint={o.rated ? `${o.rated} lượt được chấm` : "chưa ai chấm điểm"}
          // Dưới 60% là câu trả lời đang sai nhiều — đáng đi soi
          // trước khi người dùng bỏ dùng trợ lý.
          tone={
            o.liked_ratio !== null && o.rated >= 5 && o.liked_ratio < 0.6
              ? "bad"
              : undefined
          }
        />
        <Stat
          label="Độ trễ TB"
          value={`${(o.avg_latency_ms / 1000).toFixed(1)}s`}
          tone={o.avg_latency_ms > 15_000 ? "bad" : undefined}
        />
      </div>

      {credits.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hạn mức tháng này</CardTitle>
            <CardDescription>
              Số người đang hết lượt là con số để quyết định 10 lượt/tháng có
              chật hay không — cần nó trước khi định giá.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Đã cấp" value={credits.data.granted.toLocaleString("vi-VN")} />
            <Stat label="Đã tiêu" value={credits.data.consumed.toLocaleString("vi-VN")} />
            <Stat label="Hoàn do lỗi" value={credits.data.refunded.toLocaleString("vi-VN")} />
            <Stat label="Số ví" value={credits.data.wallets.toLocaleString("vi-VN")} />
            <Stat
              label="Đang hết lượt"
              value={credits.data.exhausted.toLocaleString("vi-VN")}
              tone={credits.data.exhausted > 0 ? "warn" : undefined}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lượt hỏi theo ngày</CardTitle>
          <CardDescription>
            Cột đỏ là lượt hỏng. Ngày vọt lên bất thường thường là vòng lặp
            lỗi ở client chứ không phải người dùng đông.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailyBars rows={daily.data ?? []} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Theo model</CardTitle>
            <CardDescription>
              Đổi model xong có rẻ đi thật không — và nhanh hơn hay chậm đi.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Model</th>
                  <th className="pb-2 text-right font-medium">Lượt</th>
                  <th className="pb-2 text-right font-medium">Chi phí</th>
                  <th className="pb-2 text-right font-medium">Trễ TB</th>
                  <th className="pb-2 text-right font-medium">Cache</th>
                </tr>
              </thead>
              <tbody>
                {(byModel.data ?? []).map((m) => (
                  <tr key={m.model_id} className="border-t">
                    <td className="py-2 font-medium">{m.model_id}</td>
                    <td className="py-2 text-right tabular-nums">{m.requests}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatUsd(m.cost_usd)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {(m.avg_latency_ms / 1000).toFixed(1)}s
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {Math.round(m.cached_ratio * 100)}%
                    </td>
                  </tr>
                ))}
                {!byModel.data?.length && <EmptyRow cols={5} />}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Theo dòng họ</CardTitle>
            <CardDescription>
              Chỉ lượt và tiền — không có câu hỏi, vì bảng ai_usage cố ý
              không lưu nội dung.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Dòng họ</th>
                  <th className="pb-2 text-right font-medium">Lượt</th>
                  <th className="pb-2 text-right font-medium">Người</th>
                  <th className="pb-2 text-right font-medium">Chi phí</th>
                </tr>
              </thead>
              <tbody>
                {(byClan.data ?? []).map((c) => (
                  <tr key={c.clan_id ?? c.clan_name} className="border-t">
                    <td className="py-2 font-medium">{c.clan_name}</td>
                    <td className="py-2 text-right tabular-nums">{c.requests}</td>
                    <td className="py-2 text-right tabular-nums">{c.users}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatUsd(c.cost_usd)}
                    </td>
                  </tr>
                ))}
                {!byClan.data?.length && <EmptyRow cols={4} />}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="py-6 text-center text-muted-foreground">
        Chưa có dữ liệu trong khoảng này.
      </td>
    </tr>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "bad" | "warn";
}) {
  // Màu trạng thái đi kèm CHỮ, không bao giờ đứng một mình: người mù màu
  // và bản in đen trắng vẫn phải đọc được cùng một thông tin.
  const toneClass =
    tone === "bad"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-500"
        : "";
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Cột ngang, một màu. Dài–ngắn mang thông tin; màu thì không.
 *
 * Đầu cột bo 4px và neo vào mép trái, có khe 2px giữa phần lỗi và phần
 * chạy được để hai khối không dính thành một.
 */
function DailyBars({ rows }: { rows: AiUsageDay[] }) {
  if (!rows.length) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Chưa có lượt hỏi nào trong khoảng này.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.requests), 1);

  // 90 ngày là 90 dòng — cuộn trong thẻ chứ đừng đẩy mọi thứ bên dưới
  // xuống tận đáy trang.
  return (
    <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
      {rows.map((r) => {
        const ok = r.requests - r.failed;
        const dd = r.day.slice(8, 10);
        const mm = r.day.slice(5, 7);
        return (
          <li key={r.day} className="flex items-center gap-2 text-sm">
            <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
              {dd}/{mm}
            </span>
            <span
              className="flex h-4 min-w-0 flex-1 items-center gap-[2px]"
              title={`${r.requests} lượt · ${r.failed} lỗi · ${formatUsd(r.cost_usd)}`}
            >
              <span
                className="h-full rounded-[4px] bg-primary"
                style={{ width: `${(ok / max) * 100}%` }}
              />
              {r.failed > 0 && (
                <span
                  className="h-full rounded-[4px] bg-destructive"
                  style={{ width: `${(r.failed / max) * 100}%` }}
                />
              )}
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums">
              {r.requests}
            </span>
            <span className="hidden w-16 shrink-0 text-right tabular-nums text-muted-foreground sm:inline">
              {formatUsd(r.cost_usd)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
