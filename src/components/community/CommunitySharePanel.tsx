import { useMemo, useRef, useState } from "react";

import { MemoryCard } from "@/components/community/MemoryCard";
import { MemoryForm } from "@/components/community/MemoryForm";
import { FilterableSelect } from "@/components/FilterableSelect";
import { FaceTagger } from "@/components/community/FaceTagger";
import { useToast } from "@/components/Toast";
import { IconBook, IconUser } from "@/components/icons";
import { Input } from "@/components/ui/input";
import {
  PHOTO_IDENTIFY_ENABLED,
  readGuestProfile,
  saveGuestProfile,
  submitGuestFace,
} from "@/lib/queries/community";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ShareViewCommunity, ShareViewFace, ShareViewPerson } from "@/lib/queries/share-view";

import { t } from "@lingui/core/macro";

/** Số liệu công khai: lượt ghé + người đã góp + ký ức (plan §4.2 — "dấu hiệu sống động"). */
export function CommunityStatsLine({ community }: { community: ShareViewCommunity }) {
  const s = community.stats;
  if (!s) return null;
  const parts = [
    s.visits_total > 0 ? t`${s.visits_total} lượt ghé thăm` : null,
    s.contributors > 0 ? t`${s.contributors} người đã góp` : null,
    s.memories > 0 ? t`${s.memories} đóng góp` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <span>{parts.join(" · ")}</span>;
}

/**
 * Tab "Cùng góp" của trang chia sẻ: chọn người bằng ô chọn có tìm kiếm (họ đông vẫn chọn được hết,
 * gõ không dấu), form đóng góp hiện ngay bên dưới, rồi tới những gì cả nhà đã góp. Không cần tài khoản
 * (gửi qua community-submit, chờ duyệt). `fixedPersonId`: trang QR cá nhân chỉ góp về đúng một người.
 */
export function CommunitySharePanel({
  community,
  persons,
  token,
  clanId,
  clanName,
  initialPersonId,
  initialQuestionId,
  fixedPersonId,
  mode = "gop",
}: {
  community: ShareViewCommunity;
  persons: ShareViewPerson[];
  token: string;
  clanId: string;
  clanName: string | null;
  initialPersonId?: string | null;
  /** Link trả lời câu hỏi (?q=) — mở thẳng câu hỏi đó. */
  initialQuestionId?: string | null;
  /** "gop" = tab Cùng góp (đóng góp thường); "hoi" = tab Hỏi & trả lời (câu hỏi + câu trả lời). */
  mode?: "gop" | "hoi";
  fixedPersonId?: string | null;
}) {
  const [personId, setPersonId] = useState<string>(() => {
    if (fixedPersonId) return fixedPersonId;
    const q = mode === "hoi" ? (community.questions ?? []).find((x) => x.id === initialQuestionId) : undefined;
    return q?.about_person_id ?? q?.ask_person_id ?? initialPersonId ?? "";
  });
  const [sent, setSent] = useState<null | "pending" | "visible">(null);
  const questions = community.questions ?? [];
  const [questionId, setQuestionId] = useState<string>(
    mode === "hoi" && initialQuestionId && questions.some((q) => q.id === initialQuestionId)
      ? initialQuestionId
      : "",
  );
  const question = questions.find((q) => q.id === questionId) ?? null;
  const [tagging, setTagging] = useState<string | null>(null);

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const memoryCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of community.memories) if (x.person_id) m.set(x.person_id, (m.get(x.person_id) ?? 0) + 1);
    return m;
  }, [community.memories]);

  // Toàn bộ người trong phạm vi link: người đã mất trước (cần ký ức nhất), rồi theo đời, rồi tên.
  // Nhãn kèm năm sinh–mất (người sống đã bị che ngày) + số đóng góp để phân biệt người trùng tên.
  const options = useMemo(
    () =>
      [...persons]
        .sort(
          (a, b) =>
            Number(a.is_living) - Number(b.is_living) ||
            (a.generation ?? 99) - (b.generation ?? 99) ||
            a.full_name.localeCompare(b.full_name, "vi"),
        )
        .map((p) => {
          const by = p.birth_date?.slice(0, 4);
          const dy = p.death_date?.slice(0, 4);
          const years = by || dy ? ` (${by ?? "?"}–${dy ?? (p.is_living ? "" : "?")})` : "";
          const n = memoryCount.get(p.id) ?? 0;
          return {
            value: p.id,
            label: `${p.full_name}${years}${p.is_living ? "" : " †"}${n > 0 ? ` · ${t`${n} đóng góp`}` : ""}`,
          };
        }),
    [persons, memoryCount],
  );

  const person = personId ? byId.get(personId) : null;
  const isHoi = mode === "hoi";
  // Tab Hỏi & trả lời chỉ hiện câu trả lời (lọc theo câu hỏi đang chọn); tab Cùng góp chỉ hiện đóng góp thường.
  const shown = community.memories.filter((m) =>
    isHoi
      ? !!m.question_id && (!questionId || m.question_id === questionId)
      : !m.question_id && (personId ? m.person_id === personId : true),
  );

  return (
    <div className="container max-w-3xl space-y-4 py-4">
      <section className="space-y-1 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <h2 className="font-semibold">
          {community.recipient_label
            ? isHoi
              ? t`Chào ${community.recipient_label}! Cả nhà muốn hỏi bạn`
              : t`Chào ${community.recipient_label}! Cả nhà nhờ bạn đóng góp giúp`
            : isHoi
              ? t`Cả nhà cùng hỏi, ông bà cùng kể`
              : t`Cùng đóng góp câu chuyện của gia đình`}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isHoi
            ? t`Chọn câu hỏi · bấm Trả lời · viết (hoặc bấm 🎤 trên bàn phím để nói) · bấm Gửi. Không cần đăng ký.`
            : t`Chọn người · viết hoặc góp ảnh cũ · bấm Gửi. Không cần đăng ký.`}
        </p>
        <p className="text-xs text-muted-foreground">
          <CommunityStatsLine community={community} />
        </p>
      </section>

      {/* P1 "Hỏi ông bà": câu hỏi đang chờ — bấm "Trả lời" để ghi âm / viết câu trả lời. */}
      {/* Đã chọn câu hỏi → ẩn danh sách (câu hỏi đã hiện ở đầu form), chỉ còn link chọn câu khác. */}
      {isHoi && questionId && !sent && (
        <button
          type="button"
          onClick={() => setQuestionId("")}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t`← Chọn câu hỏi khác`}
        </button>
      )}

      {isHoi && !questionId && questions.filter((q) => q.status !== "closed").length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t`Câu hỏi cả nhà đang hỏi`}</h3>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {questions
              .filter((q) => q.status !== "closed")
              .map((q) => (
                <li key={q.id} className={`flex items-center gap-2 p-3 ${q.id === questionId ? "bg-primary/5" : ""}`}>
                  <p className="min-w-0 flex-1 text-sm">
                    “{q.question}”
                    {(q.ask_person_id || q.about_person_id) && (
                      <span className="block text-xs text-muted-foreground">
                        {[
                          q.ask_person_id ? t`Hỏi ${byId.get(q.ask_person_id)?.full_name ?? ""}` : null,
                          q.about_person_id ? t`về ${byId.get(q.about_person_id)?.full_name ?? ""}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </p>
                  <Button
                    size="sm"
                    variant={q.id === questionId ? "default" : "outline"}
                    className="shrink-0"
                    onClick={() => {
                      setQuestionId(q.id === questionId ? "" : q.id);
                      setPersonId(q.about_person_id ?? q.ask_person_id ?? "");
                      setSent(null);
                    }}
                  >
                    {q.id === questionId ? t`Đang trả lời` : t`Trả lời`}
                  </Button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {!fixedPersonId && !isHoi && (
        <div className="space-y-1.5">
          <Label htmlFor="community-person">{t`Bạn muốn đóng góp về ai?`}</Label>
          <FilterableSelect
            id="community-person"
            icon={<IconUser />}
            value={personId}
            onChange={(v) => {
              setPersonId(v);
              setSent(null);
            }}
            options={options}
            emptyLabel={clanName ? t`Chuyện chung của ${clanName}` : t`Chuyện chung của dòng họ`}
            filterLabel={t`Tìm người`}
            filterPlaceholder={t`Gõ tên để tìm (không cần dấu)`}
          />
        </div>
      )}

      {isHoi && !questionId && !sent ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t`Chọn một câu hỏi ở trên rồi bấm "Trả lời".`}
        </p>
      ) : sent ? (
        <section className="space-y-3 rounded-xl border bg-card p-4 text-center">
          <p className="font-semibold">{t`Cảm ơn bạn đã đóng góp! 🙏`}</p>
          <p className="text-sm text-muted-foreground">
            {sent === "visible"
              ? t`Đóng góp đã được lưu vào gia phả.`
              : t`Người quản lý dòng họ sẽ xem rồi đưa vào gia phả. Tên bạn được ghi là người đóng góp.`}
          </p>
          <Button variant="outline" onClick={() => setSent(null)}>
            <IconBook className="mr-1.5 h-4 w-4" />
            {isHoi ? t`Trả lời câu khác` : t`Đóng góp thêm`}
          </Button>
        </section>
      ) : (
        <section className="space-y-3 rounded-xl border bg-card p-3 sm:p-4">
          {person?.is_living && (
            <p className="text-xs text-muted-foreground">
              {t`Người này còn sống: đóng góp chỉ người trong họ xem được, không hiện ở trang chia sẻ.`}
            </p>
          )}
          <MemoryForm
            key={`${personId || "clan"}:${questionId}`}
            mode="guest"
            questionId={questionId || null}
            questionText={question?.question ?? null}
            token={token}
            clanId={clanId}
            personId={personId || null}
            personName={person?.full_name ?? null}
            facts={
              person
                ? {
                    full_name: person.full_name,
                    is_living: person.is_living,
                    birth_date: person.birth_date,
                    death_date: person.death_date,
                    birth_place: person.birth_place ?? null,
                    burial_place: person.burial_place ?? null,
                    death_anniv_lunar_month: person.death_anniv_lunar_month ?? null,
                    death_anniv_lunar_day: person.death_anniv_lunar_day ?? null,
                  }
                : null
            }
            onDone={(s) => setSent(s === "visible" ? "visible" : "pending")}
          />
        </section>
      )}

      {shown.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold">
            {isHoi
              ? question
                ? t`Câu trả lời cho câu hỏi này`
                : t`Các câu trả lời`
              : person
                ? t`Đóng góp về ${person.full_name}`
                : t`Các đóng góp`}
          </h3>
          {shown.map((m) => (
            <div key={m.id} className="space-y-2">
              <MemoryCard
                showPerson={!personId}
                memory={{
                  ...m,
                  author_label: m.author_name ?? t`Người thân`,
                  person_name: m.person_id ? (byId.get(m.person_id)?.full_name ?? null) : null,
                  face_count: m.faces?.length ?? 0,
                  question_text: m.question_id
                    ? (questions.find((q) => q.id === m.question_id)?.question ?? null)
                    : null,
                }}
                onIdentify={
                  PHOTO_IDENTIFY_ENABLED && m.identify && m.media_url && !m.is_external
                    ? () => setTagging(tagging === m.id ? null : m.id)
                    : undefined
                }
              />
              {tagging === m.id && m.media_url && (
                <GuestFaces token={token} memoryId={m.id} src={m.media_url} faces={m.faces ?? []} persons={persons} />
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/**
 * Khách khoanh mặt trên ảnh "nhờ nhận diện" (qua community-submit, kind=face). Khung đã xác nhận
 * có tên; gợi ý của người khác chỉ hiện "chờ xác nhận" (plan §11, câu 8). Cần tên người góp.
 */
function GuestFaces({
  token,
  memoryId,
  src,
  faces,
  persons,
}: {
  token: string;
  memoryId: string;
  src: string;
  faces: ShareViewFace[];
  persons: ShareViewPerson[];
}) {
  const toast = useToast();
  const openedAt = useRef(performance.now());
  const [name, setName] = useState(() => readGuestProfile().name);
  const [mine, setMine] = useState<ShareViewFace[]>([]);
  const [busy, setBusy] = useState(false);
  const options = useMemo(
    () =>
      [...persons]
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"))
        .map((p) => ({ value: p.id, label: `${p.full_name}${p.is_living ? "" : " †"}` })),
    [persons],
  );
  const all = [...faces, ...mine];
  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="space-y-1.5">
        <label htmlFor={`face-guest-${memoryId}`} className="text-sm font-medium">
          {t`Tên của bạn (để ghi người nhận diện)`}
        </label>
        <Input
          id={`face-guest-${memoryId}`}
          icon={<IconUser />}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder={t`Ví dụ: Nguyễn Minh`}
        />
      </div>
      <FaceTagger
        src={src}
        alt={t`Ảnh nhờ nhận diện`}
        canAdd={!!name.trim()}
        submitting={busy}
        personOptions={options}
        faces={all.map((f) => ({
          id: f.id,
          box: f.box,
          confirmed: f.confirmed,
          label: f.label,
          note: f.note,
        }))}
        onSubmit={async (f) => {
          setBusy(true);
          try {
            const prof = readGuestProfile();
            saveGuestProfile({ name: name.trim(), relation: prof.relation });
            await submitGuestFace({
              token,
              memory_id: memoryId,
              ...f,
              author_name: name.trim(),
              elapsed_ms: performance.now() - openedAt.current,
            });
            setMine((m) => [...m, { id: `mine-${m.length}`, box: f.box, confirmed: false, label: null, note: null }]);
            toast.success(t`Đã gửi, cảm ơn bạn! Người quản lý dòng họ sẽ xác nhận.`);
          } catch (e) {
            toast.error(t`Chưa gửi được`, { description: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      />
      {!name.trim() && (
        <p className="text-xs text-muted-foreground">{t`Ghi tên của bạn để bắt đầu khoanh mặt.`}</p>
      )}
    </div>
  );
}
