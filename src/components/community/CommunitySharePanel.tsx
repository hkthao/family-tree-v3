import { useMemo, useState } from "react";

import { MemoryCard } from "@/components/community/MemoryCard";
import { MemoryForm } from "@/components/community/MemoryForm";
import { IconBook, IconSearch, IconUserPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShareViewCommunity, ShareViewPerson } from "@/lib/queries/share-view";

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
 * Tab "Cùng góp" của trang chia sẻ: chọn người (ưu tiên người đã mất), đọc những gì cả nhà đã kể,
 * rồi kể thêm — không cần tài khoản (gửi qua community-submit, chờ duyệt). `fixedPersonId`: trang
 * QR cá nhân chỉ kể về đúng một người.
 */
export function CommunitySharePanel({
  community,
  persons,
  token,
  clanId,
  clanName,
  initialPersonId,
  fixedPersonId,
}: {
  community: ShareViewCommunity;
  persons: ShareViewPerson[];
  token: string;
  clanId: string;
  clanName: string | null;
  initialPersonId?: string | null;
  fixedPersonId?: string | null;
}) {
  const [personId, setPersonId] = useState<string | null>(fixedPersonId ?? initialPersonId ?? null);
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState<null | "pending" | "visible">(null);
  const [writing, setWriting] = useState(!!(fixedPersonId ?? initialPersonId));

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const memoryCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of community.memories) if (x.person_id) m.set(x.person_id, (m.get(x.person_id) ?? 0) + 1);
    return m;
  }, [community.memories]);

  // Người đã mất trước (đó là những người cần ký ức nhất); người ít ký ức lên trước.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return persons
      .filter((p) => !q || p.full_name.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(a.is_living) - Number(b.is_living) ||
          (memoryCount.get(a.id) ?? 0) - (memoryCount.get(b.id) ?? 0) ||
          (a.generation ?? 99) - (b.generation ?? 99),
      )
      .slice(0, 12);
  }, [persons, query, memoryCount]);

  const person = personId ? byId.get(personId) : null;
  const shown = community.memories.filter((m) => (personId ? m.person_id === personId : true));

  return (
    <div className="container max-w-3xl space-y-5 py-4">
      <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <h2 className="text-lg font-semibold">
          {community.recipient_label
            ? t`Chào ${community.recipient_label}! Cả nhà nhờ bạn đóng góp giúp`
            : t`Cả nhà ơi, cùng đóng góp câu chuyện của gia đình mình`}
        </h2>
        <ol className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {[
            t`Chọn người bạn muốn đóng góp (ông bà, cha mẹ…)`,
            t`Viết một câu chuyện, góp ảnh cũ, hoặc ghi âm`,
            t`Bấm Gửi — không cần đăng ký`,
          ].map((s, i) => (
            <li key={s} className="flex items-center gap-2 rounded-lg bg-background/70 px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          <CommunityStatsLine community={community} />
        </p>
      </section>

      {!fixedPersonId && (
        <section className="space-y-2">
          <Label htmlFor="community-person-search">{t`Bạn muốn đóng góp về ai?`}</Label>
          <Input
            id="community-person-search"
            icon={<IconSearch />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t`Gõ tên để tìm…`}
          />
          <div className="flex flex-wrap gap-2">
            {candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPersonId(p.id);
                  setWriting(true);
                  setSent(null);
                }}
                aria-pressed={personId === p.id}
                className={`min-h-11 rounded-full border px-3 text-sm transition-colors ${
                  personId === p.id ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-card hover:border-primary/60"
                }`}
              >
                {p.full_name}
                {(memoryCount.get(p.id) ?? 0) > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">({memoryCount.get(p.id)})</span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPersonId(null);
                setWriting(true);
                setSent(null);
              }}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed px-3 text-sm hover:border-primary/60"
            >
              <IconUserPlus className="h-4 w-4" />
              {t`Chuyện chung của họ`}
            </button>
          </div>
        </section>
      )}

      {sent ? (
        <section className="space-y-3 rounded-xl border bg-card p-4 text-center">
          <p className="font-semibold">{t`Cảm ơn bạn đã đóng góp! 🙏`}</p>
          <p className="text-sm text-muted-foreground">
            {sent === "visible"
              ? t`Đóng góp đã được lưu vào gia phả.`
              : t`Người quản lý dòng họ sẽ xem rồi đưa vào gia phả. Tên bạn được ghi là người đóng góp.`}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSent(null);
                setWriting(true);
              }}
            >
              <IconBook className="mr-1.5 h-4 w-4" />
              {t`Đóng góp thêm`}
            </Button>
          </div>
        </section>
      ) : writing ? (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h3 className="font-semibold">
            {person ? t`Đóng góp về ${person.full_name}` : (clanName ? t`Đóng góp chuyện chung của ${clanName}` : t`Đóng góp chuyện chung của dòng họ`)}
          </h3>
          {person?.is_living && (
            <p className="text-xs text-muted-foreground">
              {t`Người này còn sống: đóng góp chỉ người trong họ xem được, không hiện ở trang chia sẻ.`}
            </p>
          )}
          <MemoryForm
            key={personId ?? "clan"}
            mode="guest"
            token={token}
            clanId={clanId}
            personId={personId}
            personName={person?.full_name ?? null}
            onDone={(s) => {
              setSent(s === "visible" ? "visible" : "pending");
              setWriting(false);
            }}
          />
        </section>
      ) : null}

      {shown.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-semibold">
            {person ? t`Đóng góp về ${person.full_name}` : t`Các đóng góp`}
          </h3>
          {shown.map((m) => (
            <MemoryCard
              key={m.id}
              showPerson={!personId}
              memory={{
                ...m,
                author_label: m.author_name ?? t`Người thân`,
                person_name: m.person_id ? (byId.get(m.person_id)?.full_name ?? null) : null,
              }}
            />
          ))}
        </section>
      )}
    </div>
  );
}
