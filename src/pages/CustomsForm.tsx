import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { IconCheck, IconPlus, IconX } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  CUSTOM_CATEGORY_LABEL,
  CUSTOM_MANDATORY_LABEL,
  CUSTOM_ORIGIN_LABEL,
  CUSTOM_REGIONS,
  CUSTOM_SCOPE_LABEL,
  createCustomEntry,
  getCustomEntry,
  updateCustomEntry,
  type CustomCategory,
  type CustomFaq,
  type CustomMandatory,
  type CustomOrigin,
  type CustomScope,
  type CustomSection,
  type CustomStatus,
} from "@/lib/queries/customs";
import { isSafeHttpsUrl } from "@/lib/queries/heritage";
import { getMyProfile } from "@/lib/queries/profile";
import { queryKeys } from "@/lib/queries/keys";

const CATS = Object.keys(CUSTOM_CATEGORY_LABEL) as CustomCategory[];
const SCOPES = Object.keys(CUSTOM_SCOPE_LABEL) as CustomScope[];
const MANDATORIES = Object.keys(CUSTOM_MANDATORY_LABEL) as CustomMandatory[];
const ORIGINS = Object.keys(CUSTOM_ORIGIN_LABEL) as CustomOrigin[];
const STATUSES: { value: CustomStatus; label: string }[] = [
  { value: "draft", label: "Nháp" },
  { value: "needs_review", label: "Chờ duyệt" },
  { value: "published", label: "Công khai" },
];

export default function CustomsForm() {
  const { entryId } = useParams<{ entryId?: string }>();
  const isEdit = !!entryId;
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

  const [title, setTitle] = useState("");
  const [aliases, setAliases] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [category, setCategory] = useState<CustomCategory>("tho_cung");
  const [regions, setRegions] = useState<string[]>([]);
  const [lunarMonth, setLunarMonth] = useState("");
  const [timing, setTiming] = useState("");
  const [scope, setScope] = useState<CustomScope | "">("");
  const [mandatory, setMandatory] = useState<CustomMandatory | "">("");
  const [origin, setOrigin] = useState<CustomOrigin | "">("");
  const [reliability, setReliability] = useState("");
  const [applicableTo, setApplicableTo] = useState("");
  const [sources, setSources] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState<CustomStatus>("needs_review");
  const [sections, setSections] = useState<CustomSection[]>([]);
  const [faq, setFaq] = useState<CustomFaq[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const { data: existing } = useQuery({
    queryKey: ["custom-entry", entryId],
    queryFn: () => getCustomEntry(entryId!),
    enabled: isEdit,
  });
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setAliases(existing.aliases.join(", "));
    setShortDesc(existing.short_description ?? "");
    setCategory(existing.category);
    setRegions(existing.regions);
    setLunarMonth(existing.lunar_month != null ? String(existing.lunar_month) : "");
    setTiming(existing.timing ?? "");
    setScope(existing.scope ?? "");
    setMandatory(existing.mandatory_level ?? "");
    setOrigin(existing.origin ?? "");
    setReliability(existing.reliability != null ? String(existing.reliability) : "");
    setApplicableTo(existing.applicable_to ?? "");
    setSources(existing.sources ?? "");
    setCoverUrl(existing.cover_image_url ?? "");
    setStatus(existing.status);
    setSections(existing.sections);
    setFaq(existing.faq);
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Thiếu tiêu đề.");
      if (coverUrl.trim() && !isSafeHttpsUrl(coverUrl.trim())) {
        throw new Error("Link ảnh phải là https://…");
      }
      const fields = {
        title: title.trim(),
        aliases: aliases
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        short_description: shortDesc.trim() || null,
        category,
        regions,
        lunar_month: lunarMonth.trim() ? Number(lunarMonth) : null,
        timing: timing.trim() || null,
        scope: scope || null,
        mandatory_level: mandatory || null,
        origin: origin || null,
        reliability: reliability.trim() ? Number(reliability) : null,
        applicable_to: applicableTo.trim() || null,
        sources: sources.trim() || null,
        cover_image_url: coverUrl.trim() || null,
        status,
        sections: sections
          .map((s) => ({ heading: s.heading.trim(), body: s.body.trim() }))
          .filter((s) => s.heading || s.body),
        faq: faq
          .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
          .filter((f) => f.q || f.a),
      };
      if (isEdit) {
        await updateCustomEntry(entryId!, fields);
        return { id: entryId! };
      }
      return createCustomEntry(fields);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["customs"] });
      qc.invalidateQueries({ queryKey: ["custom-entry", res.id] });
      toast.success(isEdit ? "Đã lưu" : "Đã tạo bài");
      navigate(`/so-tay/${res.id}`);
    },
    onError: (e) => setErr((e as Error).message),
  });

  // Gate: chỉ platform admin. Chờ auth + profile load xong mới quyết định
  // (tránh redirect sớm khi userId/profile chưa kịp có → đá nhầm về list).
  if (authLoading || (!!userId && profile === undefined)) {
    return (
      <Shell>
        <p className="text-muted-foreground">Đang tải…</p>
      </Shell>
    );
  }
  if (!profile?.is_platform_admin) return <Navigate to="/so-tay" replace />;

  const toggleRegion = (r: string) =>
    setRegions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );

  return (
    <Shell>
      <Link to="/so-tay" className="text-sm text-primary hover:underline">
        ← Sổ tay Văn hoá
      </Link>
      <h1 className="clan-name text-2xl font-semibold">
        {isEdit ? "Sửa bài" : "Thêm bài phong tục"}
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!save.isPending) save.mutate();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="c-title" required>Tiêu đề</Label>
          <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)}
            maxLength={200} placeholder="vd: Lễ nhập trạch (về nhà mới)" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-cat">Chủ đề</Label>
            <select id="c-cat" value={category}
              onChange={(e) => setCategory(e.target.value as CustomCategory)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {CATS.map((c) => (
                <option key={c} value={c}>{CUSTOM_CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-status">Trạng thái</Label>
            <select id="c-status" value={status}
              onChange={(e) => setStatus(e.target.value as CustomStatus)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Vùng miền</Label>
          <div className="flex flex-wrap gap-2">
            {CUSTOM_REGIONS.map((r) => (
              <button key={r} type="button" onClick={() => toggleRegion(r)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  regions.includes(r)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:border-primary"
                }`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-aliases">Tên gọi khác (cách nhau bởi dấu phẩy)</Label>
          <Input id="c-aliases" value={aliases} onChange={(e) => setAliases(e.target.value)}
            placeholder="nhà mới, chuyển nhà, tân gia" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-short">Mô tả ngắn</Label>
          <textarea id="c-short" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)}
            rows={2} maxLength={300}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-base leading-relaxed resize-y" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="c-mand">Mức bắt buộc</Label>
            <select id="c-mand" value={mandatory}
              onChange={(e) => setMandatory(e.target.value as CustomMandatory | "")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">—</option>
              {MANDATORIES.map((m) => (
                <option key={m} value={m}>{CUSTOM_MANDATORY_LABEL[m]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-origin">Nguồn gốc</Label>
            <select id="c-origin" value={origin}
              onChange={(e) => setOrigin(e.target.value as CustomOrigin | "")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">—</option>
              {ORIGINS.map((o) => (
                <option key={o} value={o}>{CUSTOM_ORIGIN_LABEL[o]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-scope">Phạm vi</Label>
            <select id="c-scope" value={scope}
              onChange={(e) => setScope(e.target.value as CustomScope | "")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">—</option>
              {SCOPES.map((s) => (
                <option key={s} value={s}>{CUSTOM_SCOPE_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="c-rel">Độ tin cậy (1–5)</Label>
            <Input id="c-rel" type="number" min={1} max={5} value={reliability}
              onChange={(e) => setReliability(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-lunar">Tháng âm lịch (1–12)</Label>
            <Input id="c-lunar" type="number" min={1} max={12} value={lunarMonth}
              onChange={(e) => setLunarMonth(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-timing">Thời điểm (mô tả)</Label>
            <Input id="c-timing" value={timing} onChange={(e) => setTiming(e.target.value)}
              placeholder="vd: 23 tháng Chạp" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-applic">Đối tượng áp dụng</Label>
          <Input id="c-applic" value={applicableTo} onChange={(e) => setApplicableTo(e.target.value)}
            placeholder="vd: gia đình chuyển đến nhà mới" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-cover">Link ảnh bìa (https)</Label>
          <Input id="c-cover" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://…" />
        </div>

        {/* Các đoạn nội dung */}
        <div className="space-y-2">
          <Label className="block">Nội dung (chia đoạn có tiêu đề)</Label>
          <p className="text-sm text-muted-foreground">
            Gợi ý các đoạn: Ý nghĩa · Chuẩn bị / lễ vật · Trình tự thực hiện ·
            Nên / kiêng kỵ · Biến thể vùng miền.
          </p>
          {sections.map((sec, i) => (
            <div key={i} className="rounded-md border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                <Input value={sec.heading}
                  onChange={(e) =>
                    setSections((p) => p.map((s, j) => (j === i ? { ...s, heading: e.target.value } : s)))
                  }
                  placeholder="Tiêu đề đoạn" maxLength={200} className="flex-1" />
                <button type="button" aria-label="Lên" disabled={i === 0}
                  onClick={() => setSections((p) => { const a = [...p]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; })}
                  className="px-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30">▲</button>
                <button type="button" aria-label="Xuống" disabled={i === sections.length - 1}
                  onClick={() => setSections((p) => { const a = [...p]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return a; })}
                  className="px-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30">▼</button>
                <button type="button" aria-label="Xoá đoạn"
                  onClick={() => setSections((p) => p.filter((_, j) => j !== i))}
                  className="px-1.5 text-muted-foreground hover:text-destructive">
                  <IconX className="h-4 w-4" />
                </button>
              </div>
              <textarea value={sec.body}
                onChange={(e) =>
                  setSections((p) => p.map((s, j) => (j === i ? { ...s, body: e.target.value } : s)))
                }
                rows={5} placeholder="Nội dung đoạn này…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base leading-relaxed" />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm"
            onClick={() => setSections((p) => [...p, { heading: "", body: "" }])}>
            <IconPlus className="h-4 w-4 mr-1" /> Thêm đoạn
          </Button>
        </div>

        {/* Câu hỏi thường gặp (tuỳ chọn) */}
        <div className="space-y-2">
          <Label className="block">Câu hỏi thường gặp (tuỳ chọn)</Label>
          <p className="text-sm text-muted-foreground">
            Mỗi mục gồm 1 câu hỏi và câu trả lời ngắn gọn.
          </p>
          {faq.map((item, i) => (
            <div key={i} className="rounded-md border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                <Input value={item.q}
                  onChange={(e) =>
                    setFaq((p) => p.map((f, j) => (j === i ? { ...f, q: e.target.value } : f)))
                  }
                  placeholder="Câu hỏi" maxLength={300} className="flex-1" />
                <button type="button" aria-label="Xoá câu hỏi"
                  onClick={() => setFaq((p) => p.filter((_, j) => j !== i))}
                  className="px-1.5 text-muted-foreground hover:text-destructive">
                  <IconX className="h-4 w-4" />
                </button>
              </div>
              <textarea value={item.a}
                onChange={(e) =>
                  setFaq((p) => p.map((f, j) => (j === i ? { ...f, a: e.target.value } : f)))
                }
                rows={3} placeholder="Câu trả lời…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base leading-relaxed" />
            </div>
          ))}
          <Button type="button" variant="outline" size="sm"
            onClick={() => setFaq((p) => [...p, { q: "", a: "" }])}>
            <IconPlus className="h-4 w-4 mr-1" /> Thêm câu hỏi
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-sources">Nguồn tham khảo</Label>
          <Input id="c-sources" value={sources} onChange={(e) => setSources(e.target.value)} />
        </div>

        {err && <p className="text-sm text-destructive">{err}</p>}

        <div className="flex gap-2 justify-end">
          <Button type="submit" disabled={save.isPending || !title.trim()}>
            <IconCheck className="h-4 w-4 mr-1.5" />
            {save.isPending ? "Đang lưu…" : "Lưu"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Hủy</Button>
        </div>
      </form>
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
