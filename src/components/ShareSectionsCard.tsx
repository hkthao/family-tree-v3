import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useToast } from "@/components/Toast";
import { IconCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

import { t } from "@lingui/core/macro";

export const SHARE_SECTIONS = ["info", "board", "events", "map", "heritage", "graves", "honor", "mosaic", "profiles"] as const;
export type ShareSection = (typeof SHARE_SECTIONS)[number];

function sectionLabel(k: ShareSection): { title: string; hint: string } {
  switch (k) {
    case "info":
      return { title: t`Thông tin dòng họ`, hint: t`Mô tả, thuỷ tổ, số đời / người, quê gốc, từ đường, giỗ tổ, trưởng họ.` };
    case "board":
      return { title: t`Bảng tin`, hint: t`Các bài đã đăng mới nhất (tin vui, thông báo).` };
    case "events":
      return { title: t`Sự kiện & giỗ`, hint: t`Lịch giỗ và các dịp chung của dòng họ (họp họ, lễ tiết).` };
    case "profiles":
      return { title: t`Hồ sơ người đã mất`, hint: t`Tiểu sử, tên hiệu, ngày âm, nơi sinh / an táng và dấu mốc cuộc đời của người đã mất (người còn sống luôn được ẩn).` };
    case "map":
      return { title: t`Bản đồ`, hint: t`Chỉ số người theo tỉnh — không lộ địa chỉ hay tên.` };
    case "heritage":
      return { title: t`Di sản`, hint: t`Từ đường, tục lệ, giai thoại, kỷ vật (kèm ảnh bìa).` };
    case "graves":
      return { title: t`Mộ phần & tro cốt`, hint: t`Tên, khu vực, người an nghỉ đã mất — không có toạ độ.` };
    case "honor":
      return { title: t`Bảng vàng công đức`, hint: t`Người được vinh danh, loại, số tiền (nếu có).` };
    case "mosaic":
      return { title: t`Ảnh ghép đại gia đình`, hint: t`Bức ảnh ghép mới nhất (ẩn nếu đã bật "ẩn ảnh khi chia sẻ").` };
  }
}

function useShareSections(clanId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["share-sections", clanId] as const;
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("clans").select("share_sections").eq("id", clanId).maybeSingle();
      if (error) throw new Error(error.message);
      return ((data?.share_sections as string[] | null) ?? []) as ShareSection[];
    },
  });
  const save = useMutation({
    mutationFn: async (next: Set<ShareSection>) => {
      const { error } = await supabase
        .from("clans")
        .update({ share_sections: SHARE_SECTIONS.filter((k) => next.has(k)) })
        .eq("id", clanId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(t`Không lưu được`, { description: (e as Error).message }),
  });
  return { data, save };
}

/**
 * Danh sách ô tick "chia sẻ phần nào" — dùng ở ngăn kéo Chia sẻ cây gia phả (tick là lưu ngay) và
 * trong card Cài đặt. Cài đặt của CẢ dòng họ (áp cho mọi link chia sẻ), chỉ admin đổi được (RLS).
 */
export function ShareSectionsPicker({ clanId, autoSave = false, compact = false }: { clanId: string; autoSave?: boolean; compact?: boolean }) {
  const toast = useToast();
  const { data, save } = useShareSections(clanId);
  const [picked, setPicked] = useState<Set<ShareSection>>(new Set());
  useEffect(() => {
    if (data) setPicked(new Set(data));
  }, [data]);

  const toggle = (k: ShareSection) => {
    const n = new Set(picked);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    setPicked(n);
    if (autoSave) save.mutate(n, { onSuccess: () => toast.success(t`Đã lưu`) });
  };

  return (
    <div className="space-y-3">
      <div className={compact ? "grid grid-cols-1 gap-1.5 sm:grid-cols-2" : "space-y-2"}>
        {SHARE_SECTIONS.map((k) => {
          const l = sectionLabel(k);
          return (
            <label
              key={k}
              title={l.hint}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border hover:bg-muted/40 ${compact ? "px-3 py-2 text-sm" : "p-3"}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                checked={picked.has(k)}
                disabled={!data || save.isPending}
                onChange={() => toggle(k)}
              />
              <span className="min-w-0">
                <span className="block font-medium">{l.title}</span>
                {!compact && <span className="block text-sm text-muted-foreground">{l.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {!autoSave && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending || !data}
            onClick={() => save.mutate(picked, { onSuccess: () => toast.success(t`Đã lưu — link chia sẻ sẽ hiện các phần đã chọn`) })}
          >
            <IconCheck className="mr-1.5 h-4 w-4" />
            {save.isPending ? t`Đang lưu…` : t`Lưu thay đổi`}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Card "Link chia sẻ hiển thị gì" ở trang Cài đặt dòng họ. */
export function ShareSectionsCard({ clanId }: { clanId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t`Trang dòng họ hiển thị gì`}</CardTitle>
        <CardDescription>
          {t`Ngoài cây gia phả, chọn các phần cho người ngoài họ xem. Áp cho link chia sẻ (/share/…) và, với dòng họ ở chế độ Công khai, cả người xem công khai: Di sản, Mộ phần, Sự kiện bỏ tick là ẩn với mọi người ngoài họ. Mặc định không chia sẻ thêm gì.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ShareSectionsPicker clanId={clanId} />
      </CardContent>
    </Card>
  );
}
