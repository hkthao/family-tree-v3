import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  IconBook,
  IconCalendar,
  IconCamera,
  IconCheck,
  IconClock,
  IconGlobe,
  IconHelp,
  IconLink,
  IconPlus,
  IconScroll,
  IconSearch,
  IconShield,
  IconTag,
  IconUpload,
  IconUsers,
  IconX,
} from "@/components/icons";
import { extractCoverImage, parseCustomMarkdown } from "@/lib/customs/markdown";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import type { EmbeddedForm } from "@/components/panel/embedded";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  CUSTOM_CATEGORY_LABEL,
  CUSTOM_MANDATORY_LABEL,
  CUSTOM_ORIGIN_LABEL,
  CUSTOM_REGIONS,
  CUSTOM_SCOPE_LABEL,
  createCustomEntry,
  getCustomEntry,
  listCustomEntriesLite,
  updateCustomEntry,
  type CustomCategory,
  type CustomEntryLite,
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

import { Trans } from "@lingui/react/macro";
import { t, msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";
const CATS = Object.keys(CUSTOM_CATEGORY_LABEL) as CustomCategory[];
const SCOPES = Object.keys(CUSTOM_SCOPE_LABEL) as CustomScope[];
const MANDATORIES = Object.keys(CUSTOM_MANDATORY_LABEL) as CustomMandatory[];
const ORIGINS = Object.keys(CUSTOM_ORIGIN_LABEL) as CustomOrigin[];
const STATUSES: { value: CustomStatus; label: string }[] = lazyMessages([
  { value: "draft", label: msg`Nháp` },
  { value: "needs_review", label: msg`Chờ duyệt` },
  { value: "published", label: msg`Công khai` },
]) as unknown as { value: CustomStatus; label: string }[];

export default function CustomsForm({
  embedded,
}: { embedded?: EmbeddedForm } = {}) {
  const routeParams = useParams<{ entryId?: string }>();
  const entryId = embedded ? embedded.id : routeParams.entryId;
  const isEdit = !!entryId;
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

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
  const [origins, setOrigins] = useState<CustomOrigin[]>([]);
  const [reliability, setReliability] = useState("");
  const [applicableTo, setApplicableTo] = useState("");
  const [sources, setSources] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState<CustomStatus>("needs_review");
  const [sections, setSections] = useState<CustomSection[]>([]);
  const [faq, setFaq] = useState<CustomFaq[]>([]);
  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [relatedQ, setRelatedQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Nhập nhanh từ Markdown (thân bài) → điền title/mô tả/đoạn/FAQ.
  const [mdOpen, setMdOpen] = useState(false);
  const [mdText, setMdText] = useState("");
  const applyMarkdown = async () => {
    const parsed = parseCustomMarkdown(mdText);
    if (!parsed.title && parsed.sections.length === 0) {
      toast.error(
        t`Chưa nhận ra nội dung — cần có '# Tiêu đề' và các '## Đoạn'.`,
      );
      return;
    }
    const hasContent =
      !!title.trim() ||
      !!shortDesc.trim() ||
      sections.length > 0 ||
      faq.length > 0;
    if (hasContent) {
      const ok = await confirm({
        title: t`Ghi đè nội dung hiện tại?`,
        description: t`Tiêu đề, mô tả, các đoạn và FAQ đang có sẽ bị thay bằng nội dung Markdown.`,
        confirmLabel: t`Ghi đè`,
        destructive: true,
      });
      if (!ok) return;
    }
    const m = parsed.meta;
    // Ảnh bìa: ưu tiên frontmatter; nếu không, lấy ảnh minh hoạ đầu tiên làm bìa
    // (card cần hình) và gỡ khỏi đoạn để trang xem khỏi hiện trùng.
    const useSectionCover = !m.cover_image_url && !coverUrl.trim();
    const { cover_image_url, sections: secs } = useSectionCover
      ? extractCoverImage(parsed.sections)
      : { cover_image_url: null, sections: parsed.sections };

    if (parsed.title) setTitle(parsed.title);
    setShortDesc(parsed.short_description);
    setSections(secs);
    setFaq(parsed.faq);
    if (m.cover_image_url) setCoverUrl(m.cover_image_url);
    else if (cover_image_url) setCoverUrl(cover_image_url);

    // Metadata từ frontmatter (nếu có) → điền các ô tương ứng.
    if (m.category) setCategory(m.category);
    if (m.regions) setRegions(m.regions);
    if (m.aliases) setAliases(m.aliases.join(", "));
    if (m.origins) setOrigins(m.origins);
    if (m.mandatory_level) setMandatory(m.mandatory_level);
    if (m.scope) setScope(m.scope);
    if (m.reliability != null) setReliability(String(m.reliability));
    if (m.lunar_month != null) setLunarMonth(String(m.lunar_month));
    if (m.timing) setTiming(m.timing);
    if (m.applicable_to) setApplicableTo(m.applicable_to);
    if (m.sources) setSources(m.sources);

    setMdOpen(false);
    setMdText("");
    const metaCount = Object.keys(m).length;
    toast.success(
      t`Đã nhập ${secs.length} đoạn, ${parsed.faq.length} câu hỏi` +
        (metaCount ? t`, ${metaCount} thông tin` : "") +
        t` — xem lại rồi Lưu.`,
    );
  };

  // Danh sách bài (id, title) để chọn "bài liên quan".
  const { data: allLite } = useQuery({
    queryKey: ["customs-lite"],
    queryFn: () => listCustomEntriesLite(),
    enabled: !!userId,
  });

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
    setLunarMonth(
      existing.lunar_month != null ? String(existing.lunar_month) : "",
    );
    setTiming(existing.timing ?? "");
    setScope(existing.scope ?? "");
    setMandatory(existing.mandatory_level ?? "");
    setOrigins(existing.origins ?? []);
    setReliability(
      existing.reliability != null ? String(existing.reliability) : "",
    );
    setApplicableTo(existing.applicable_to ?? "");
    setSources(existing.sources ?? "");
    setCoverUrl(existing.cover_image_url ?? "");
    setStatus(existing.status);
    setSections(existing.sections);
    setFaq(existing.faq);
    setRelatedIds(existing.related_ids ?? []);
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error(t`Thiếu tiêu đề.`);
      if (coverUrl.trim() && !isSafeHttpsUrl(coverUrl.trim())) {
        throw new Error(t`Link ảnh bìa phải là https://…`);
      }
      if (
        sections.some(
          (s) => s.image_url?.trim() && !isSafeHttpsUrl(s.image_url.trim()),
        )
      ) {
        throw new Error(t`Ảnh minh hoạ trong đoạn phải là https://…`);
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
        origins,
        related_ids: relatedIds,
        reliability: reliability.trim() ? Number(reliability) : null,
        applicable_to: applicableTo.trim() || null,
        sources: sources.trim() || null,
        cover_image_url: coverUrl.trim() || null,
        status,
        sections: sections
          .map((s) => {
            const out: CustomSection = {
              heading: s.heading.trim(),
              body: s.body.trim(),
            };
            if (s.image_url?.trim()) out.image_url = s.image_url.trim();
            if (s.image_caption?.trim())
              out.image_caption = s.image_caption.trim();
            return out;
          })
          .filter((s) => s.heading || s.body || s.image_url),
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
      toast.success(isEdit ? t`Đã lưu` : t`Đã tạo bài`);
      if (embedded) embedded.onDone(res.id);
      else navigate(`/so-tay/${res.id}`);
    },
    onError: (e) => setErr((e as Error).message),
  });

  // Gate: chỉ platform admin. Chờ auth + profile load xong mới quyết định
  // (tránh redirect sớm khi userId/profile chưa kịp có → đá nhầm về list).
  if (authLoading || (!!userId && profile === undefined)) {
    const loading = <p className="text-muted-foreground">{t`Đang tải…`}</p>;
    return embedded ? loading : <Shell>{loading}</Shell>;
  }
  if (!profile?.is_platform_admin) {
    if (embedded)
      return (
        <p className="text-sm text-muted-foreground">{t`Chỉ quản trị nền tảng được sửa Sổ tay.`}</p>
      );
    return <Navigate to="/so-tay" replace />;
  }

  const toggleRegion = (r: string) =>
    setRegions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  const toggleOrigin = (o: CustomOrigin) =>
    setOrigins((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o],
    );

  // Phần dẫn xuất cho picker "bài liên quan" (allLite/relatedQ là hook, khai
  // báo ở đầu component để tôn trọng Rules of Hooks).
  const relatedPool: CustomEntryLite[] = (allLite ?? []).filter(
    (e) => e.id !== entryId,
  );
  const relatedChosen = relatedIds
    .map((id) => relatedPool.find((e) => e.id === id))
    .filter((x): x is CustomEntryLite => !!x);
  const relatedMatches = relatedQ.trim()
    ? relatedPool
        .filter((e) => !relatedIds.includes(e.id))
        .filter((e) =>
          e.title.toLowerCase().includes(relatedQ.trim().toLowerCase()),
        )
        .slice(0, 6)
    : [];

  const content = (
    <>
      {!embedded && (
        <Link to="/so-tay" className="text-sm text-primary hover:underline">
          {t`← Sổ tay Văn hoá`}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!embedded && (
          <h1 className="clan-name text-2xl font-semibold">
            {isEdit ? t`Sửa bài` : t`Thêm bài phong tục`}
          </h1>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMdOpen((v) => !v)}
        >
          <IconUpload className="h-4 w-4 mr-1" /> {t`Nhập từ Markdown`}
        </Button>
      </div>

      {mdOpen && (
        <div className="rounded-xl border bg-card shadow-sm p-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Dán <strong>{t`thân Markdown`}</strong>: <code>#</code> Tiêu đề ·
            đoạn mở đầu là mô tả ngắn · mỗi <code>##</code> là một đoạn ·{" "}
            <code>{t`![chú thích](https://…)`}</code> làm ảnh minh hoạ · đoạn{" "}
            <code>{t`## Câu hỏi thường gặp`}</code> với các <code>###</code>{" "}
            thành FAQ. Chủ đề / vùng miền / nguồn gốc chọn ở form bên dưới.
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary hover:underline">
            <IconUpload className="h-4 w-4" /> {t`Chọn file .md…`}
            <input
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setMdText(await f.text());
                e.target.value = "";
              }}
            />
          </label>
          <Textarea
            value={mdText}
            onChange={(e) => setMdText(e.target.value)}
            rows={10}
            placeholder={
              "# Lễ nhập trạch (về nhà mới)\n\nNghi lễ báo cáo tổ tiên khi về nhà mới.\n\n## Ý nghĩa\n…\n\n## Chuẩn bị / lễ vật\n![Mâm cúng](https://…)\n…"
            }
            className="font-mono text-sm leading-relaxed resize-y"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMdOpen(false);
                setMdText("");
              }}
            >
              {t`Đóng`}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!mdText.trim()}
              onClick={applyMarkdown}
            >
              <IconCheck className="h-4 w-4 mr-1" /> {t`Điền vào form`}
            </Button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!save.isPending) save.mutate();
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="c-title" required>{t`Tiêu đề`}</Label>
          <Input
            id="c-title"
            icon={<IconScroll />}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder={t`vd: Lễ nhập trạch (về nhà mới)`}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-cat">{t`Chủ đề`}</Label>
            <Select
              id="c-cat"
              icon={<IconTag />}
              value={category}
              onChange={(e) => setCategory(e.target.value as CustomCategory)}
            >
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {CUSTOM_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-status">{t`Trạng thái`}</Label>
            <Select
              id="c-status"
              icon={<IconCheck />}
              value={status}
              onChange={(e) => setStatus(e.target.value as CustomStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t`Vùng miền`}</Label>
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

        <div className="space-y-2">
          <Label htmlFor="c-aliases">{t`Tên gọi khác (cách nhau bởi dấu phẩy)`}</Label>
          <Input
            id="c-aliases"
            icon={<IconTag />}
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder={t`nhà mới, chuyển nhà, tân gia`}
          />
        </div>

        <Textarea
          id="c-short"
          label={t`Mô tả ngắn`}
          icon={<IconScroll />}
          value={shortDesc}
          onChange={(e) => setShortDesc(e.target.value)}
          rows={2}
          maxLength={300}
          className="min-h-0 leading-relaxed resize-y"
        />

        <div className="space-y-2">
          <Label>{t`Nguồn gốc (chọn nhiều)`}</Label>
          <div className="flex flex-wrap gap-2">
            {ORIGINS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => toggleOrigin(o)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  origins.includes(o)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:border-primary"
                }`}
              >
                {CUSTOM_ORIGIN_LABEL[o]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-mand">{t`Mức bắt buộc`}</Label>
            <Select
              id="c-mand"
              icon={<IconShield />}
              value={mandatory}
              onChange={(e) =>
                setMandatory(e.target.value as CustomMandatory | "")
              }
            >
              <option value="">—</option>
              {MANDATORIES.map((m) => (
                <option key={m} value={m}>
                  {CUSTOM_MANDATORY_LABEL[m]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-scope">{t`Phạm vi`}</Label>
            <Select
              id="c-scope"
              icon={<IconGlobe />}
              value={scope}
              onChange={(e) => setScope(e.target.value as CustomScope | "")}
            >
              <option value="">—</option>
              {SCOPES.map((s) => (
                <option key={s} value={s}>
                  {CUSTOM_SCOPE_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="c-rel">{t`Độ tin cậy (1–5)`}</Label>
            <Input
              id="c-rel"
              icon={<IconShield />}
              type="number"
              min={1}
              max={5}
              value={reliability}
              onChange={(e) => setReliability(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-lunar">{t`Tháng âm lịch (1–12)`}</Label>
            <Input
              id="c-lunar"
              icon={<IconCalendar />}
              type="number"
              min={1}
              max={12}
              value={lunarMonth}
              onChange={(e) => setLunarMonth(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-timing">{t`Thời điểm (mô tả)`}</Label>
            <Input
              id="c-timing"
              icon={<IconClock />}
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
              placeholder={t`vd: 23 tháng Chạp`}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-applic">{t`Đối tượng áp dụng`}</Label>
          <Input
            id="c-applic"
            icon={<IconUsers />}
            value={applicableTo}
            onChange={(e) => setApplicableTo(e.target.value)}
            placeholder={t`vd: gia đình chuyển đến nhà mới`}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-cover">{t`Link ảnh bìa (https)`}</Label>
          <Input
            id="c-cover"
            icon={<IconCamera />}
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        {/* Các đoạn nội dung */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <IconBook className="h-4 w-4 text-muted-foreground" />
            {t`Nội dung (chia đoạn có tiêu đề)`}
          </Label>
          <p className="text-sm text-muted-foreground">
            <Trans>
              <Trans>
                <Trans>
                  Gợi ý các đoạn: Ý nghĩa · Chuẩn bị / lễ vật · Trình tự thực
                  hiện · Nên / kiêng kỵ · Biến thể vùng miền.
                </Trans>
              </Trans>
            </Trans>
          </p>
          {sections.map((sec, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card shadow-sm p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 shrink-0">
                  {i + 1}.
                </span>
                <Input
                  icon={<IconTag />}
                  value={sec.heading}
                  onChange={(e) =>
                    setSections((p) =>
                      p.map((s, j) =>
                        j === i ? { ...s, heading: e.target.value } : s,
                      ),
                    )
                  }
                  placeholder={t`Tiêu đề đoạn`}
                  maxLength={200}
                  className="flex-1"
                />
                <button
                  type="button"
                  aria-label={t`Lên`}
                  disabled={i === 0}
                  onClick={() =>
                    setSections((p) => {
                      const a = [...p];
                      [a[i - 1], a[i]] = [a[i], a[i - 1]];
                      return a;
                    })
                  }
                  className="px-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={t`Xuống`}
                  disabled={i === sections.length - 1}
                  onClick={() =>
                    setSections((p) => {
                      const a = [...p];
                      [a[i + 1], a[i]] = [a[i], a[i + 1]];
                      return a;
                    })
                  }
                  className="px-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  ▼
                </button>
                <button
                  type="button"
                  aria-label={t`Xoá đoạn`}
                  onClick={() =>
                    setSections((p) => p.filter((_, j) => j !== i))
                  }
                  className="px-1.5 text-muted-foreground hover:text-destructive"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={sec.body}
                onChange={(e) =>
                  setSections((p) =>
                    p.map((s, j) =>
                      j === i ? { ...s, body: e.target.value } : s,
                    ),
                  )
                }
                rows={5}
                placeholder={t`Nội dung đoạn này…`}
                className="leading-relaxed"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  icon={<IconCamera />}
                  value={sec.image_url ?? ""}
                  onChange={(e) =>
                    setSections((p) =>
                      p.map((s, j) =>
                        j === i ? { ...s, image_url: e.target.value } : s,
                      ),
                    )
                  }
                  placeholder={t`Ảnh minh hoạ (https://…, tuỳ chọn)`}
                />
                <Input
                  icon={<IconScroll />}
                  value={sec.image_caption ?? ""}
                  onChange={(e) =>
                    setSections((p) =>
                      p.map((s, j) =>
                        j === i ? { ...s, image_caption: e.target.value } : s,
                      ),
                    )
                  }
                  placeholder={t`Chú thích ảnh (tuỳ chọn)`}
                  maxLength={200}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSections((p) => [...p, { heading: "", body: "" }])
            }
          >
            <IconPlus className="h-4 w-4 mr-1" /> {t`Thêm đoạn`}
          </Button>
        </div>

        {/* Câu hỏi thường gặp (tuỳ chọn) */}
        <div className="space-y-2">
          <Label className="block">{t`Câu hỏi thường gặp (tuỳ chọn)`}</Label>
          <p className="text-sm text-muted-foreground">
            {t`Mỗi mục gồm 1 câu hỏi và câu trả lời ngắn gọn.`}
          </p>
          {faq.map((item, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card shadow-sm p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-6 shrink-0">
                  {i + 1}.
                </span>
                <Input
                  icon={<IconHelp />}
                  value={item.q}
                  onChange={(e) =>
                    setFaq((p) =>
                      p.map((f, j) =>
                        j === i ? { ...f, q: e.target.value } : f,
                      ),
                    )
                  }
                  placeholder={t`Câu hỏi`}
                  maxLength={300}
                  className="flex-1"
                />
                <button
                  type="button"
                  aria-label={t`Xoá câu hỏi`}
                  onClick={() => setFaq((p) => p.filter((_, j) => j !== i))}
                  className="px-1.5 text-muted-foreground hover:text-destructive"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={item.a}
                onChange={(e) =>
                  setFaq((p) =>
                    p.map((f, j) =>
                      j === i ? { ...f, a: e.target.value } : f,
                    ),
                  )
                }
                rows={3}
                placeholder={t`Câu trả lời…`}
                className="leading-relaxed"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFaq((p) => [...p, { q: "", a: "" }])}
          >
            <IconPlus className="h-4 w-4 mr-1" /> {t`Thêm câu hỏi`}
          </Button>
        </div>

        {/* Bài liên quan */}
        <div className="space-y-2">
          <Label className="block">{t`Bài liên quan (tuỳ chọn)`}</Label>
          {relatedChosen.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {relatedChosen.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-sm"
                >
                  {r.title}
                  <button
                    type="button"
                    aria-label={t`Bỏ liên kết`}
                    onClick={() =>
                      setRelatedIds((p) => p.filter((x) => x !== r.id))
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Input
            icon={<IconSearch />}
            value={relatedQ}
            onChange={(e) => setRelatedQ(e.target.value)}
            placeholder={t`Gõ tên bài để tìm & thêm liên kết…`}
          />
          {relatedMatches.length > 0 && (
            <ul className="rounded-xl border bg-card shadow-sm divide-y">
              {relatedMatches.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setRelatedIds((p) => [...p, r.id]);
                      setRelatedQ("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/10"
                  >
                    <IconPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {r.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-sources">{t`Nguồn tham khảo`}</Label>
          <Input
            id="c-sources"
            icon={<IconLink />}
            value={sources}
            onChange={(e) => setSources(e.target.value)}
          />
        </div>

        {err && <p className="text-sm text-destructive">{err}</p>}

        <FormActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => (embedded ? embedded.onCancel() : navigate(-1))}
          >{t`Hủy`}</Button>
          <Button type="submit" disabled={save.isPending || !title.trim()}>
            <IconCheck className="h-4 w-4 mr-1.5" />
            {save.isPending ? t`Đang lưu…` : t`Lưu`}
          </Button>
        </FormActions>
      </form>
    </>
  );
  return embedded ? (
    <div className="space-y-3">{content}</div>
  ) : (
    <Shell>{content}</Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        {children}
      </main>
    </div>
  );
}
