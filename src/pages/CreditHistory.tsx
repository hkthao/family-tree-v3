import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { IconClock, IconSparkles } from "@/components/icons";
import { LoadingState } from "@/components/LoadingState";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import {
  CREDIT_REASON_LABEL,
  loadMyLedger,
  loadMyQuota,
  runningBalances,
  type CreditEntry,
} from "@/lib/queries/credits";

/**
 * Lịch sử sử dụng — sổ đối soát lượt trợ lý của chính mình.
 *
 * **Đây KHÔNG phải lịch sử trò chuyện.** Hai thứ hay bị gọi chung tên
 * nhưng khác hẳn nhau, và tách ra là quyết định thiết kế chứ không phải
 * cho gọn:
 *
 *   Lịch sử trò chuyện — bảng ai_messages, CÓ nội dung, chỉ chính chủ đọc.
 *   Lịch sử sử dụng    — bảng credit_ledger, KHÔNG nội dung, chính chủ +
 *                        trưởng họ + admin đọc để đối soát tiền.
 *
 * Nhờ tách bảng mà trưởng họ bỏ tiền mua lượt **thấy được ai tiêu bao
 * nhiêu** nhưng **không đọc được câu hỏi của con cháu**. Giải bằng hai
 * bảng, không phải bằng phân quyền tinh vi trên cùng một bảng.
 *
 * Nên trang này chỉ trả lời *khi nào · việc gì · mấy lượt · còn bao nhiêu*.
 * Muốn đọc lại câu đã hỏi thì mở khung chat.
 */

export default function CreditHistory() {
  usePageTitle("Lịch sử sử dụng");

  const quota = useQuery({
    queryKey: ["credit-quota"],
    queryFn: () => loadMyQuota(),
  });
  const ledger = useQuery({
    queryKey: ["credit-ledger"],
    queryFn: () => loadMyLedger(),
  });

  const entries = ledger.data ?? [];
  const balances = runningBalances(entries);

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-3xl py-6 px-4 space-y-3">
        <PageHeader
          icon={<IconClock className="h-7 w-7" />}
          title="Lịch sử sử dụng"
          description="Lượt hỏi trợ lý đã dùng và còn lại. Trang này không hiện nội dung câu hỏi."
        />

        {quota.data && (
          <Card>
            <CardContent className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-4">
              <p className="text-2xl font-semibold tabular-nums">
                {quota.data.balance} lượt
              </p>
              <p className="text-sm text-muted-foreground">
                còn lại · đã dùng {quota.data.usedThisMonth} lượt trong tháng
                này
              </p>
              <p className="w-full text-sm text-muted-foreground">
                Mỗi tháng bạn được tặng {quota.data.freeThisMonth} lượt; lượt
                tặng chưa dùng hết sẽ không cộng dồn sang tháng sau.{" "}
                <Link to="/clans" className="underline">
                  Mở trợ lý
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        {ledger.isLoading && <LoadingState />}
        {ledger.error && (
          <ErrorState error={ledger.error} onRetry={() => ledger.refetch()} />
        )}

        {!ledger.isLoading && !ledger.error && entries.length === 0 && (
          <EmptyState
            icon={<IconSparkles className="h-12 w-12" />}
            title="Chưa có lượt nào được dùng"
            description="Khi bạn hỏi trợ lý dòng họ, mỗi câu hỏi sẽ được ghi lại ở đây."
          />
        )}

        {entries.length > 0 && (
          <Card>
            <CardContent className="divide-y p-0">
              {entries.map((e, i) => (
                <LedgerRow key={e.id} entry={e} balance={balances[i]} />
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function LedgerRow({
  entry,
  balance,
}: {
  entry: CreditEntry;
  balance: number;
}) {
  const positive = entry.delta > 0;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {CREDIT_REASON_LABEL[entry.reason] ?? entry.reason}
        </p>
        <p
          className="text-xs text-muted-foreground"
          title={formatDateTime(entry.at) ?? undefined}
        >
          {formatDate(entry.at)}
          {entry.expires_at && (
            <> · hết hạn {formatDate(entry.expires_at)}</>
          )}
        </p>
      </div>
      <p
        className={`shrink-0 tabular-nums font-medium ${
          positive ? "text-emerald-600 dark:text-emerald-500" : ""
        }`}
      >
        {positive ? "+" : ""}
        {entry.delta}
      </p>
      {/* Số dư sau bút toán: sổ phải cộng thay người dùng, không bắt họ
          tự cộng một dãy +10 −1 −1 trong đầu. */}
      <p className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        còn {balance}
      </p>
    </div>
  );
}
