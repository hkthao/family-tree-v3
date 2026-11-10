import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/components/Toast";
import { IconCheck, IconPlus, IconTrash, IconX } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { useAuth } from "@/hooks/useAuth";
import { createClan } from "@/lib/queries/clans";
import { BookMetaFields } from "@/components/BookMetaFields";
import { BookTextsSection } from "@/components/BookTextsSection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBranch } from "@/lib/queries/branches";
import {
  ClanBasicFields,
  ClanDisplayFields,
  DEFAULT_CLAN_FORM,
  clanFormToColumns,
  type ClanFormValues,
} from "@/components/ClanFormFields";
import {
  EMPTY_BOOK_TEXTS,
  cleanBookTexts,
  saveClanBookTexts,
  type ClanBookTexts,
} from "@/lib/queries/clan-book";

interface NewClanFormProps {
  /** Gọi sau khi tạo xong, nhận id dòng họ mới. */
  onDone: (clanId: string) => void;
  onCancel: () => void;
}

/** Form tạo dòng họ — dùng cho trang /clans/new VÀ ngăn kéo phải (?panel=clan-new). */
export function NewClanForm({ onDone, onCancel }: NewClanFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Cùng bộ ô với form Chỉnh sửa (ClanFormFields + BookMetaFields).
  const [values, setValues] = useState<ClanFormValues>(DEFAULT_CLAN_FORM);
  const [meta, setMeta] = useState<ClanBookTexts>(EMPTY_BOOK_TEXTS);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchDraft, setBranchDraft] = useState("");

  function addBranch() {
    const n = branchDraft.trim();
    if (!n || branches.includes(n)) return;
    setBranches([...branches, n]);
    setBranchDraft("");
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const clan = await createClan(clanFormToColumns(values), user!.id);
      // Thông tin biên soạn sổ gia phả: lỗi (vd chưa áp migration) không được
      // làm hỏng việc tạo dòng họ — sửa lại được ở trang Sổ gia phả.
      const clean = cleanBookTexts(meta);
      if (Object.values(clean).some(Boolean)) {
        try {
          await saveClanBookTexts(clan.id, clean);
        } catch {
          /* bỏ qua */
        }
      }
      // Các chi nhập trong form: lỗi từng chi không làm hỏng việc tạo, thêm lại được ở trang Sổ gia phả.
      for (const name of branches) {
        try {
          await createBranch({ clan_id: clan.id, name });
        } catch {
          /* bỏ qua */
        }
      }
      return clan;
    },
    onSuccess: async (clan) => {
      await queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "clans",
      });
      toast.success("Đã tạo dòng họ", { description: values.name });
      onDone(clan.id);
    },
    onError: (e) => toast.error("Không tạo được", { description: (e as Error).message }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (values.name.trim()) mutation.mutate();
      }}
      className="space-y-5"
    >
      <ClanBasicFields value={values} onChange={setValues} idPrefix="new" />

      <fieldset className="space-y-3">
        <legend className="text-base font-medium mb-1">Thông tin cho sổ gia phả</legend>
        <p className="text-sm text-muted-foreground">
          Tuỳ chọn, in ở bìa và trang giới thiệu của sổ; điền sau cũng được.
        </p>
        <BookMetaFields value={meta} onChange={setMeta} idPrefix="new" />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-medium mb-1">Chi (nhánh)</legend>
        <p className="text-sm text-muted-foreground">
          Các chi/nhánh của dòng họ; có thể thêm sau.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="new-branch">Tên chi</Label>
          <div className="flex items-center gap-2">
            <Input
              id="new-branch"
              className="h-10"
              maxLength={100}
              value={branchDraft}
              placeholder="Vd: Chi cả"
              onChange={(e) => setBranchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addBranch();
                }
              }}
            />
            <Button
              size="sm"
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={!branchDraft.trim()}
              onClick={addBranch}
            >
              <IconPlus className="h-4 w-4 mr-1.5" />
              Thêm chi
            </Button>
          </div>
        </div>
        {branches.length > 0 && (
          <ul className="divide-y rounded-md border">
            {branches.map((b) => (
              <li key={b} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="truncate">{b}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  aria-label={`Bỏ chi ${b}`}
                  title="Bỏ chi này"
                  onClick={() => setBranches(branches.filter((x) => x !== b))}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-medium mb-1">Nội dung Sổ gia phả</legend>
        <p className="text-sm text-muted-foreground">
          Chọn mẫu để có sẵn bài hoàn chỉnh rồi sửa lại; AI soạn theo mô tả dùng được sau khi tạo.
        </p>
        <BookTextsSection
          clanName={values.name}
          canEdit
          value={meta}
          onChange={setMeta}
        />
      </fieldset>

      <ClanDisplayFields value={values} onChange={setValues} />

      {mutation.error && (
        <Alert variant="destructive">
          <AlertDescription>{(mutation.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <FormActions>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>
          <IconX className="h-4 w-4 mr-1.5" />
          Hủy
        </Button>
        <Button
          size="sm"
          type="submit"
          variant="default"
          data-testid="clan-submit-button"
          disabled={mutation.isPending || !values.name.trim()}
        >
          {mutation.isPending ? (
            "Đang tạo…"
          ) : (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              Tạo dòng họ
            </>
          )}
        </Button>
      </FormActions>
    </form>
  );
}

export default function NewClan() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        <Breadcrumb
          items={[
            { label: "Dòng họ", to: "/clans" },
            { label: "Tạo dòng họ mới" },
          ]}
        />

        <PageHeader
          icon={<IconPlus className="h-7 w-7" />}
          title="Tạo dòng họ mới"
          description="Đặt tên và vài thông tin cơ bản — tạo xong là dòng họ rỗng, sẵn sàng thêm Thuỷ tổ."
        />

        <NewClanForm
          onDone={(id) => navigate(`/clans/${id}`)}
          onCancel={() => navigate("/clans")}
        />
      </main>
    </div>
  );
}
