import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import {
  IconCalendar,
  IconPencil,
  IconScroll,
  IconSend,
  IconSparkles,
  IconTree,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { SectionHeading } from "@/components/SectionHeading";
import { ShareCardDialog } from "@/components/ShareCardDialog";
import { Button } from "@/components/ui/button";
import { effectiveRole } from "@/hooks/useClanContext";
import { computeClanFunFacts, type FunFact } from "@/lib/clanFunFacts";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { listBranches } from "@/lib/queries/branches";
import { queryKeys } from "@/lib/queries/keys";
import { listClanMembers } from "@/lib/queries/members";
import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";

/** Icon outline theo loại fact (thay cho emoji). */
function factIcon(id: string): ReactNode {
  const c = "h-4 w-4";
  switch (id) {
    case "overview":
      return <IconTree className={c} />;
    case "biggest-branch":
    case "most-children":
      return <IconUsers className={c} />;
    case "oldest":
    case "eldest-living":
      return <IconUser className={c} />;
    case "common-middle":
      return <IconPencil className={c} />;
    case "birth-month":
      return <IconCalendar className={c} />;
    case "same-birthday":
      return <IconSparkles className={c} />;
    default:
      return <IconScroll className={c} />;
  }
}

/**
 * "Thống kê vui" — fun-fact dòng họ tính client-side. Lưới 2 cột, mỗi ô có
 * nút chia sẻ → tạo thẻ ảnh gửi nhóm họ (lan toả).
 */
export function FunFactsCard({
  clan,
  userId,
  persons,
  families,
}: {
  clan: ClanDetail;
  userId: string;
  persons: PersonForTree[];
  families: FamilyForTree[];
}) {
  const isMember = effectiveRole(clan) !== null;

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches(clan.id, userId),
    queryFn: () => listBranches(clan.id),
    enabled: !!userId,
  });
  const { data: members } = useQuery({
    queryKey: queryKeys.clanMembers(clan.id, userId),
    queryFn: () => listClanMembers(clan.id),
    enabled: !!userId && isMember,
  });
  const selfPersonId = members?.find((m) => m.user_id === userId)?.self_person_id ?? null;

  const facts = useMemo(() => {
    const branchNameById = new Map((branches ?? []).map((b) => [b.id, b.name]));
    return computeClanFunFacts({
      persons,
      families,
      branchNameById,
      genOffset: clan.generation_offset,
      selfPersonId,
      nowYear: new Date().getFullYear(),
    });
  }, [persons, families, branches, clan.generation_offset, selfPersonId]);

  const [shareFact, setShareFact] = useState<FunFact | null>(null);

  if (facts.length === 0) return null;

  return (
    <section aria-label="Thống kê vui" className="space-y-2">
      <SectionHeading icon={<IconSparkles />} title="Thống kê vui" />
      <div className="grid gap-2 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                {factIcon(f.id)}
              </span>
              <p className="flex-1 min-w-0 text-sm leading-snug">{f.text}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="self-end"
              onClick={() => setShareFact(f)}
            >
              <IconSend className="h-4 w-4 mr-1.5" />
              Chia sẻ
            </Button>
          </div>
        ))}
      </div>

      {shareFact && (
        <ShareCardDialog
          key={shareFact.id}
          open
          onClose={() => setShareFact(null)}
          clanName={clan.name}
          shareUrl=""
          initialTitle={clan.name}
          initialExcerpt={shareFact.text}
          statText={shareFact.stat}
          defaultGenre="funfact"
        />
      )}
    </section>
  );
}
