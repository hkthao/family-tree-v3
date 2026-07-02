import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { IconCheck, IconUpload } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  extractCoverImage,
  parseCustomMarkdown,
  splitMarkdownEntries,
  type ParsedCustomEntry,
} from "@/lib/customs/markdown";
import {
  CUSTOM_CATEGORY_LABEL,
  CUSTOM_REGIONS,
  createCustomEntry,
  listCustomEntriesLite,
  type CustomCategory,
  type CustomStatus,
} from "@/lib/queries/customs";
import { getMyProfile } from "@/lib/queries/profile";
import { queryKeys } from "@/lib/queries/keys";

const CATS = Object.keys(CUSTOM_CATEGORY_LABEL) as CustomCategory[];
const STATUSES: { value: CustomStatus; label: string }[] = [
  { value: "draft", label: "Nháp" },
  { value: "needs_review", label: "Chờ duyệt" },
  { value: "published", label: "Công khai" },
];

interface PreviewItem extends ParsedCustomEntry {
  duplicate: boolean;
  /** Lý do sẽ bị bỏ qua (nếu có). */
  skip: string | null;
}

interface ImportResult {
  created: { title: string; id: string }[];
  skipped: { title: string; reason: string }[];
  failed: { title: string; error: string }[];
}

export default function CustomsImport() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });

  const [mdText, setMdText] = useState("");
  const [category, setCategory] = useState<CustomCategory>("tho_cung");
  const [regions, setRegions] = useState<string[]>([]);
  const [status, setStatus] = useState<CustomStatus>("needs_review");
  const [result, setResult] = useState<ImportResult | null>(null);

  // Tên bài đã có → cảnh báo trùng (bỏ qua khi tạo).
  const { data: lite } = useQuery({
    queryKey: ["customs-lite"],
    queryFn: () => listCustomEntriesLite(),
    enabled: !!userId,
  });
  const existingTitles = useMemo(
    () => new Set((lite ?? []).map((e) => e.title.trim().toLowerCase())),
    [lite],
  );

  const preview: PreviewItem[] = useMemo(() => {
    if (!mdText.trim()) return [];
    const seen = new Set<string>();
    return splitMarkdownEntries(mdText).map((chunk) => {
      const p = parseCustomMarkdown(chunk);
      const key = p.title.trim().toLowerCase();
      const duplicate = !!key && existingTitles.has(key);
      const dupInBatch = !!key && seen.has(key);
      if (key) seen.add(key);
      let skip: string | null = null;
      if (!p.title.trim()) skip = "Thiếu tiêu đề (dòng '# ')";
      else if (duplicate) skip = "Đã có bài cùng tên";
      else if (dupInBatch) skip = "Trùng tên trong danh sách dán";
      return { ...p, duplicate, skip };
    });
  }, [mdText, existingTitles]);

  const importable = preview.filter((p) => !p.skip);

  const run = useMutation({
    mutationFn: async (): Promise<ImportResult> => {
      const res: ImportResult = { created: [], skipped: [], failed: [] };
      for (const p of preview) {
        if (p.skip) {
          res.skipped.push({ title: p.title || "(không tiêu đề)", reason: p.skip });
          continue;
        }
        try {
          // Lấy ảnh minh hoạ đầu tiên làm ảnh bìa (card cần hình).
          const { cover_image_url, sections } = extractCoverImage(p.sections);
          const { id } = await createCustomEntry({
            title: p.title.trim(),
            category,
            regions,
            status,
            short_description: p.short_description.trim() || null,
            cover_image_url,
            sections,
            faq: p.faq,
          });
          res.created.push({ title: p.title.trim(), id });
        } catch (e) {
          res.failed.push({ title: p.title.trim(), error: (e as Error).message });
        }
      }
      return res;
    },
    onSuccess: (res) => {
      setResult(res);
      qc.invalidateQueries({ queryKey: ["customs"] });
      qc.invalidateQueries({ queryKey: ["customs-lite"] });
      toast.success(`Đã tạo ${res.created.length} bài.`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (authLoading || (!!userId && profile === undefined)) {
    return (
      <Shell>
        <p className="text-muted-foreground">Đang tải…</p>
      </Shell>
    );
  }
  if (!profile?.is_platform_admin) return <Navigate to="/so-tay" replace />;

  const toggleRegion = (r: string) =>
    setRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  return (
    <Shell>
      <Link to="/so-tay" className="text-sm text-primary hover:underline">
        ← Sổ tay Văn hoá
      </Link>
      <h1 className="clan-name text-2xl font-semibold">Nhập hàng loạt từ Markdown</h1>
      <p className="text-sm text-muted-foreground">
        Dán nhiều bài, mỗi bài bắt đầu bằng <code>#</code> Tiêu đề. Trong mỗi bài:
        đoạn mở đầu là mô tả ngắn, mỗi <code>##</code> là một đoạn,
        <code> ![chú thích](https://…)</code> làm ảnh minh hoạ, đoạn
        <code> ## Câu hỏi thường gặp</code> với các <code>###</code> thành FAQ.
        Chủ đề / vùng miền / trạng thái bên dưới áp dụng cho tất cả bài trong lần nhập này.
      </p>

      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary hover:underline">
        <IconUpload className="h-4 w-4" /> Chọn file .md (có thể chọn nhiều)…
        <input
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) {
              const texts = await Promise.all(files.map((f) => f.text()));
              setMdText((prev) => [prev, ...texts].filter((t) => t.trim()).join("\n\n"));
              setResult(null);
            }
            e.target.value = "";
          }}
        />
      </label>
      <textarea
        value={mdText}
        onChange={(e) => {
          setMdText(e.target.value);
          setResult(null);
        }}
        rows={14}
        placeholder={"# Bài thứ nhất\n\nMô tả ngắn…\n\n## Ý nghĩa\n…\n\n# Bài thứ hai\n\n## Ý nghĩa\n…"}
        className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed resize-y"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="i-cat">Chủ đề (áp dụng cho tất cả)</Label>
          <select
            id="i-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as CustomCategory)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {CATS.map((c) => (
              <option key={c} value={c}>
                {CUSTOM_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="i-status">Trạng thái</Label>
          <select
            id="i-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as CustomStatus)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Vùng miền (áp dụng cho tất cả)</Label>
        <div className="flex flex-wrap gap-2">
          {CUSTOM_REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRegion(r)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                regions.includes(r)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:border-primary"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {preview.length > 0 && (
        <div className="space-y-2">
          <Label className="block">
            Xem trước — {preview.length} bài, {importable.length} sẽ được tạo
          </Label>
          <ul className="rounded-md border bg-card divide-y text-sm">
            {preview.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <span className="font-medium">{p.title || "(không tiêu đề)"}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {p.sections.length} đoạn · {p.faq.length} câu hỏi
                  </span>
                </div>
                {p.skip ? (
                  <span className="shrink-0 text-xs text-amber-700">↷ {p.skip}</span>
                ) : (
                  <span className="shrink-0 text-xs text-emerald-700">✓ sẽ tạo</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="rounded-md border bg-card p-3 space-y-1 text-sm">
          <p className="font-medium text-emerald-700">Đã tạo {result.created.length} bài.</p>
          {result.skipped.length > 0 && (
            <p className="text-amber-700">
              Bỏ qua {result.skipped.length}: {result.skipped.map((s) => `${s.title} (${s.reason})`).join("; ")}
            </p>
          )}
          {result.failed.length > 0 && (
            <p className="text-destructive">
              Lỗi {result.failed.length}: {result.failed.map((f) => `${f.title} (${f.error})`).join("; ")}
            </p>
          )}
          <div className="pt-1">
            <Button size="sm" variant="outline" onClick={() => navigate("/so-tay")}>
              Về danh sách
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate("/so-tay")}>
          Hủy
        </Button>
        <Button
          type="button"
          disabled={run.isPending || importable.length === 0}
          onClick={() => run.mutate()}
        >
          <IconCheck className="h-4 w-4 mr-1.5" />
          {run.isPending ? "Đang tạo…" : `Tạo ${importable.length} bài`}
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">{children}</main>
    </div>
  );
}
