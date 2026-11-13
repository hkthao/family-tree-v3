import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { friendlyError } from "@/components/ErrorState";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { BOOK_TEMPLATES, fillTemplate } from "@/lib/bookTemplates";
import { askAssistant } from "@/lib/queries/aiChat";
import { useConfirm } from "@/components/ConfirmDialog";
import { Select } from "@/components/ui/select";
import {
  getClanBookTexts,
  saveClanBookTexts,
  EMPTY_BOOK_TEXTS,
  cleanBookTexts,
  type ClanBookTexts,
} from "@/lib/queries/clan-book";

import { t } from "@lingui/core/macro";
const EMPTY = EMPTY_BOOK_TEXTS;

type TextKey = "preface" | "phaky" | "ngoai_pha" | "phu_khao";

const FIELDS: {
  key: TextKey;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
}[] = [
  {
    key: "preface",
    placeholder:
      "Vì sao làm phả, ai làm, làm thế nào; lời kêu gọi con cháu bổ sung; lời cảm ơn, ngày viết, người chủ trì…",
    label: "Lời nói đầu",
    hint: "Mục đích, lý do làm phả; ai làm, làm thế nào; ưu khuyết và lời kêu gọi hậu duệ bổ sung; lời cảm ơn, ngày viết, người chủ trì. Nên ngắn gọn, súc tích.",
    rows: 7,
  },
  {
    key: "phaky",
    placeholder:
      "Thuỷ tổ và tổ quán; các chi, các đời; truyền thống lao động, văn hoá, học tập, yêu nước; đặc điểm và phương hướng của dòng họ…",
    label: "Phả ký",
    hint: "Lịch sử dòng họ: phát tích, vị tổ khai cơ và tiểu sử; tổ quán (địa lý, lịch sử xóm ấp, đình miếu); truyền thống lao động, văn hoá, yêu nước; đặc điểm dòng họ và phương hướng xây dựng dòng họ văn hoá. Số liệu nam/nữ, số đời, từng chi được sổ tự thêm từ dữ liệu. Xuống dòng để tách đoạn.",
    rows: 14,
  },
  {
    key: "ngoai_pha",
    placeholder:
      "Nhà thờ họ, hội đồng gia tộc; các lễ cúng chính và văn khấn; ruộng hương hỏa, quỹ họ; mộ phần…",
    label: "Ngoại phả",
    hint: "Các lễ cúng chính và văn khấn; nhà thờ họ, hội đồng gia tộc; ruộng hương hỏa, kỵ điền. Ngày giỗ, quan hệ cưới gả, mộ phần được sổ tự lập từ dữ liệu.",
    rows: 8,
  },
  {
    key: "phu_khao",
    placeholder:
      "Địa chí quê hương; đình, chùa, miếu mạo; chợ, bến đò; nghề truyền thống…",
    label: "Phụ khảo",
    hint: "Địa chí xóm ấp từ xưa đến nay, đình làng, chợ, bến đò, nghề truyền thống. Di sản đã nhập ở mục Di sản sẽ tự in kèm.",
    rows: 8,
  },
];

/** Soạn các phần văn bản của Sổ gia phả (lời nói đầu, phả ký, ngoại phả, phụ khảo). */
export function BookTextsSection({
  clanId,
  clanName,
  canEdit,
  value,
  onChange,
}: {
  /** Chưa có khi đang tạo dòng họ: không lưu riêng, không dùng được AI. */
  clanId?: string;
  clanName: string;
  canEdit: boolean;
  /** Có truyền thì là ô điều khiển từ ngoài (form tạo mới): không tự lưu. */
  value?: ClanBookTexts;
  onChange?: (next: ClanBookTexts) => void;
}) {
  const controlled = value !== undefined && !!onChange;
  const confirm = useConfirm();
  const aiEnabled = useAiEnabled();
  const [tplPick, setTplPick] = useState<Record<string, string>>({});
  const [aiDesc, setAiDesc] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  async function applyTemplate(field: TextKey) {
    const id = tplPick[field] ?? BOOK_TEMPLATES[0].id;
    const tpl = BOOK_TEMPLATES.find((x) => x.id === id);
    if (!tpl) return;
    if (form[field]?.trim()) {
      const ok = await confirm({
        title: t`Thay nội dung đang có bằng mẫu?`,
        confirmLabel: t`Dùng mẫu`,
        destructive: true,
      });
      if (!ok) return;
    }
    setForm((f) => ({ ...f, [field]: fillTemplate(tpl, clanName)[field] }));
  }

  async function aiDraft(field: TextKey, label: string) {
    const desc = (aiDesc[field] ?? "").trim();
    if (!desc) {
      toast.error(t`Bạn mô tả vài ý trước nhé`);
      return;
    }
    if (form[field]?.trim()) {
      const ok = await confirm({
        title: t`Thay "${label}" đang có bằng bản AI soạn?`,
        confirmLabel: "Thay",
        destructive: true,
      });
      if (!ok) return;
    }
    setAiBusy(field);
    try {
      // Giới hạn câu hỏi của trợ lý là 1000 ký tự nên mô tả bị cắt ở 650.
      const question =
        `Soạn phần "${label}" cho gia phả họ ${clanName.replace(/\s*\([^)]*\)\s*$/, "")}, ` +
        `văn trang trọng, tiếng Việt, chỉ dùng ý dưới đây, chỗ chưa biết để […], ` +
        t`không bịa tên người/năm. Chỉ trả về nội dung bài, không giải thích. Ý của tôi: ${desc.slice(0, 650)}`;
      const res = await askAssistant({
        clanId: clanId!,
        question,
        history: [],
      });
      if (res.quotaExhausted) {
        toast.error(t`Hết lượt AI tháng này`);
      } else {
        setForm((f) => ({ ...f, [field]: res.answer.trim() }));
        toast.success(t`AI đã soạn xong, bạn đọc lại và sửa trước khi lưu`);
      }
    } catch (e) {
      toast.error(t`AI chưa soạn được`, { description: friendlyError(e) });
    } finally {
      setAiBusy(null);
    }
  }

  const templatePicker = (field: TextKey) =>
    canEdit ? (
      <div className="flex items-center gap-2">
        <Select
          className="h-10 w-full flex-1"
          aria-label={t`Chọn mẫu`}
          value={tplPick[field] ?? BOOK_TEMPLATES[0].id}
          onChange={(e) => setTplPick({ ...tplPick, [field]: e.target.value })}
        >
          {BOOK_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              Mẫu: {t.name}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => applyTemplate(field)}
        >
          {t`Dùng mẫu`}
        </Button>
      </div>
    ) : null;
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["clan-book-texts", clanId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => getClanBookTexts(clanId!),
    enabled: !controlled && !!clanId,
  });
  const [inner, setInner] = useState<ClanBookTexts>(EMPTY);

  useEffect(() => {
    if (!controlled) setInner(data ?? EMPTY);
  }, [data, controlled]);

  const form = controlled ? value! : inner;
  const setForm = (
    u: ClanBookTexts | ((f: ClanBookTexts) => ClanBookTexts),
  ) => {
    const next = typeof u === "function" ? u(form) : u;
    if (controlled) onChange!(next);
    else setInner(next);
  };

  const save = useMutation({
    mutationFn: () => {
      return saveClanBookTexts(
        clanId!,
        cleanBookTexts({
          preface: form.preface,
          phaky: form.phaky,
          ngoai_pha: form.ngoai_pha,
          phu_khao: form.phu_khao,
        }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      toast.success(t`Đã lưu nội dung sổ gia phả`);
    },
    onError: (e) =>
      toast.error(t`Không lưu được`, { description: friendlyError(e) }),
  });

  // Nhúng trong form tạo dòng họ thì không được lồng thêm <form>.
  const Root = controlled ? "div" : "form";
  return (
    <Root
      className="space-y-4"
      {...(controlled
        ? {}
        : {
            onSubmit: (e: React.FormEvent) => {
              e.preventDefault();
              save.mutate();
            },
          })}
    >
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`book-${f.key}`}>{f.label}</Label>
          <Textarea
            id={`book-${f.key}`}
            rows={f.rows}
            placeholder={f.placeholder}
            value={form[f.key] ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{f.hint}</p>
          {templatePicker(f.key)}
          {canEdit && aiEnabled && clanId ? (
            <div className="space-y-1.5 rounded-md border border-dashed p-3">
              <Label htmlFor={`ai-${f.key}`} className="text-xs">
                {t`Nhờ AI soạn: mô tả vài ý (nguồn gốc, quê quán, nghề nghiệp, truyền thống…)`}
              </Label>
              <Textarea
                id={`ai-${f.key}`}
                rows={3}
                maxLength={650}
                placeholder={t`Vd: Họ tôi gốc ở làng…, tổ khai khẩn từ khoảng…, làm nghề…, có nhà thờ họ ở…, truyền thống hiếu học…`}
                value={aiDesc[f.key] ?? ""}
                onChange={(e) =>
                  setAiDesc({ ...aiDesc, [f.key]: e.target.value })
                }
              />
              <Button
                size="sm"
                type="button"
                variant="outline"
                disabled={aiBusy !== null}
                onClick={() => aiDraft(f.key, f.label)}
              >
                {aiBusy === f.key ? t`AI đang soạn…` : t`AI soạn theo mô tả`}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      {canEdit && !controlled ? (
        <div className="flex justify-end">
          <Button size="sm" type="submit" disabled={save.isPending}>
            {save.isPending ? t`Đang lưu…` : t`Lưu nội dung sổ`}
          </Button>
        </div>
      ) : null}
    </Root>
  );
}
