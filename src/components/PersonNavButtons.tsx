import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  extendPersonNav,
  loadPersonNav,
  type PersonNavCtx,
} from "@/lib/personNav";

import { t } from "@lingui/core/macro";
/**
 * "Người trước / Người sau" theo thứ tự Danh bạ — chỉ hiện khi người đang xem
 * nằm trong danh sách vừa duyệt (mở từ Danh bạ). Sang người kế không cần quay lại.
 */
export function PersonNavButtons({
  clanId,
  personId,
}: {
  clanId: string;
  personId: string;
}) {
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<PersonNavCtx | null>(() =>
    loadPersonNav(clanId),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCtx(loadPersonNav(clanId));
  }, [clanId, personId]);

  if (!ctx) return null;
  const idx = ctx.ids.indexOf(personId);
  if (idx < 0) return null;

  const pageSize = ctx.params.pageSize;
  const position = (ctx.pageLo - 1) * pageSize + idx + 1;
  const hasPrev = idx > 0 || ctx.pageLo > 1;
  const hasNext = idx < ctx.ids.length - 1 || ctx.pageHi * pageSize < ctx.total;

  const go = async (dir: -1 | 1) => {
    if (busy) return;
    let cur = ctx;
    let target = cur.ids[idx + dir];
    if (!target) {
      setBusy(true);
      try {
        cur = await extendPersonNav(cur, dir);
        setCtx(cur);
        const i = cur.ids.indexOf(personId);
        target = cur.ids[i + dir];
      } catch {
        /* mạng lỗi — giữ nguyên trang */
      } finally {
        setBusy(false);
      }
    }
    if (target) navigate(`/clans/${clanId}/people/${target}`);
  };

  return (
    <div
      className="flex items-center justify-between gap-2 print-hide"
      aria-label={t`Duyệt danh bạ`}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasPrev || busy}
        onClick={() => void go(-1)}
      >
        {t`← Người trước`}
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {position} / {ctx.total}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!hasNext || busy}
        onClick={() => void go(1)}
      >
        {t`Người sau →`}
      </Button>
    </div>
  );
}
