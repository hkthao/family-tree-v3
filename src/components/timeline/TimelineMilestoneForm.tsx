import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { FilterableSelect } from "@/components/FilterableSelect";
import { FormGroup } from "@/components/FormGroup";
import {
  PhotoContent,
} from "@/components/timeline/TimelinePoster";
import { SCENES, TimelineScene } from "@/components/timeline/TimelineScene";
import { Select } from "@/components/ui/select";
import {
  bulletsToText,
  contextToColumns,
  defaultContext,
  eraIdForYear,
  MAX_BULLETS,
  MAX_CONTEXT_BODY,
  MAX_CONTEXT_TITLE,
  textToBullets,
} from "@/lib/timeline/context";
import { libRef, normalizeImageUrl, parseImageRef } from "@/lib/timeline/images";
import {
  creditText,
  findLibraryPhotoByUrl,
  LIBRARY_PHOTOS,
  libraryPhotoPage,
  libraryPhotoUrl,
  photosForEra,
} from "@/lib/timeline/photoLibrary";
import { IconCheck, IconSparkles, IconTrash, IconX } from "@/components/icons";
import type { EmbeddedForm } from "@/components/panel/embedded";
import {
  TIMELINE_ICON_KEYS,
  TimelineIcon,
  timelineIconLabel,
} from "@/components/timeline/TimelineIcon";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClanTimeline } from "@/hooks/useClanTimeline";
import { yearToCanChi } from "@/lib/canChi";
import { getPerson } from "@/lib/queries/persons";
import { queryKeys } from "@/lib/queries/keys";
import {
  createMilestone,
  deleteMilestones,
  updateMilestone,
} from "@/lib/queries/timeline";
import {
  suggestionSourceLabel,
  type TimelineSuggestion,
} from "@/lib/timeline/suggestions";
import { getEraCards, type TimelineIconKey } from "@/lib/timeline/eras";
import { getMilestoneTemplates } from "@/lib/timeline/templates";
import {
  DEFAULT_MILESTONE_ICON,
  type Milestone,
} from "@/lib/timeline/mergeTimeline";

import { t } from "@lingui/core/macro";

/**
 * Thêm / sửa / xoá MỘT mốc của dòng thời gian, trong ngăn kéo. `embedded.id` = id hàng; trống = thêm mới.
 * Mốc là dữ liệu riêng của dòng thời gian — sửa ở đây không đụng tới cây gia phả.
 */
export function TimelineMilestoneForm({
  embedded,
  personId,
}: {
  embedded: EmbeddedForm;
  /** Mở từ trang người trong Danh bạ: mốc thuộc người này (không hiện trên poster dòng họ trừ khi bật). */
  personId?: string | null;
}) {
  const { clan, userId, persons, milestones, suggestions, canEdit, isLoading } =
    useClanTimeline({ personId });
  const m = embedded.id
    ? milestones.find((x) => x.rowId === embedded.id)
    : undefined;

  if (isLoading) {
    return <p className="py-6 text-muted-foreground">{t`Đang tải…`}</p>;
  }
  if (!canEdit) {
    return (
      <Alert>
        <AlertDescription>
          {t`Chỉ người quản trị hoặc biên tập viên mới sửa được dòng thời gian.`}
        </AlertDescription>
      </Alert>
    );
  }
  if (embedded.id && !m) {
    return (
      <Alert>
        <AlertDescription>{t`Không tìm thấy mốc này (có thể đã bị xoá).`}</AlertDescription>
      </Alert>
    );
  }
  return <Inner
      key={m?.key ?? "new"}
      m={m}
      clanId={clan.id}
      userId={userId}
      suggestions={suggestions}
      siblings={milestones}
      persons={persons}
      scopePersonId={personId ?? null}
      embedded={embedded}
    />;
}

function Inner({
  m,
  clanId,
  userId,
  suggestions,
  siblings,
  persons,
  scopePersonId,
  embedded,
}: {
  m?: Milestone;
  /** Người trong cây (chỉ có khi mở từ poster dòng họ) — để chọn "Gắn với người". */
  persons: { id: string; full_name: string; generation: number | null; birth_date: string | null }[];
  /** Người của trang đang mở (mốc mới sẽ thuộc người này). */
  scopePersonId: string | null;
  clanId: string;
  userId: string;
  suggestions: TimelineSuggestion[];
  /** Tất cả mốc hiện có — để gợi ý số thứ tự kế tiếp trong cùng năm. */
  siblings: Milestone[];
  embedded: EmbeddedForm;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  // Mốc thuộc người nào: mốc đã lưu giữ người của nó; mốc mới theo trang đang mở; hoặc chọn ở ô "Gắn với người".
  const [attachId, setAttachId] = useState<string>(m?.personId ?? scopePersonId ?? "");
  // Hiện trên poster dòng họ: mốc dòng họ mặc định có; mốc chi tiết của người (tạo từ trang người) mặc định không.
  const [onClan, setOnClan] = useState<boolean>(m ? m.onClan : !scopePersonId);
  const personScoped = !!(m?.personId ?? scopePersonId);
  const { data: attachedPerson } = useQuery({
    queryKey: queryKeys.person(attachId, userId),
    queryFn: () => getPerson(attachId),
    enabled: personScoped && !!attachId,
  });
  const [year, setYear] = useState(m ? String(m.year) : "");
  const [title, setTitle] = useState(m?.title ?? "");
  const [body, setBody] = useState(m?.body ?? "");
  const [icon, setIcon] = useState<TimelineIconKey>(m?.iconKey ?? DEFAULT_MILESTONE_ICON);
  // Hình riêng: thư viện dựng sẵn / link ngoài / chỉ biểu tượng.
  const initRef = parseImageRef(m?.imageUrl ?? null);
  const initPhoto = initRef?.kind === "url" ? findLibraryPhotoByUrl(initRef.url) : null;
  const [imgMode, setImgMode] = useState<"lib" | "photo" | "link" | "icon">(
    initRef?.kind === "lib"
      ? "lib"
      : initPhoto
        ? "photo"
        : initRef?.kind === "url"
          ? "link"
          : "icon",
  );
  // Ảnh tư liệu (link Wikimedia Commons, không lưu file): chọn thời kỳ rồi chọn ảnh.
  const [photoId, setPhotoId] = useState(initPhoto?.id ?? "");
  const [photoEra, setPhotoEra] = useState<string | null>(initPhoto?.eraId ?? null);
  const [scene, setScene] = useState(initRef?.kind === "lib" ? initRef.id : "");
  const [link, setLink] = useState(initRef?.kind === "url" && !initPhoto ? initRef.url : "");
  // Bối cảnh thời đại: null = chưa chạm → hiện mặc định theo năm đang nhập; có giá trị = bản người dùng đã sửa
  // (kể cả rỗng = ẩn thẻ). Mốc đã lưu khởi tạo từ bối cảnh đang hiển thị của nó.
  const [ctx, setCtx] = useState<{ title: string; text: string } | null>(() => {
    // Mốc mới tạo từ trang người: thẻ bối cảnh ẩn mặc định (mốc cuộc đời không cần thẻ thời đại cho từng dòng).
    if (!m) return scopePersonId ? { title: "", text: "" } : null;
    const def = defaultContext(m.year);
    const cur = m.context;
    const sameAsDefault =
      !!cur &&
      !!def &&
      cur.title === def.title &&
      bulletsToText(cur.bullets) === bulletsToText(def.bullets);
    if (sameAsDefault) return null; // đang theo mặc định → tiếp tục theo năm
    return { title: cur?.title ?? "", text: bulletsToText(cur?.bullets ?? []) };
  });
  // Mẫu bối cảnh: các thời đại trong thư viện; chọn thì điền tiêu đề + các ý (vẫn sửa tự do được).
  const eraOptions = useMemo(
    () =>
      getEraCards().map((e) => ({
        value: e.id,
        label: `${e.title} (${e.from}–${e.to})`,
        title: e.title,
        bullets: e.bullets,
      })),
    [],
  );
  const applyEra = (id: string) => {
    const e = eraOptions.find((o) => o.value === id);
    if (e) setCtx({ title: e.title, text: bulletsToText(e.bullets) });
  };
  const yearNum = Number(year);
  const ctxDefault = defaultContext(yearNum);
  const ctxTitle = ctx ? ctx.title : (ctxDefault?.title ?? "");
  const ctxText = ctx ? ctx.text : bulletsToText(ctxDefault?.bullets ?? []);
  // Số thứ tự trong năm: chưa chạm → tự gợi ý số kế tiếp của năm đang nhập (mốc đã lưu giữ số của nó).
  const [orderInput, setOrderInput] = useState<string | null>(
    m ? String(m.sortOrder) : null,
  );
  const sameYear = siblings.filter((x) => x.year === yearNum && x.rowId !== m?.rowId);
  const nextOrder = sameYear.length === 0 ? 1 : Math.max(...sameYear.map((x) => x.sortOrder)) + 1;
  const orderValue = orderInput ?? String(nextOrder);
  // Ảnh tư liệu: thời kỳ đang xem (mặc định theo năm của mốc) và ảnh đã chọn.
  const activeEra = photoEra ?? eraIdForYear(yearNum) ?? "";
  const eraPhotos = photosForEra(activeEra);
  const selectedPhoto = LIBRARY_PHOTOS.find((x) => x.id === photoId) ?? null;
  const [err, setErr] = useState<string | null>(null);
  // Chọn từ mẫu (chỉ khi thêm mới): tự điền tiêu đề + mô tả + hình, người dùng chỉ cần nhập năm.
  const templates = useMemo(() => getMilestoneTemplates(), []);
  const [tpl, setTpl] = useState("");
  // Chọn từ gia phả (gợi ý dựng từ cây): điền năm + chữ + hình, và nhớ nguồn để không gợi ý lại.
  const [fromTree, setFromTree] = useState<TimelineSuggestion | null>(null);
  const sortedSuggestions = useMemo(
    () => [...suggestions].sort((a, b) => a.year - b.year),
    [suggestions],
  );
  const applySuggestion = (key: string) => {
    const c = sortedSuggestions.find((x) => x.key === key);
    if (!c) return;
    setFromTree(c);
    setTpl("");
    setYear(String(c.year));
    setTitle(c.title);
    setBody(c.body);
    setIcon(c.iconKey);
  };
  const applyTemplate = (id: string) => {
    setTpl(id);
    setFromTree(null);
    const x = templates.find((tp) => tp.id === id);
    if (!x) return;
    setTitle(x.title);
    setBody(x.body);
    setIcon(x.iconKey);
    // Mẫu nào có cảnh trong thư viện thì chọn luôn cảnh đó.
    if (SCENES[x.id]) {
      setScene(x.id);
      setImgMode("lib");
    }
  };

  const done = () => {
    qc.invalidateQueries({ queryKey: queryKeys.timelineRows(clanId, userId) });
    embedded.onDone();
  };
  const fail = (e: unknown) =>
    toast.error(t`Không lưu được`, { description: (e as Error).message });

  const save = useMutation({
    mutationFn: async () => {
      const input = {
        year: Number(year),
        sort_order: Math.min(999, Math.max(0, Math.floor(Number(orderValue)) || 0)),
        title: title.trim(),
        body: body.trim() || null,
        icon_key: icon,
        ...contextToColumns(Number(year), ctxTitle, ctxText),
        person_id: attachId || null,
        on_clan: onClan,
        era: /^\d{3,4}$/.test(year) ? yearToCanChi(Number(year)) : null,
        image_url:
          imgMode === "lib" && scene
            ? libRef(scene)
            : imgMode === "photo" && selectedPhoto
              ? libraryPhotoUrl(selectedPhoto)
              : imgMode === "link" && link.trim()
              ? link.trim()
              : null,
      };
      if (m) await updateMilestone(m.rowId, input);
      else
        await createMilestone(clanId, {
          ...input,
          photo_person_id: fromTree?.photoPersonId ?? null,
          source_key: fromTree?.key ?? null,
        });
    },
    onSuccess: () => {
      toast.success(m ? t`Đã lưu` : t`Đã thêm mốc`);
      done();
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (m) await deleteMilestones([m.rowId]);
    },
    onSuccess: () => {
      toast.success(t`Đã xoá mốc`);
      done();
    },
    onError: fail,
  });

  async function onRemove() {
    const ok = await confirm({
      title: t`Xoá mốc "${m?.title ?? ""}"?`,
      description: m?.fromTree
        ? t`Mốc này được chọn từ gia phả nên sẽ hiện lại trong phần gợi ý.`
        : undefined,
      confirmLabel: t`Xoá`,
      destructive: true,
    });
    if (ok) remove.mutate();
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        const y = Number(year);
        if (!Number.isInteger(y) || y < 1 || y > 9999) {
          setErr(t`Hãy nhập năm hợp lệ, ví dụ 1975.`);
          return;
        }
        if (!title.trim()) {
          setErr(t`Hãy nhập tiêu đề cho mốc.`);
          return;
        }
        if (onClan && (!ctxTitle.trim() || textToBullets(ctxText).length === 0)) {
          setErr(t`Hãy nhập bối cảnh thời đại (tiêu đề và ít nhất một ý) — chọn một mẫu thời đại cho nhanh.`);
          return;
        }
        if (imgMode === "link" && link.trim() && !normalizeImageUrl(link).ok) {
          setErr(t`Link ảnh chưa đúng: cần bắt đầu bằng https:// và không có dấu cách.`);
          return;
        }
        save.mutate();
      }}
    >
      {err && (
        <Alert variant="destructive">
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      )}

      {/* 1. Bối cảnh thời đại — BẮT BUỘC để thẻ bối cảnh trên poster luôn có, không bể bố cục */}
      <FormGroup
        step={1}
        title={t`Bối cảnh thời đại`}
        desc={t`Thẻ ghi chú bên cạnh mốc trên poster. Chọn một thời đại để điền sẵn, rồi sửa tự do.`}
        collapsible
        defaultOpen={onClan}
        badge={onClan ? "required" : "optional"}
      >
        <div className="space-y-2">
        <div className="space-y-2">
          <FilterableSelect
            id="tl-ctx-template"
            icon={<IconSparkles />}
            value={eraOptions.find((o) => o.title === ctxTitle)?.value ?? ""}
            onChange={applyEra}
            options={eraOptions.map(({ value, label }) => ({ value, label }))}
            emptyLabel={t`Chọn từ mẫu thời đại để điền sẵn`}
            filterPlaceholder={t`Gõ để tìm thời đại`}
            filterLabel={t`Tìm mẫu bối cảnh thời đại`}
            className="h-12 text-base"
          />
          <Input
            id="tl-ctx-title"
            aria-required
            value={ctxTitle}
            onChange={(e) => setCtx({ title: e.target.value, text: ctxText })}
            placeholder={t`vd: Đất nước chia hai miền`}
            maxLength={MAX_CONTEXT_TITLE}
            className="h-12 text-base"
          />
          <Textarea
            id="tl-ctx-body"
            aria-label={t`Các ý của bối cảnh`}
            value={ctxText}
            onChange={(e) => setCtx({ title: ctxTitle, text: e.target.value })}
            rows={4}
            maxLength={MAX_CONTEXT_BODY}
            placeholder={t`Mỗi dòng một ý, tối đa ${MAX_BULLETS} ý (cần ít nhất 1). vd: Chia cắt ở vĩ tuyến 17`}
            className="text-base"
          />
        </div>

        </div>
      </FormGroup>

      {/* 2. Mốc là gì và xảy ra năm nào */}
      <FormGroup
        step={2}
        title={t`Thông tin mốc`}
        desc={t`Chọn một mẫu có sẵn hoặc tự nhập. Chỉ cần năm và tiêu đề là đủ.`}
        collapsible
        defaultOpen
        badge="required"
      >
        <div className="space-y-5">
        {!m && sortedSuggestions.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="tl-from-tree">{t`Chọn từ dữ liệu dòng họ`}</Label>
            <FilterableSelect
              id="tl-from-tree"
              icon={<IconSparkles />}
              value={fromTree?.key ?? ""}
              onChange={applySuggestion}
              options={sortedSuggestions.map((c) => ({
                value: c.key,
                label: `${c.year} · ${c.title} — ${suggestionSourceLabel(c.source)}`,
              }))}
              emptyLabel={t`Chọn gia phả, sự kiện, mộ phần hoặc di sản (không bắt buộc)`}
              filterPlaceholder={t`Gõ năm, tên hoặc nguồn (sự kiện, mộ, di sản…) để tìm`}
              filterLabel={t`Tìm trong dữ liệu dòng họ`}
              className="h-12 text-base"
            />
            <p className="text-sm text-muted-foreground">
              {t`Lấy từ gia phả, sự kiện, mộ phần, di sản của dòng họ. Chọn xong thì sao chép vào đây — sau đó bạn sửa tự do, dữ liệu gốc đổi cũng không ảnh hưởng.`}
            </p>
          </div>
        )}

        {!m && (
          <div className="space-y-2">
            <Label htmlFor="tl-template">{t`Chọn từ mẫu có sẵn`}</Label>
            <FilterableSelect
              id="tl-template"
              icon={<IconSparkles />}
              value={tpl}
              onChange={applyTemplate}
              options={templates.map((x) => ({ value: x.id, label: x.title }))}
              emptyLabel={t`Chọn một mẫu để điền sẵn (không bắt buộc)`}
              filterPlaceholder={t`Gõ để tìm mẫu`}
              filterLabel={t`Tìm mẫu mốc`}
              className="h-12 text-base"
            />
            <p className="text-sm text-muted-foreground">
              {t`Chọn mẫu rồi chỉ cần nhập năm. Bạn vẫn sửa được chữ và hình bên dưới.`}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-start gap-4">
          <div className="space-y-2">
            <Label htmlFor="tl-year" required>{t`Năm`}</Label>
            <Input
              id="tl-year"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={t`vd: 1975`}
              className="h-12 w-40 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tl-order">{t`Thứ tự trong năm`}</Label>
            <Input
              id="tl-order"
              inputMode="numeric"
              value={orderValue}
              onChange={(e) => setOrderInput(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className="h-12 w-32 text-base"
            />
          </div>
          {/^\d{3,4}$/.test(year) && (
            <p className="basis-full text-sm font-medium text-muted-foreground">
              {t`Năm`} {yearToCanChi(Number(year))}
            </p>
          )}
          <p className="basis-full text-sm text-muted-foreground">
            {sameYear.length > 0
              ? t`Năm ${yearNum} đã có ${sameYear.length} mốc khác. Số nhỏ hiện trước, đổi số để sắp xếp lại.`
              : t`Nếu một năm có nhiều mốc, số nhỏ hiện trước.`}
          </p>
        </div>

        {/* Gắn theo người: mốc cuộc đời (từ trang người) hoặc mốc dòng họ nói về một người */}
        {personScoped ? (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-base">
              {t`Mốc của`}{" "}
              <span className="font-semibold">
                {attachedPerson?.full_name ?? "…"}
              </span>
            </p>
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-primary"
                checked={onClan}
                onChange={(e) => {
                  setOnClan(e.target.checked);
                  // Bật lên poster dòng họ: trả bối cảnh về mặc định theo năm nếu đang để trống.
                  if (e.target.checked && ctx && !ctx.title.trim() && !ctx.text.trim()) setCtx(null);
                }}
              />
              <span>
                <span className="block text-base font-medium">
                  {t`Hiện trên dòng thời gian dòng họ`}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {t`Dòng họ chỉ cần tổng quan nên mốc chi tiết của một người mặc định chỉ hiện ở trang người đó.`}
                </span>
              </span>
            </label>
          </div>
        ) : (
          persons.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="tl-person">{t`Gắn với người`}</Label>
              <FilterableSelect
                id="tl-person"
                icon={<IconSparkles />}
                value={attachId}
                onChange={setAttachId}
                options={persons.map((p) => ({
                  value: p.id,
                  label: [
                    p.full_name,
                    p.generation !== null ? t`Đời ${p.generation}` : null,
                    p.birth_date ? t`sinh ${p.birth_date.slice(0, 4)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }))}
                emptyLabel={t`Không gắn với ai (mốc chung của dòng họ)`}
                filterPlaceholder={t`Gõ tên để tìm (không cần dấu)`}
                filterLabel={t`Tìm người để gắn mốc`}
                className="h-12 text-base"
              />
              <p className="text-sm text-muted-foreground">
                {t`Mốc gắn với người sẽ hiện thêm ở trang của người đó trong Danh bạ.`}
              </p>
            </div>
          )
        )}

        <div className="space-y-2">
          <Label htmlFor="tl-title" required>{t`Tiêu đề`}</Label>
          <Input
            id="tl-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t`vd: Cả nhà về quê dựng từ đường`}
            maxLength={200}
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tl-body">{t`Mô tả ngắn`}</Label>
          <Textarea
            id="tl-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={t`vd: Năm ấy cả nhà góp công góp của dựng lại từ đường, con cháu khắp nơi về dự lễ.`}
            className="text-base"
          />
        </div>

        </div>
      </FormGroup>

      {/* 3. Hình minh hoạ hiện trên poster */}
      <FormGroup
        step={3}
        title={t`Hình minh hoạ`}
        desc={t`Chọn hình từ thư viện, dán link ảnh hoặc dùng biểu tượng.`}
        collapsible
        defaultOpen
      >
        <div className="space-y-3">
        <div className="space-y-3">
          <Select
            id="tl-img-mode"
            icon={<IconSparkles />}
            value={imgMode}
            onChange={(e) => setImgMode(e.target.value as "lib" | "photo" | "link" | "icon")}
            aria-label={t`Nguồn hình`}
          >
            <option value="lib">{t`Thư viện hình (tranh minh hoạ)`}</option>
          <option value="photo">{t`Ảnh tư liệu theo thời kỳ`}</option>
            <option value="link">{t`Link ảnh`}</option>
            <option value="icon">{t`Biểu tượng`}</option>
          </Select>

          {imgMode === "lib" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {templates
                .filter((x) => SCENES[x.id])
                .map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={scene === x.id}
                    onClick={() => setScene(x.id)}
                    className={`overflow-hidden rounded-lg border text-left transition-colors ${
                      scene === x.id
                        ? "border-primary ring-2 ring-primary"
                        : "hover:border-primary/60"
                    }`}
                  >
                    <div className="relative aspect-[4/3] w-full">
                      <TimelineScene id={x.id} className="absolute inset-0 h-full w-full" />
                    </div>
                    <p className="px-2 py-1.5 text-sm leading-snug">{x.title}</p>
                  </button>
                ))}
            </div>
          )}

          {imgMode === "photo" && (
          <div className="space-y-3">
            <FilterableSelect
              id="tl-photo-era"
              icon={<IconSparkles />}
              value={activeEra}
              onChange={(v) => setPhotoEra(v || null)}
              options={eraOptions.map(({ value, label }) => ({ value, label }))}
              emptyLabel={t`Chọn thời kỳ`}
              filterPlaceholder={t`Gõ để tìm thời kỳ`}
              filterLabel={t`Tìm thời kỳ của ảnh`}
              required
              className="h-12 text-base"
            />
            {eraPhotos.length === 0 ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                {t`Chưa có ảnh tư liệu cho thời kỳ này. Hãy dán link ảnh, chọn thời kỳ khác hoặc dùng thư viện hình.`}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {eraPhotos.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    aria-pressed={photoId === x.id}
                    onClick={() => setPhotoId(x.id)}
                    className={`overflow-hidden rounded-lg border text-left transition-colors ${
                      photoId === x.id ? "border-primary ring-2 ring-primary" : "hover:border-primary/60"
                    }`}
                  >
                    <div className="aspect-[4/3] w-full bg-muted/40">
                      <img
                        src={libraryPhotoUrl(x, 400)}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="px-2 py-1.5 text-sm leading-snug">{x.caption}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedPhoto && (
              <p className="text-sm text-muted-foreground">
                {t`Ảnh:`} {creditText(selectedPhoto)} ·{" "}
                <a
                  href={libraryPhotoPage(selectedPhoto)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {t`Xem nguồn`}
                </a>
              </p>
            )}
          </div>
        )}

        {imgMode === "link" && (
            <div className="space-y-2">
              <Input
                id="tl-link"
                inputMode="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                maxLength={500}
                className="h-12 text-base"
              />
              <p className="text-sm text-muted-foreground">
                {t`Dán đường dẫn ảnh (bắt đầu bằng https://). Ảnh đặt ở trang khác có thể bị ẩn đi nếu họ xoá hoặc không cho dùng — nên chọn ảnh bạn có quyền dùng.`}
              </p>
              {link.trim() && normalizeImageUrl(link).ok && (
                <div className="relative aspect-[4/3] w-full max-w-xs overflow-hidden rounded-lg border bg-muted/40">
                  <PhotoContent
                    key={link}
                    c={{ imageUrl: link.trim(), iconKey: icon }}
                  />
                </div>
              )}
            </div>
          )}

          {imgMode === "icon" && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {TIMELINE_ICON_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={icon === k}
                  onClick={() => setIcon(k)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-sm transition-colors ${
                    icon === k ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/50"
                  }`}
                >
                  <TimelineIcon name={k} className="h-8 w-8" />
                  {timelineIconLabel(k)}
                </button>
              ))}
            </div>
          )}
        </div>

        </div>
      </FormGroup>

      <FormActions>
        {m && (
          <Button type="button" variant="destructive-outline" disabled={remove.isPending} onClick={onRemove}>
            <IconTrash className="mr-1.5 h-4 w-4" />
            {t`Xoá mốc`}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={embedded.onCancel}>
          <IconX className="mr-1.5 h-4 w-4" /> {t`Hủy`}
        </Button>
        <Button type="submit" disabled={save.isPending}>
          <IconCheck className="mr-1.5 h-4 w-4" />
          {save.isPending ? t`Đang lưu…` : t`Lưu`}
        </Button>
      </FormActions>
    </form>
  );
}
