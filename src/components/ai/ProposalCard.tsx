import { useQuery } from "@tanstack/react-query";

import { IconCheck, IconPencil, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { describeProposed, type Proposal } from "@/lib/queries/aiExtract";

/**
 * Thẻ "Tôi hiểu là:" — chốt chặn cuối trước khi lời nói thành dữ liệu.
 *
 * Bốn điều cố ý:
 *
 * 1. **Nằm trong luồng chat, không phải hộp thoại.** Trên điện thoại,
 *    modal + bàn phím + bẫy focus là thảm hoạ; mà thẻ này lại hay xuất
 *    hiện ngay sau khi người dùng vừa nói xong.
 * 2. **Ba nút xếp DỌC, mỗi nút full-width.** Ở 320px mà chia ba cột thì
 *    mỗi nút còn ~90px — người lớn tuổi bấm nhầm là chắc chắn.
 * 3. **Nút chính ở trên cùng**, gần ngón cái nhất khi cầm một tay.
 * 4. **Tra tên người neo từ database**, không hiện id. "Con của
 *    a3f1-9c…" thì không ai xác nhận nổi.
 */

export function ProposalCard({
  proposal,
  applying,
  onConfirm,
  onEdit,
  onReject,
  fontSize,
}: {
  proposal: Proposal;
  applying: boolean;
  onConfirm: () => void;
  onEdit: () => void;
  onReject: () => void;
  fontSize: number;
}) {
  // Người neo là người ĐÃ có trong gia phả: mọi relatedTo không phải
  // tempId của chính đề xuất này.
  const temps = new Set(proposal.people.map((p) => p.tempId));
  const anchorIds = [
    ...new Set(
      proposal.people.map((p) => p.relatedTo).filter((r) => !temps.has(r)),
    ),
  ];

  const names = useQuery({
    queryKey: ["proposal-anchors", anchorIds],
    enabled: anchorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("persons")
        .select("id, full_name")
        .in("id", anchorIds);
      if (error) throw new Error(error.message);
      return new Map((data ?? []).map((p) => [p.id, p.full_name]));
    },
  });

  const nameOf = (ref: string): string => {
    const inBatch = proposal.people.find((p) => p.tempId === ref);
    if (inBatch) return inBatch.fullName;
    return names.data?.get(ref) ?? "người trong gia phả";
  };

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <p className="font-semibold" style={{ fontSize }}>
        Tôi hiểu là:
      </p>
      <ul className="mt-2 space-y-2" style={{ fontSize }}>
        {proposal.people.map((p) => (
          <li key={p.tempId} className="leading-relaxed">
            • {describeProposed(p, nameOf)}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm text-muted-foreground">
        Chưa có gì được ghi vào gia phả. Bạn xem lại rồi bấm nút bên dưới.
      </p>

      {/* Xếp dọc, không chia cột — xem chú thích đầu file. */}
      <div className="mt-3 flex flex-col gap-2">
        <Button
          onClick={onConfirm}
          disabled={applying}
          className="h-[52px] w-full text-base"
        >
          <IconCheck className="h-5 w-5" />
          {applying ? "Đang thêm…" : "Đúng rồi, thêm vào"}
        </Button>
        <Button
          variant="outline"
          onClick={onEdit}
          disabled={applying}
          className="h-[52px] w-full text-base"
        >
          <IconPencil className="h-5 w-5" />
          Sửa lại
        </Button>
        <Button
          variant="ghost"
          onClick={onReject}
          disabled={applying}
          className="h-[52px] w-full text-base"
        >
          <IconX className="h-5 w-5" />
          Bỏ qua
        </Button>
      </div>
    </div>
  );
}
