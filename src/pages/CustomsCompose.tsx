import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useConfirm } from "@/components/ConfirmDialog";
import { CustomsShell } from "@/components/CustomsShell";
import { IconArrowLeft, IconBook, IconPencil } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { BLOG_CATEGORIES, buildMarkdownFile, EMPTY_DRAFT, slugOf, type Draft } from "@/lib/customs/compose";
import { queryKeys } from "@/lib/queries/keys";
import { PublishError, publishSoTay, type PublishResult } from "@/lib/queries/soTayPublish";
import { getMyProfile } from "@/lib/queries/profile";

import { t } from "@lingui/core/macro";

const MarkdownEditor = lazy(() => import("@/components/markdown/MarkdownEditor"));

const DRAFT_KEY = "family-tree:so-tay-soan";

export default function CustomsCompose() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });
  const isAdmin = !!profile?.is_platform_admin;

  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY_DRAFT;
    } catch {
      return EMPTY_DRAFT;
    }
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // Tự lưu nháp trong trình duyệt (không lên máy chủ).
  useEffect(() => {
    const h = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        /* chế độ riêng tư — bỏ qua */
      }
    }, 500);
    return () => clearTimeout(h);
  }, [draft]);

  const slug = useMemo(() => slugOf(draft.title), [draft.title]);
  const ready = draft.title.trim().length > 0 && draft.description.trim().length >= 20 && draft.body.trim().length > 0;
  const file = useMemo(() => buildMarkdownFile(draft), [draft]);

  const [result, setResult] = useState<(PublishResult & { published: boolean }) | null>(null);

  const publishM = useMutation({
    mutationFn: async ({ publish }: { publish: boolean }) => {
      try {
        return { ...(await publishSoTay(draft, { publish })), published: publish };
      } catch (e) {
        // Trùng địa chỉ bài: hỏi lại, đồng ý thì ghi đè.
        if (e instanceof PublishError && e.code === "exists") {
          const ok = await confirm({
            title: t`Đã có bài cùng tên`,
            description: t`Một bài có cùng địa chỉ đã có trong Sổ tay. Ghi đè sẽ thay nội dung bài cũ bằng bài đang soạn.`,
            confirmLabel: t`Ghi đè`,
            destructive: true,
          });
          if (!ok) throw new PublishError(t`Đã huỷ, bài cũ được giữ nguyên.`);
          return { ...(await publishSoTay(draft, { publish, overwrite: true })), published: publish };
        }
        throw e;
      }
    },
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["customs"] });
      toast.success(r.published ? t`Đã gửi bài đi đăng` : t`Đã lưu bài chờ duyệt`);
    },
    onError: (e) => toast.error(t`Chưa đăng được`, { description: (e as Error).message }),
  });

  async function onPublish() {
    const ok = await confirm({
      title: t`Đăng bài lên web và app?`,
      description: t`Bài sẽ được lưu vào kho nội dung và hệ thống tự cập nhật lên web và app, mất vài phút. Ai cũng đọc được bài này.`,
      confirmLabel: t`Đăng`,
    });
    if (ok) publishM.mutate({ publish: true });
  }

  function download() {
    const blob = new Blob([file], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug || "bai-moi"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(file);
      toast.success(t`Đã chép nội dung tệp .md`);
    } catch {
      toast.error(t`Không chép được`);
    }
  }

  if (isLoading) {
    return (
      <CustomsShell>
        <p className="text-muted-foreground">{t`Đang tải…`}</p>
      </CustomsShell>
    );
  }
  if (!isAdmin) {
    return (
      <CustomsShell>
        <p className="text-muted-foreground">{t`Chỉ quản trị nền tảng được soạn bài Sổ tay.`}</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/so-tay">
            <IconArrowLeft className="mr-1.5 h-4 w-4" />
            {t`Về Sổ tay`}
          </Link>
        </Button>
      </CustomsShell>
    );
  }

  return (
    <CustomsShell>
      <PageHeader
        icon={<IconPencil className="h-7 w-7" />}
        title={t`Soạn bài Sổ tay`}
        description={t`Viết bài, xem trước ngay bên phải, rồi bấm Đăng để bài lên web và app.`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">{t`Tiêu đề`}</span>
          <Input value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder={t`Vd: Lễ nhập trạch (về nhà mới)`} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">{t`Mô tả ngắn (hiện ở danh sách và Google, nên 140–160 ký tự)`}</span>
          <Textarea rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} />
          <span className="text-xs text-muted-foreground">{draft.description.trim().length} {t`ký tự`}</span>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t`Chủ đề`}</span>
          <Select value={draft.category} onChange={(e) => set("category", e.target.value)}>
            {BLOG_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t`Thời điểm`}</span>
          <Input value={draft.timing} onChange={(e) => set("timing", e.target.value)} placeholder={t`Vd: Rằm tháng 7 âm lịch`} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t`Thẻ (cách nhau bằng dấu phẩy)`}</span>
          <Input value={draft.tags} onChange={(e) => set("tags", e.target.value)} placeholder={t`Miền Bắc, Hà Nội, Tháng Giêng âm lịch`} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">{t`Tên gọi khác / tình huống (cách nhau bằng dấu phẩy)`}</span>
          <Input value={draft.aliases} onChange={(e) => set("aliases", e.target.value)} placeholder={t`nhà mới, tân gia, chuyển nhà`} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium">{t`Vùng (Miền Bắc, Miền Trung, Miền Nam)`}</span>
          <Input value={draft.regions} onChange={(e) => set("regions", e.target.value)} />
        </label>
      </div>

      <div className="space-y-1">
        <span className="text-sm font-medium">{t`Nội dung (mỗi mục bắt đầu bằng ## Tiêu đề mục)`}</span>
        <Suspense fallback={<p className="py-6 text-sm text-muted-foreground">{t`Đang tải trình soạn thảo…`}</p>}>
          <MarkdownEditor value={draft.body} onChange={(v) => set("body", v)} />
        </Suspense>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-base font-semibold">{t`Đăng bài`}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onPublish} disabled={!ready || publishM.isPending}>
            <IconBook className="mr-2 h-5 w-5" />
            {publishM.isPending ? t`Đang gửi…` : t`Đăng lên web và app`}
          </Button>
          <Button variant="outline" onClick={() => publishM.mutate({ publish: false })} disabled={!ready || publishM.isPending}>
            {t`Lưu chờ duyệt`}
          </Button>
        </div>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <b>{t`Đăng lên web và app`}</b>: {t`bài hiện cho mọi người sau vài phút (hệ thống tự cập nhật).`}
          </li>
          <li>
            <b>{t`Lưu chờ duyệt`}</b>: {t`chỉ lưu vào kho nội dung, chưa hiện ra ngoài. Duyệt sau.`}
          </li>
        </ul>
        {result && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
            <p className="font-medium">
              {result.published
                ? result.deploying
                  ? t`Đã đăng. Web và app sẽ có bài này sau vài phút.`
                  : t`Bài đã được lưu nhưng chưa chạy được bước cập nhật tự động. Báo người quản trị hệ thống.`
                : t`Đã lưu chờ duyệt (chưa hiện ra ngoài).`}
            </p>
            {result.deployError && <p className="mt-1 text-muted-foreground">{result.deployError}</p>}
            {result.commitUrl && (
              <a href={result.commitUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-primary underline">
                {t`Xem bản lưu trên GitHub`}
              </a>
            )}
          </div>
        )}
      </div>

      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">{t`Cách khác: lưu về máy`}</summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={download} disabled={!ready}>
              {t`Lưu bài về máy`} {slug ? `${slug}.md` : ".md"}
            </Button>
            <Button variant="outline" onClick={copy} disabled={!ready}>
              {t`Chép nội dung bài`}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t`Dùng khi chưa đăng được trực tiếp: tải tệp rồi nhờ người quản trị đưa vào kho nội dung.`}</p>
        </div>
      </details>
      <Button
        variant="ghost"
        onClick={() => {
          if (window.confirm(t`Xoá hết nội dung đang soạn và bắt đầu lại?`)) setDraft(EMPTY_DRAFT);
        }}
      >
        {t`Xoá hết, soạn lại`}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t`Bản nháp tự lưu trong trình duyệt này, đóng trang rồi mở lại vẫn còn.`}
      </p>
    </CustomsShell>
  );
}
