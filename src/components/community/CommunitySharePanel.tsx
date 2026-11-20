import { useMemo, useState } from "react";

import { MemoryCard } from "@/components/community/MemoryCard";
import { MemoryForm } from "@/components/community/MemoryForm";
import { FilterableSelect } from "@/components/FilterableSelect";
import { IconBook, IconUser } from "@/components/icons";
import { Button } from "@/components/ui/button";
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
  const [personId, setPersonId] = useState<string>(fixedPersonId ?? initialPersonId ?? "");
  const [sent, setSent] = useState<null | "pending" | "visible">(null);

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
  const shown = community.memories.filter((m) => (personId ? m.person_id === personId : true));

  return (
    <div className="container max-w-3xl space-y-4 py-4">
      <section className="space-y-1 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <h2 className="font-semibold">
          {community.recipient_label
            ? t`Chào ${community.recipient_label}! Cả nhà nhờ bạn đóng góp giúp`
            : t`Cùng đóng góp câu chuyện của gia đình`}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t`Chọn người · viết, góp ảnh cũ hoặc ghi âm · bấm Gửi. Không cần đăng ký.`}
        </p>
        <p className="text-xs text-muted-foreground">
          <CommunityStatsLine community={community} />
        </p>
      </section>

      {!fixedPersonId && (
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

      {sent ? (
        <section className="space-y-3 rounded-xl border bg-card p-4 text-center">
          <p className="font-semibold">{t`Cảm ơn bạn đã đóng góp! 🙏`}</p>
          <p className="text-sm text-muted-foreground">
            {sent === "visible"
              ? t`Đóng góp đã được lưu vào gia phả.`
              : t`Người quản lý dòng họ sẽ xem rồi đưa vào gia phả. Tên bạn được ghi là người đóng góp.`}
          </p>
          <Button variant="outline" onClick={() => setSent(null)}>
            <IconBook className="mr-1.5 h-4 w-4" />
            {t`Đóng góp thêm`}
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
            key={personId || "clan"}
            mode="guest"
            token={token}
            clanId={clanId}
            personId={personId || null}
            personName={person?.full_name ?? null}
            onDone={(s) => setSent(s === "visible" ? "visible" : "pending")}
          />
        </section>
      )}

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
