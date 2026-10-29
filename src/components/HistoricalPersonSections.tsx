import { CollapsibleCard } from "@/components/CollapsibleCard";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { IconClock, IconScroll } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitFeedback } from "@/lib/queries/feedback";
import {
  CONFIDENCE_LABEL,
  REIGN_ROLE_LABEL,
  citationFieldLabel,
  formatCitationValue,
  getPersonHistorical,
  type Citation,
  type Confidence,
  type PersonHistorical,
} from "@/lib/queries/historical";

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  single_source: "bg-zinc-400/15 text-zinc-600 dark:text-zinc-300 border-zinc-400/30",
  disputed: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  legendary: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

function ConfidencePill({ level }: { level: Confidence }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CONFIDENCE_CLASS[level]}`}
    >
      {level === "disputed" ? "⚠ " : ""}
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}

function years(from: number | null | undefined, to: number | null | undefined): string {
  if (from != null && to != null) return `${from}–${to}`;
  if (from != null) return `từ ${from}`;
  if (to != null) return `đến ${to}`;
  return "";
}

/**
 * Trị vì, tước hiệu, cha mẹ nuôi và nguồn sử liệu của một người trong dòng họ
 * lịch sử. Không có dữ liệu nào → không hiện gì.
 */
export function HistoricalPersonSections({
  personId,
  personName,
  bio,
  clanId,
  userId,
  onPersonClick,
}: {
  personId: string;
  personName: string;
  /** Tiểu sử có mục "Sự nghiệp theo năm" → dòng thời gian. */
  bio?: string | null;
  clanId: string;
  /** Rỗng = khách chưa đăng nhập (trang xem thử công khai). */
  userId?: string;
  /** Trang xem thử: bấm tên cha mẹ nuôi → đổi người đang xem thay vì mở trang trong app. */
  onPersonClick?: (personId: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["person-historical", personId, userId ?? ""],
    queryFn: () => getPersonHistorical(personId),
    enabled: !!personId,
  });
  if (!data) return null;
  return (
    <>
      <ReignCard data={data} clanId={clanId} onPersonClick={onPersonClick} />
      <TimelineCard data={data} bio={bio ?? null} personName={personName} clanId={clanId} />
    </>
  );
}

function ReignCard({
  data,
  clanId,
  onPersonClick,
}: {
  data: PersonHistorical;
  clanId: string;
  onPersonClick?: (personId: string) => void;
}) {
  const { reigns, titles, adoptiveParents } = data;
  if (reigns.length === 0 && titles.length === 0 && adoptiveParents.length === 0) return null;
  return (
    <CollapsibleCard title={<><IconScroll className="h-5 w-5" />
          {reigns.length > 0 ? "Trị vì & tước hiệu" : "Tước hiệu"}</>} titleClassName="inline-flex items-center gap-2" contentClassName="space-y-4 text-base">
        {reigns.map((r) => (
          <div key={r.id} className="space-y-1">
            <p className="font-medium">
              {REIGN_ROLE_LABEL[r.role] ?? r.role}
              {r.ordinal != null ? ` thứ ${r.ordinal}` : ""} nhà {r.dynasty}
              {r.temple_name ? ` · miếu hiệu ${r.temple_name}` : ""}
            </p>
            {years(r.reign_start_year, r.reign_end_year) && (
              <p className="text-muted-foreground">Ở ngôi {years(r.reign_start_year, r.reign_end_year)}</p>
            )}
            {r.era_names.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Niên hiệu">
                {r.era_names.map((e) => (
                  <span key={e.name} className="rounded-full border bg-card px-2.5 py-0.5 text-sm">
                    {e.name}
                    {e.from_year != null ? ` (${e.from_year})` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {titles.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Tước hiệu, chức vị</p>
            <ul className="space-y-0.5">
              {titles.map((t) => (
                <li key={t.id}>
                  {t.title}
                  {years(t.from_year, t.to_year) && (
                    <span className="text-muted-foreground"> · {years(t.from_year, t.to_year)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {adoptiveParents.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Cha mẹ nuôi / thừa tự</p>
            <ul className="space-y-0.5">
              {adoptiveParents.map((p) => (
                <li key={p.person_id}>
                  <span className="text-muted-foreground">{p.role === "father" ? "Cha nuôi: " : "Mẹ nuôi: "}</span>
                  {onPersonClick ? (
                    <button type="button" onClick={() => onPersonClick(p.person_id)} className="text-primary hover:underline">
                      {p.full_name ?? "(ẩn)"}
                    </button>
                  ) : (
                    <Link to={`/clans/${clanId}/people/${p.person_id}`} className="text-primary hover:underline">
                      {p.full_name ?? "(ẩn)"}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CollapsibleCard>
  );
}

interface TimelineEntry {
  year: number | null;
  /** Nhãn năm theo sử ("Bính Tuất (1226)") hoặc tên trường ("Ngày mất"). */
  label: string;
  text: string | null;
  quotes: Citation[];
}

const YEAR_RE = /\((\d{3,4})\)/;

/** Các ý "Năm Bính Tuất (1226): …" trong tiểu sử → từng mốc của dòng thời gian. */
function parseBioTimeline(bio: string | null): { year: number; label: string; text: string }[] {
  if (!bio) return [];
  const out: { year: number; label: string; text: string }[] = [];
  for (const line of bio.split("\n")) {
    const m = /^[-•]\s+(Năm [^:()]*\((\d{3,4})\)[^:]*):\s*(.+)$/.exec(line.trim());
    if (m) out.push({ year: Number(m[2]), label: m[1], text: m[3] });
  }
  return out;
}

function buildTimeline(bio: string | null, citations: Citation[], titles: PersonHistorical["titles"]): TimelineEntry[] {
  const entries = new Map<number, TimelineEntry>();
  for (const e of parseBioTimeline(bio)) {
    const prev = entries.get(e.year);
    if (prev) prev.text = `${prev.text}\n${e.text}`;
    else entries.set(e.year, { year: e.year, label: e.label, text: e.text, quotes: [] });
  }
  const undated: TimelineEntry = { year: null, label: "Nguồn không gắn năm", text: null, quotes: [] };
  for (const c of citations) {
    const y = YEAR_RE.exec(c.locator)?.[1];
    if (y) {
      const year = Number(y);
      const e = entries.get(year) ?? { year, label: `Năm ${year}`, text: null, quotes: [] };
      e.quotes.push(c);
      entries.set(year, e);
    } else {
      undated.quotes.push(c);
    }
  }
  // Mốc chỉ có trích dẫn, chưa có lời tiểu sử: ghi tên trường để người đọc biết là dữ kiện gì.
  for (const e of entries.values()) {
    if (!e.text && e.quotes.length) {
      const f = [...new Set(e.quotes.map((q) => citationFieldLabel(q.field, titles)))];
      e.text = f.join(" · ");
    }
  }
    const dated = [...entries.values()].sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  return undated.quotes.length ? [...dated, undated] : dated;
}

function TimelineCard({
  data,
  bio,
  personName,
  clanId,
}: {
  data: PersonHistorical;
  bio: string | null;
  personName: string;
  clanId: string;
}) {
  const { citations, titles } = data;
  if (citations.length === 0 && parseBioTimeline(bio).length === 0) return null;
  const entries = buildTimeline(bio, citations, titles);
  const disputed = citations.filter((c) => c.confidence === "disputed").length;
  // Trích dẫn chưa có người duyệt → bản đang duyệt (phiên âm / dịch có thể còn chỉnh).
  const unreviewed = citations.some((c) => !c.reviewed_by);
  return (
    <CollapsibleCard
      title={
        <>
          <IconClock className="h-5 w-5" />
          Dòng thời gian
        </>
      }
      titleClassName="inline-flex items-center gap-2"
      contentClassName="space-y-4"
      header={
        <>
          <p className="text-sm text-muted-foreground">
            Các mốc theo năm sử chép; bấm “Nguyên văn” để xem câu trích trong sách sử.
            {disputed > 0 && ` Có ${disputed} dữ kiện các nguồn chép khác nhau (dị bản).`}
          </p>
          {unreviewed && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Bản đang duyệt: trích dẫn nguyên văn đã được đối chiếu, phần phiên âm và dịch
              có thể còn được chỉnh. Thấy chỗ chưa đúng, bấm “Báo sai sót” bên dưới.
            </p>
          )}
        </>
      }
    >
      <ol className="relative space-y-5 border-l-2 border-primary/30 pl-5">
        {entries.map((e, i) => (
          <li key={`${e.year ?? "none"}-${i}`} className="relative">
            <span
              className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-card"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-primary">{e.label}</p>
            {e.text && <p className="mt-0.5 whitespace-pre-line">{e.text}</p>}
            {e.quotes.length > 0 && (
              <details className="mt-2 rounded-lg border bg-card px-3 py-2 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 py-0.5 text-sm text-muted-foreground">
                  Nguyên văn ({e.quotes.length})
                  {e.quotes.some((q) => q.confidence === "disputed") && (
                    <ConfidencePill level="disputed" />
                  )}
                </summary>
                <ul className="mt-2 space-y-3 border-t pt-3">
                  {e.quotes.map((c) => (
                    <li key={c.id} className="space-y-1 text-sm">
                      <p>
                        {c.source?.url ? (
                          <a href={c.source.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                            {c.source.title}
                          </a>
                        ) : (
                          <span className="font-medium">{c.source?.title ?? "Nguồn"}</span>
                        )}
                        <span className="text-muted-foreground"> — {c.locator}</span>
                      </p>
                      <blockquote lang="zh-Hant" className="border-l-2 border-primary/40 pl-3 text-base leading-relaxed">
                        {c.quote}
                      </blockquote>
                      <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        <span>{citationFieldLabel(c.field, titles)}</span>
                        <ConfidencePill level={c.confidence} />
                      </p>
                      {c.value && (
                        <p>
                          <span className="text-muted-foreground">Nguồn này ghi: </span>
                          {formatCitationValue(c.value)}
                        </p>
                      )}
                      {c.note && <p className="text-muted-foreground">Ghi chú: {c.note}</p>}
                      {c.reviewed_by && <p className="text-muted-foreground">Người duyệt: {c.reviewed_by}</p>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ol>
      <ReportError personName={personName} clanId={clanId} />
    </CollapsibleCard>
  );
}

/** "Báo sai sót" — gửi vào hộp góp ý của admin (ai xem cũng gửi được). */
function ReportError({ personName, clanId }: { personName: string; clanId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () =>
      submitFeedback({
        category: "bug",
        message: `[Sai sót sử liệu] ${personName}: ${text.trim()}`,
        clanId,
        pageUrl: window.location.href,
      }),
    onSuccess: () => {
      toast.success("Đã gửi — cảm ơn bạn, ban biên tập sẽ đối chiếu lại nguồn");
      setText("");
      setOpen(false);
    },
    onError: (e) => toast.error("Chưa gửi được", { description: (e as Error).message }),
  });
  if (!open) {
    return (
      <div className="pt-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Báo sai sót
        </Button>
      </div>
    );
  }
  return (
    <form
      className="space-y-2 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) send.mutate();
      }}
    >
      <Label htmlFor="historical-report">Chỗ nào chưa đúng? Nếu được, ghi kèm nguồn (sách, quyển, trang).</Label>
      <Textarea
        id="historical-report"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Huỷ
        </Button>
        <Button type="submit" size="sm" disabled={!text.trim() || send.isPending}>
          {send.isPending ? "Đang gửi…" : "Gửi"}
        </Button>
      </div>
    </form>
  );
}
