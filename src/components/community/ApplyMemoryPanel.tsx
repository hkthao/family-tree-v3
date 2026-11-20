import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { IconBook, IconCamera, IconCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import {
  applyMemoryAsPhoto,
  applyMemoryToBio,
  markMemoryApplied,
  type PersonMemory,
} from "@/lib/queries/community";

import { t } from "@lingui/core/macro";

type Target = "bio" | "photo" | "manual";

/** Đoạn điền sẵn cho tiểu sử: nội dung + ghi nguồn (người kể, quan hệ, nguồn, năm). */
function draftBio(m: PersonMemory): string {
  const who = [m.author_label, m.author_relation].filter(Boolean).join(", ");
  const extra = [m.year_approx ? t`khoảng năm ${m.year_approx}` : null, m.place, m.source].filter(Boolean).join("; ");
  const body = m.question_text ? `${m.question_text} — ${m.body ?? ""}` : (m.body ?? "");
  return `${body.trim()} (${t`Theo lời kể của ${who}`}${extra ? `; ${extra}` : ""}.)`;
}

/**
 * "Đưa vào gia phả": đóng góp là NGUỒN, gia phả là bản đã xác nhận. Người quản lý chọn đích —
 * nối vào tiểu sử (đoạn điền sẵn kèm ghi nguồn, sửa được trước khi lưu), đặt làm ảnh đại diện, hoặc
 * chỉ đánh dấu đã dùng (đã tự cập nhật nơi khác). Đóng góp được gắn nhãn "Đã đưa vào gia phả".
 */
export function ApplyMemoryPanel({
  open,
  onClose,
  memory,
}: {
  open: boolean;
  onClose: () => void;
  memory: PersonMemory | null;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const hasPhoto = !!memory && memory.kind === "photo" && !!(memory.media_path || memory.is_external);
  const [target, setTarget] = useState<Target>(memory?.body ? "bio" : hasPhoto ? "photo" : "manual");
  const [text, setText] = useState(() => (memory ? draftBio(memory) : ""));
  const [note, setNote] = useState("");

  const apply = useMutation({
    mutationFn: async () => {
      if (!memory) return;
      if ((target === "bio" || target === "photo") && !memory.person_id) {
        throw new Error(t`Đóng góp này không gắn với người nào`);
      }
      if (target === "bio") {
        if (!text.trim()) throw new Error(t`Đoạn tiểu sử đang trống`);
        await applyMemoryToBio(memory.id, memory.person_id!, text);
      } else if (target === "photo") {
        await applyMemoryAsPhoto(memory, memory.person_id!);
      } else {
        await markMemoryApplied(memory.id, { type: "manual", person_id: memory.person_id, note: note.trim() || null });
      }
    },
    onSuccess: () => {
      track("community_memory_apply", { target });
      void qc.invalidateQueries({ queryKey: ["clan-memories"] });
      void qc.invalidateQueries({ queryKey: ["person-memories"] });
      if (memory?.person_id) {
        void qc.invalidateQueries({ queryKey: ["person", memory.person_id] });
      }
      toast.success(t`Đã đưa vào gia phả`);
      onClose();
    },
    onError: (e) => toast.error(t`Chưa đưa vào được`, { description: (e as Error).message }),
  });

  const options: { v: Target; title: string; hint: string; icon: React.ReactNode; ok: boolean }[] = [
    {
      v: "bio",
      title: t`Nối vào tiểu sử`,
      hint: t`Thêm một đoạn vào cuối tiểu sử, kèm ghi nguồn. Sửa lại câu chữ trước khi lưu.`,
      icon: <IconBook className="h-4 w-4" />,
      ok: !!memory?.person_id,
    },
    {
      v: "photo",
      title: t`Đặt làm ảnh đại diện`,
      hint: t`Dùng ảnh của đóng góp này làm ảnh chân dung trên cây và hồ sơ.`,
      icon: <IconCamera className="h-4 w-4" />,
      ok: hasPhoto && !!memory?.person_id,
    },
    {
      v: "manual",
      title: t`Chỉ đánh dấu đã dùng`,
      hint: t`Bạn đã tự cập nhật hồ sơ / mộ phần / quan hệ ở chỗ khác.`,
      icon: <IconCheck className="h-4 w-4" />,
      ok: true,
    },
  ];

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      size="lg"
      title={t`Đưa vào gia phả`}
      subtitle={memory?.person_name ?? t`Chuyện chung của họ`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          apply.mutate();
        }}
      >
        <div role="radiogroup" aria-label={t`Đưa vào đâu`} className="space-y-2">
          {options
            .filter((o) => o.ok)
            .map((o) => (
              <label
                key={o.v}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${target === o.v ? "border-primary bg-primary/5" : ""}`}
              >
                <input
                  type="radio"
                  name="apply-target"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={target === o.v}
                  onChange={() => setTarget(o.v)}
                />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {o.icon}
                    {o.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">{o.hint}</span>
                </span>
              </label>
            ))}
        </div>

        {target === "bio" && (
          <div className="space-y-1.5">
            <Label htmlFor="apply-bio">{t`Đoạn sẽ thêm vào tiểu sử`}</Label>
            <Textarea id="apply-bio" icon={<IconBook />} rows={7} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        )}
        {target === "manual" && (
          <div className="space-y-1.5">
            <Label htmlFor="apply-note">{t`Ghi chú (không bắt buộc)`}</Label>
            <Input
              id="apply-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t`vd: đã cập nhật ngày giỗ, đã thêm vào mộ phần`}
            />
          </div>
        )}

        <FormActions>
          <Button type="button" variant="outline" onClick={onClose}>
            {t`Huỷ`}
          </Button>
          <Button type="submit" disabled={apply.isPending}>
            <IconCheck className="mr-1.5 h-4 w-4" />
            {apply.isPending ? t`Đang lưu…` : t`Đưa vào gia phả`}
          </Button>
        </FormActions>
      </form>
    </SidePanel>
  );
}
