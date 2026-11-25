import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUrlState } from "@/hooks/useUrlState";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Fab } from "@/components/Fab";
import { usePanel } from "@/components/panel/usePanel";
import { useTimelineActions } from "@/hooks/useTimelineActions";
import { getPerson } from "@/lib/queries/persons";
import { bioTimelineRows, yearOf } from "@/lib/personTimeline";
import { createMilestones } from "@/lib/queries/timeline";
import { splitTitleBody, suggestIcon } from "@/lib/timeline/titleBody";
import { queryKeys } from "@/lib/queries/keys";
import { FilterableSelect } from "@/components/FilterableSelect";
import { IconCalendar, IconDownload, IconSliders, IconSparkles } from "@/components/icons";
import { FilterDrawer } from "@/components/FilterDrawer";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { TimelinePoster } from "@/components/timeline/TimelinePoster";
import { ActionArea, Button } from "@/components/ui/button";
import { useClanTimeline } from "@/hooks/useClanTimeline";
import { getSignedPhotoUrlMap, PHOTO_URL_STALE_MS } from "@/lib/photoUpload";
import { getPosterThemes } from "@/lib/timeline/themes";

import { t } from "@lingui/core/macro";

/**
 * Trang chi tiết MỘT dòng thời gian = poster của cả dòng họ (`/timeline/clan`) hoặc của một thành viên
 * (`/timeline/p/:personId`). Cùng một trang, cùng poster; chỉ khác dữ liệu (mốc `on_clan` hay mốc `person_id`).
 * Người sửa được: bấm vào mốc để sửa, nút nổi để thêm mốc (ngăn kéo bên phải như các màn khác).
 */
export default function TimelineDetail() {
  const { personId } = useParams<{ personId?: string }>();
  const { clan, userId, persons, milestones, suggestions, isLoading, canEdit } = useClanTimeline({ personId });
  const { open: openPanel } = usePanel();
  const { addHighlights } = useTimelineActions(clan.id, userId, suggestions);
  const { data: owner } = useQuery({
    queryKey: queryKeys.person(personId ?? "", userId),
    queryFn: () => getPerson(personId!),
    enabled: !!personId,
  });
  const subject = personId ? (owner?.full_name ?? "") : clan.name;

  // Dòng họ lịch sử: tiểu sử có sẵn các ý "Năm …" → cho lưu thành mốc thật (sửa / xoá được như mốc khác).
  const qc = useQueryClient();
  const bioRows = useMemo(
    () =>
      personId && owner
        ? bioTimelineRows(owner.bio, yearOf(owner.birth_date), yearOf(owner.death_date))
        : [],
    [personId, owner],
  );
  const importBio = useMutation({
    mutationFn: () =>
      createMilestones(
        clan.id,
        bioRows.map((r, i) => ({
          person_id: personId,
          on_clan: false,
          era: r.era,
          year: r.year,
          sort_order: Math.min(999, i),
          ...splitTitleBody(r.body),
          icon_key: suggestIcon(r.body),
          // Bối cảnh thời đại mặc định theo năm (null = tự lấy) để poster của người hiển thị đủ layout như poster dòng họ.
          context_title: null,
          context_body: null,
          source_key: `bio:${personId}:${i}`,
        })),
      ),
    onSuccess: () => {
      toast.success(t`Đã thêm các mốc từ tiểu sử`);
      qc.invalidateQueries({ queryKey: queryKeys.timelineRows(clan.id, userId) });
    },
    onError: (e) => toast.error(t`Không thêm được`, { description: (e as Error).message }),
  });
  // Kiểu xem: ngang (cuộn ngang, như poster) hoặc dọc (cuộn dọc). Mặc định dọc trên điện thoại, ngang trên máy tính.
  const isPhone = !useMediaQuery("(min-width: 640px)");
  const [huong, setHuong] = useUrlState("huong", isPhone ? "doc" : "ngang");
  const layout = huong === "doc" ? "vertical" : "horizontal";
  // Mẫu nền poster (nằm trên URL để gửi link / tải lại vẫn đúng mẫu).
  const [nen, setNen] = useUrlState("nen", "giay-kem");
  const themeOptions = useMemo(
    () => getPosterThemes().map((x) => ({ value: x.id, label: `${x.label} — ${x.hint}` })),
    [],
  );
  const [showOpts, setShowOpts] = useState(false);
  // Mã QR ở chân poster (mặc định bật); nằm trên URL như các tuỳ chọn khác.
  const [qr, setQr] = useUrlState("qr", "1");
  const showQr = qr !== "0";
  const posterRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null);

  const chosen = milestones;
  const qrUrl = showQr
    ? `${window.location.origin}/clans/${clan.id}/timeline/${personId ? `p/${personId}` : "clan"}`
    : null;
  const toast = useToast();

  async function doExport(kind: "pdf" | "png") {
    const el = posterRef.current?.firstElementChild as HTMLElement | null;
    if (!el || exporting) return;
    setExporting(kind);
    try {
      const { exportPosterPdf, exportPosterPng, posterFilename } = await import(
        "@/lib/timeline/exportPoster"
      );
      const name = posterFilename(subject || clan.name, kind);
      if (kind === "pdf") await exportPosterPdf(el, name);
      else await exportPosterPng(el, name);
      toast.success(t`Đã tải ${name}`);
    } catch (e) {
      toast.error(t`Không xuất được file`, { description: (e as Error).message });
    } finally {
      setExporting(null);
    }
  }

  // Ảnh người đại diện của các mốc đang hiện (người còn sống bị ẩn ảnh ở bản công khai).
  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const photoPaths = useMemo(
    () =>
      [
        ...new Set(
          chosen
            .map((c) =>
              c.photoPersonId ? byId.get(c.photoPersonId)?.photo_path : null,
            )
            .filter((x): x is string => !!x),
        ),
      ].sort(),
    [chosen, byId],
  );
  const { data: photoUrls } = useQuery({
    queryKey: ["signed-photos-batch", clan.id, "timeline", photoPaths],
    queryFn: () => getSignedPhotoUrlMap(photoPaths),
    enabled: photoPaths.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });
  const posterItems = chosen.map((c) => {
    const path = c.photoPersonId ? byId.get(c.photoPersonId)?.photo_path : null;
    return { c, photoUrl: path ? (photoUrls?.get(path) ?? null) : null };
  });


  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Dòng thời gian`, to: `/clans/${clan.id}/timeline` },
          { label: personId ? (subject || "…") : t`Cả dòng họ` },
        ]}
      />
      <PageHeader
        icon={<IconCalendar className="h-7 w-7" />}
        title={personId ? t`Dòng thời gian của ${subject}` : t`Dòng thời gian dòng họ`}
        description={
          canEdit
            ? t`Bấm vào một mốc để sửa, hoặc dùng nút + để thêm mốc.`
            : personId
              ? t`Những dấu mốc trong cuộc đời.`
              : t`Câu chuyện dòng họ qua các thế hệ.`
        }
      />

      {/* Mẫu nền: full chiều ngang; nút Tuỳ chọn nằm trong ô (như ô chọn người ở màn Cây). */}
      <div className="print-hide">
        <FilterableSelect
          id="timeline-theme"
          icon={<IconSparkles />}
          value={nen}
          onChange={(v) => v && setNen(v)}
          options={themeOptions}
          emptyLabel={t`Chọn mẫu nền`}
          filterPlaceholder={t`Gõ tên mẫu để tìm`}
          filterLabel={t`Tìm mẫu nền poster`}
          required
          className="h-10 pr-12 text-sm"
          rightSlot={
            <button
              type="button"
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted ${showOpts ? "text-primary" : "text-muted-foreground"}`}
              onClick={() => setShowOpts((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={showOpts}
              aria-label={t`Tuỳ chọn`}
              title={t`Tuỳ chọn`}
            >
              <IconSliders className="h-4 w-4" />
            </button>
          }
        />
      </div>

      <FilterDrawer
        open={showOpts}
        onClose={() => setShowOpts(false)}
        title={t`Tuỳ chọn dòng thời gian`}
      >
        <div className="space-y-6">
          <section className="space-y-2">
            <p className="text-base font-medium">{t`Kiểu xem`}</p>
            <SegmentedControl ariaLabel={t`Kiểu xem`}>
              <SegmentedButton
                active={layout === "horizontal"}
                onClick={() => setHuong("ngang")}
              >
                {t`Cuộn ngang`}
              </SegmentedButton>
              <SegmentedButton
                active={layout === "vertical"}
                onClick={() => setHuong("doc")}
              >
                {t`Cuộn dọc`}
              </SegmentedButton>
            </SegmentedControl>
          </section>

          <section className="space-y-2">
            <p className="text-base font-medium">{t`Mã QR`}</p>
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-primary"
                checked={showQr}
                onChange={(e) => setQr(e.target.checked ? "1" : "0")}
              />
              <span>
                <span className="block text-base">{t`In mã QR xem dòng thời gian ở chân poster`}</span>
                <span className="block text-sm text-muted-foreground">
                  {t`Quét mã để mở dòng thời gian của dòng họ trên điện thoại. Mã cũng có trong file PDF / ảnh xuất ra.`}
                </span>
              </span>
            </label>
          </section>

          <section className="space-y-2">
            <p className="text-base font-medium">{t`Xuất file`}</p>
            <p className="text-sm text-muted-foreground">
              {t`Xuất đúng poster đang xem (cùng mẫu nền và kiểu xem), đủ cả phần cuộn ngang.`}
            </p>
            <ActionArea>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="w-full sm:w-auto sm:flex-1"
                disabled={!!exporting || chosen.length === 0}
                onClick={() => doExport("pdf")}
              >
                <IconDownload className="mr-1.5 h-4 w-4" />
                {exporting === "pdf" ? t`Đang tạo PDF…` : t`Tải file PDF`}
              </Button>
              <Button
                className="w-full sm:w-auto sm:flex-1"
                variant="outline"
                disabled={!!exporting || chosen.length === 0}
                onClick={() => doExport("png")}
              >
                <IconDownload className="mr-1.5 h-4 w-4" />
                {exporting === "png" ? t`Đang tạo ảnh…` : t`Tải ảnh PNG`}
              </Button>
            </div>
            </ActionArea>
          </section>
        </div>
      </FilterDrawer>

      {isLoading && <p className="text-muted-foreground">{t`Đang tải…`}</p>}

      {milestones.length === 0 && !isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <p className="text-lg font-semibold">{t`Dòng thời gian chưa có mốc nào`}</p>
          <p className="mx-auto mt-1 max-w-md text-base text-muted-foreground">
            {canEdit
              ? t`Bấm nút + để thêm mốc đầu tiên, hoặc chọn từ dữ liệu dòng họ trong form thêm mốc.`
              : t`Chưa có mốc nào được thêm.`}
          </p>
          {canEdit && personId && bioRows.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Button disabled={importBio.isPending} onClick={() => importBio.mutate()}>
                {t`Thêm ${bioRows.length} mốc từ tiểu sử`}
              </Button>
            </div>
          )}
          {canEdit && !personId && suggestions.some((c) => c.recommended) && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" disabled={addHighlights.isPending} onClick={() => addHighlights.mutate()}>
                {t`Thêm các mốc nổi bật từ gia phả`}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div ref={posterRef}>
          <TimelinePoster
            qrUrl={qrUrl}
            clanName={clan.name}
            title={personId ? subject : undefined}
            subtitle={personId ? t`Dòng thời gian cuộc đời` : undefined}
            quote={personId ? t`Một đời người, những dấu mốc còn lại.` : undefined}
            iconFrames={!personId}
            onSelect={
              canEdit
                ? (c) => openPanel("timeline-edit", { pid: c.key.replace(/^row:/, ""), pfrom: personId })
                : undefined
            }
            items={posterItems}
            layout={layout}
            themeId={nen}
          />
          </div>
        </>
      )}
      {canEdit && (
        <Fab label={t`Thêm mốc`} onClick={() => openPanel("timeline-new", { pfrom: personId })} />
      )}
    </div>
  );
}
