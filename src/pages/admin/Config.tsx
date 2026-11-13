import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useToast } from "@/components/Toast";
import {
  IconCheck,
} from "@/components/icons";
import {
  getDemoClanIds,
  setDemoClanIds,
} from "@/lib/queries/platformSettings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  listAllClans,
} from "@/lib/queries/admin";
import { queryKeys } from "@/lib/queries/keys";
import { isMascotEnabled, setMascotEnabled } from "@/lib/queries/platformSettings";

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
export function ConfigTab() {
  const qc = useQueryClient();
  const toast = useToast();

  // ─── Linh vật ────────────────────────────────────────────────────
  const mascotQ = useQuery({
    queryKey: ["mascot-enabled"],
    queryFn: () => isMascotEnabled(),
    retry: false,
  });
  const mascotM = useMutation({
    mutationFn: (on: boolean) => setMascotEnabled(on),
    onSuccess: (_d, on) => {
      qc.invalidateQueries({ queryKey: ["mascot-enabled"] });
      toast.success(on ? t`Đã bật linh vật` : t`Đã tắt linh vật`);
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: (e as Error).message }),
  });

  const { data: clans } = useQuery({
    queryKey: queryKeys.adminClans(),
    queryFn: () => listAllClans(),
    staleTime: 0,
  });
  const { data: current } = useQuery({
    queryKey: ["demo-clan-ids"],
    queryFn: () => getDemoClanIds(),
  });

  const publicClans = useMemo(
    () => (clans ?? []).filter((c) => c.visibility === "public"),
    [clans],
  );

  // Tập id đang chọn — khởi tạo/đồng bộ theo giá trị đã lưu.
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const chosen = selected ?? new Set(current ?? []);
  const toggle = (id: string) => {
    const next = new Set(chosen);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const savedSet = new Set(current ?? []);
  const dirty =
    chosen.size !== savedSet.size ||
    [...chosen].some((id) => !savedSet.has(id));

  const saveM = useMutation({
    mutationFn: (ids: string[]) => setDemoClanIds(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demo-clan-ids"] });
      setSelected(null);
      toast.success(t`Đã lưu dòng họ demo.`);
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: (e as Error).message }),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border bg-card shadow-sm p-4">
        <div>
          <h2 className="text-lg font-semibold">{t`Linh vật`}</h2>
          <p className="text-sm text-muted-foreground">
            <Trans>
            {t`Nhân vật nổi ở góc màn hình, hiện mẹo dùng app. Tắt thì ẩn với`}{" "}
            <b>{t`mọi người dùng`}</b> — dùng khi cần màn hình gọn để chụp ảnh, khi
            demo, hoặc khi mẹo đang gây phiền.
            </Trans>
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {mascotQ.data === false ? t`Đang tắt với mọi người` : t`Đang bật`}
          </span>
          <Button size="sm"
            variant={mascotQ.data === false ? "default" : "outline"}
            disabled={mascotQ.isLoading || mascotM.isPending}
            onClick={() => mascotM.mutate(mascotQ.data === false)}
          >
            {mascotQ.data === false ? t`Bật linh vật` : t`Tắt linh vật`}
          </Button>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border bg-card shadow-sm p-4">
        <div>
          <h2 className="text-lg font-semibold">{t`Dòng họ demo`}</h2>
          <p className="text-sm text-muted-foreground">
            <Trans>
            Tick <b>{t`một hoặc nhiều`}</b> dòng họ <b>{t`công khai`}</b> để dùng cho nút{" "}
            <b>{t`“Xem thử gia phả mẫu”`}</b> ở trang Đăng nhập — giúp khách mới xem
            sản phẩm trước khi đăng nhập.
            </Trans>
          </p>
        </div>

        {publicClans.length === 0 ? (
          <Alert>
            <AlertDescription>
              Chưa có dòng họ công khai nào. Vào một dòng họ → Cài đặt → đặt
              quyền xem <b>{t`Công khai`}</b>, rồi quay lại đây chọn.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Danh sách checkbox — mọi hàng cùng chiều cao, đồng nhất. */}
            <div className="divide-y rounded-md border">
              {publicClans.map((c) => (
                <label
                  key={c.id}
                  className="flex h-12 cursor-pointer items-center gap-3 px-3 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={chosen.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {c.name}{" "}
                    <span className="text-sm text-muted-foreground">
                      {t`(${c.person_count} người)`}
                    </span>
                  </span>
                  <a
                    href={`/xem/clans/${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-xs text-primary hover:underline"
                  >
                    xem →
                  </a>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {t`Đã chọn ${chosen.size} dòng họ`}
              </span>
              <Button size="sm"
                onClick={() => saveM.mutate([...chosen])}
                disabled={saveM.isPending || !dirty}
              >
                <IconCheck className="h-4 w-4 mr-1.5" />
                {saveM.isPending ? t`Đang lưu…` : t`Lưu`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
