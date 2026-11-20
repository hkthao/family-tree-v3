import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { FilterableSelect } from "@/components/FilterableSelect";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { IconCopy, IconHelp, IconLink, IconShare2, IconUser, IconUsers } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import {
  createContributeLink,
  createQuestion,
  questionLinkUrl,
  SUGGESTED_QUESTIONS,
  weeklyQuestion,
  type FamilyQuestion,
} from "@/lib/queries/community";
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData } from "@/lib/queries/tree";

import { t } from "@lingui/core/macro";

function draftQuestionMessage(opts: { askName: string | null; question: string; url: string }) {
  const who = opts.askName ? t`hỏi ${opts.askName}` : t`hỏi ông bà, cha mẹ`;
  return t`Cả nhà ơi, tuần này cùng ${who} một câu: “${opts.question}”. Ai biết thì bấm link dưới đây viết câu trả lời (trên điện thoại bấm 🎤 trên bàn phím để nói cho nhanh), không cần đăng ký.\n${opts.url}`;
}

/**
 * "Hỏi ông bà" (P1): đặt một câu hỏi (hỏi ai · về ai · câu hỏi gợi ý của tuần), tạo link trả lời và
 * tin nhắn soạn sẵn. `existing`: gửi lại link cho một câu hỏi đã có (bỏ qua bước tạo).
 */
export function QuestionPanel({
  open,
  onClose,
  clanId,
  existing,
  defaultAboutId,
}: {
  open: boolean;
  onClose: () => void;
  clanId: string;
  existing?: FamilyQuestion | null;
  defaultAboutId?: string | null;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();
  const weekly = weeklyQuestion();
  const [question, setQuestion] = useState(weekly);
  const [askId, setAskId] = useState("");
  const [aboutId, setAboutId] = useState(defaultAboutId ?? "");
  const [result, setResult] = useState<{ url: string; message: string } | null>(null);

  const { data: tree } = useQuery({
    queryKey: queryKeys.treeData(clanId, userId, "persons"),
    queryFn: () => getTreeData(clanId, "persons"),
    enabled: open && !!userId,
  });
  const living = useMemo(
    () =>
      (tree?.persons ?? [])
        .filter((p) => p.is_living)
        .sort((a, b) => (a.generation ?? 99) - (b.generation ?? 99) || a.full_name.localeCompare(b.full_name, "vi"))
        .map((p) => ({ value: p.id, label: p.full_name })),
    [tree],
  );
  const everyone = useMemo(
    () =>
      [...(tree?.persons ?? [])]
        .sort((a, b) => Number(a.is_living) - Number(b.is_living) || a.full_name.localeCompare(b.full_name, "vi"))
        .map((p) => ({ value: p.id, label: `${p.full_name}${p.is_living ? "" : " †"}` })),
    [tree],
  );
  const nameOf = (id: string | null | undefined) =>
    id ? (tree?.persons.find((p) => p.id === id)?.full_name ?? null) : null;

  const make = useMutation({
    mutationFn: async () => {
      const q = existing ?? null;
      const text = (q?.question ?? question).trim();
      if (text.length < 3) throw new Error(t`Câu hỏi quá ngắn`);
      const qid = q ? q.id : (await createQuestion({ clan_id: clanId, question: text, ask_person_id: askId || null, about_person_id: aboutId || null })).id;
      const askName = q ? q.ask_person_name : nameOf(askId);
      const link = await createContributeLink({ clan_id: clanId, recipient_label: askName, root_person_id: null });
      const url = questionLinkUrl(link.token, qid);
      return { url, message: draftQuestionMessage({ askName, question: text, url }) };
    },
    onSuccess: (r) => {
      setResult(r);
      track("community_question_create", { existing: existing ? 1 : 0 });
      void qc.invalidateQueries({ queryKey: ["family-questions", clanId] });
      void qc.invalidateQueries({ queryKey: ["contribute-links", clanId] });
    },
    onError: (e) => toast.error(t`Chưa tạo được`, { description: (e as Error).message }),
  });

  function close() {
    setResult(null);
    setQuestion(weekly);
    setAskId("");
    setAboutId(defaultAboutId ?? "");
    onClose();
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t`Đã sao chép`);
    } catch {
      toast.error(t`Không sao chép được, hãy chọn và sao chép bằng tay`);
    }
  }
  async function share() {
    if (!result) return;
    if (navigator.share) {
      try {
        await navigator.share({ text: result.message });
        return;
      } catch {
        /* người dùng huỷ */
      }
    }
    await copy(result.message);
  }

  return (
    <SidePanel
      open={open}
      onClose={close}
      size="lg"
      title={existing ? t`Gửi link trả lời` : t`Hỏi ông bà`}
      subtitle={existing ? existing.question : t`Một câu hỏi, người được hỏi trả lời qua link`}
    >
      {!result ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            make.mutate();
          }}
        >
          {!existing && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="q-text">{t`Câu hỏi`}</Label>
                <Textarea
                  id="q-text"
                  icon={<IconHelp />}
                  rows={3}
                  value={question}
                  maxLength={500}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[weekly, ...SUGGESTED_QUESTIONS.filter((s) => s !== weekly)].slice(0, 6).map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setQuestion(s)}
                      className={`rounded-full border px-2.5 py-1 text-left text-xs hover:border-primary ${question === s ? "border-primary bg-primary/10 text-primary" : ""}`}
                    >
                      {i === 0 ? t`Câu của tuần: ${s}` : s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-ask">{t`Hỏi ai? (không bắt buộc)`}</Label>
                <FilterableSelect
                  id="q-ask"
                  icon={<IconUser />}
                  value={askId}
                  onChange={setAskId}
                  options={living}
                  emptyLabel={t`Ai biết thì trả lời`}
                  filterLabel={t`Tìm người`}
                  filterPlaceholder={t`Gõ tên để tìm (không cần dấu)`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-about">{t`Hỏi về ai? (không bắt buộc)`}</Label>
                <FilterableSelect
                  id="q-about"
                  icon={<IconUsers />}
                  value={aboutId}
                  onChange={setAboutId}
                  options={everyone}
                  emptyLabel={t`Không gắn người cụ thể`}
                  filterLabel={t`Tìm người`}
                  filterPlaceholder={t`Gõ tên để tìm (không cần dấu)`}
                />
              </div>
            </>
          )}
          <p className="text-sm text-muted-foreground">
            {t`Tạo link riêng gửi qua Zalo / Facebook. Người nhận mở link là thấy câu hỏi và viết câu trả lời (bấm 🎤 trên bàn phím để nói) — không cần tài khoản.`}
          </p>
          <FormActions>
            <Button type="button" variant="outline" onClick={close}>
              {t`Huỷ`}
            </Button>
            <Button type="submit" disabled={make.isPending}>
              <IconLink className="mr-1.5 h-4 w-4" />
              {make.isPending ? t`Đang tạo…` : t`Tạo link hỏi`}
            </Button>
          </FormActions>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-url">{t`Link trả lời`}</Label>
            <Input id="q-url" icon={<IconLink />} readOnly value={result.url} onFocus={(e) => e.target.select()} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-msg">{t`Tin nhắn soạn sẵn (sửa thoải mái)`}</Label>
            <Textarea
              id="q-msg"
              rows={6}
              value={result.message}
              onChange={(e) => setResult({ ...result, message: e.target.value })}
            />
          </div>
          <FormActions>
            <Button type="button" variant="outline" onClick={() => void copy(result.url)}>
              <IconCopy className="mr-1.5 h-4 w-4" />
              {t`Chỉ sao chép link`}
            </Button>
            <Button type="button" onClick={() => void share()}>
              <IconShare2 className="mr-1.5 h-4 w-4" />
              {t`Gửi tin nhắn`}
            </Button>
          </FormActions>
        </div>
      )}
    </SidePanel>
  );
}
