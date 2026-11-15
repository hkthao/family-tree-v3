import { t } from "@lingui/core/macro";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { IconArrowRight, IconSparkles, IconX } from "@/components/icons";
import { track } from "@/lib/analytics";
import {
  computeNextSteps,
  seededRng,
  isSnoozed,
  snooze,
  type NextStepInput,
} from "@/lib/nextSteps";

/**
 * Thẻ "Bước tiếp theo" ở Tổng quan — một việc, một dòng. Cả thẻ là liên kết (vùng bấm cao ≥ 48px);
 * dấu × chỉ ẩn gợi ý đó 14 ngày rồi chuyển sang gợi ý kế. Không nổi, không chồng lên nội dung.
 * Bố cục ép MỘT dòng cho tiêu đề và phụ đề (truncate) để điện thoại màn nhỏ không bị rớt dòng.
 */
export function NextStepCard({
  clanId,
  input,
}: {
  clanId: string;
  input: NextStepInput;
}) {
  const [, setTick] = useState(0);
  // Một hạt giống mỗi lần vào trang: mỗi lượt gặp một tính năng khác, nhưng không đổi khi dữ liệu tải dần.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 32));
  const step = useMemo(
    () =>
      computeNextSteps(input, seededRng(seed)).find(
        (s) => !isSnoozed(clanId, s.id),
      ),
    // `tick` buộc tính lại sau khi ẩn một gợi ý.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clanId, input, seed, setTick],
  );
  // Đo: gợi ý nào được HIỆN (mỗi id một lần mỗi lượt vào trang), nào được bấm, nào bị "Để sau". Chỉ gửi khoá gợi ý
  // và loại gợi ý, không có dữ liệu cá nhân — để sau này xếp trọng số theo số liệu thật chứ không đoán.
  const shownId = step?.id;
  const shownKind = step?.kind;
  useEffect(() => {
    if (shownId) track("next_step_shown", { id: shownId, kind: shownKind });
  }, [shownId, shownKind]);

  if (!step) return null;

  return (
    <div
      className="flex items-stretch overflow-hidden rounded-xl border border-primary/25 bg-primary/5 shadow-sm"
      data-testid="next-step-card"
    >
      <Link
        to={`/clans/${clanId}/${step.to}`}
        // Mở tính năng = đã khám phá: không mời lại. Việc bổ sung dữ liệu thì hiện tới khi hết thiếu.
        onClick={() => {
          track("next_step_click", { id: step.id, kind: step.kind });
          if (step.kind === "discover") snooze(clanId, step.id, 365);
        }}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 px-3 py-1.5 hover:bg-primary/10"
      >
        <IconSparkles className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">
            {step.title}
          </span>
          <span className="block truncate text-xs leading-tight text-muted-foreground">
            {step.hint}
          </span>
        </span>
        <IconArrowRight className="h-4 w-4 shrink-0 text-primary" />
      </Link>
      <button
        type="button"
        aria-label={t`Để sau`}
        title={t`Để sau`}
        onClick={() => {
          track("next_step_snooze", { id: step.id, kind: step.kind });
          snooze(clanId, step.id);
          setTick((n) => n + 1);
        }}
        className="flex w-11 shrink-0 items-center justify-center border-l border-primary/15 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
      >
        <IconX className="h-4 w-4" />
      </button>
    </div>
  );
}
