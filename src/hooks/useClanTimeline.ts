import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { TIMELINE_ICON_KEYS } from "@/components/timeline/TimelineIcon";
import { useAuth } from "@/hooks/useAuth";
import {
  canEditClan,
  effectiveRole,
  useClanContext,
} from "@/hooks/useClanContext";
import { queryKeys } from "@/lib/queries/keys";
import { listEvents } from "@/lib/queries/events";
import { RESTING_PLACE_KIND_LABEL, type RestingPlaceKind } from "@/lib/queries/restingPlaces";
import { listTimelineRows, listTimelineSources } from "@/lib/queries/timeline";
import { isFeatureEnabled } from "@/lib/clanFeatures";
import { getTreeData } from "@/lib/queries/tree";
import { computeClanTimeline } from "@/lib/timeline/computeClanTimeline";
import { buildMilestones, pendingSuggestions } from "@/lib/timeline/mergeTimeline";
import {
  fromCandidates,
  fromEvents,
  fromGraves,
  fromHeritage,
} from "@/lib/timeline/suggestions";

/**
 * Nguồn dữ liệu của dòng thời gian — dùng chung cho trang và các ngăn kéo.
 *  - `milestones`: dòng thời gian THẬT, chỉ gồm các mốc đã lưu (dữ liệu riêng, không phụ thuộc cây);
 *  - `suggestions`: gợi ý dựng từ gia phả mà người dùng có thể chọn đưa vào (khi chọn thì sao chép thành mốc).
 */
export function useClanTimeline(opts: { personId?: string | null; all?: boolean } = {}) {
  const personId = opts.personId ?? null;
  /** Màn quản lý: mọi mốc (poster dòng họ + của từng người) kèm danh sách người để hiện tên. */
  const all = !personId && !!opts.all;
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const canEdit = canEditClan(clan);

  const rowsQ = useQuery({
    queryKey: queryKeys.timelineRows(clan.id, userId, personId ?? (all ? "*" : null)),
    queryFn: () => listTimelineRows(clan.id, { personId, all }),
    enabled: !!userId,
    refetchOnMount: "always",
  });

  // Cây chỉ cần cho gợi ý và ảnh người đại diện → chỉ tải khi người dùng sửa được, hoặc khi có mốc kèm ảnh người.
  const treeSource =
    effectiveRole(clan) === null ? "persons_public_safe" : "persons";
  const rows = rowsQ.data;
  const needTree = !personId && (all || canEdit || !!rows?.some((r) => r.photo_person_id));
  const treeQ = useQuery({
    queryKey: queryKeys.treeData(clan.id, userId, treeSource),
    queryFn: () => getTreeData(clan.id, treeSource),
    enabled: !!userId && needTree,
  });
  // Nguồn gợi ý khác (chỉ tải khi người dùng sửa được): sự kiện, mộ phần, di sản.
  const wantHeritage = isFeatureEnabled(clan.disabled_features, "heritage");
  const wantGraves = isFeatureEnabled(clan.disabled_features, "graves");
  const eventsQ = useQuery({
    queryKey: queryKeys.events(clan.id, userId),
    queryFn: () => listEvents(clan.id),
    enabled: !!userId && canEdit && !personId,
  });
  const sourcesQ = useQuery({
    queryKey: queryKeys.timelineSources(clan.id, userId),
    queryFn: () => listTimelineSources(clan.id),
    enabled: !!userId && canEdit && !personId && (wantHeritage || wantGraves),
  });
  const persons = useMemo(() => treeQ.data?.persons ?? [], [treeQ.data]);

  const milestones = useMemo(
    () => buildMilestones(rows ?? [], TIMELINE_ICON_KEYS),
    [rows],
  );
  const suggestions = useMemo(() => {
    if (!canEdit || personId) return [];
    const all = [
      ...fromCandidates(
        computeClanTimeline(persons, { generationOffset: clan.generation_offset }),
      ),
      ...fromEvents(eventsQ.data ?? []),
      ...(wantHeritage ? fromHeritage(sourcesQ.data?.heritage ?? []) : []),
      ...(wantGraves
        ? fromGraves(sourcesQ.data?.graves ?? [], (g) => {
            const k = (sourcesQ.data?.graves.find((x) => x.id === g.id)?.kind ?? "") as RestingPlaceKind;
            return RESTING_PLACE_KIND_LABEL[k] ?? "";
          })
        : []),
    ];
    return pendingSuggestions(all, rows ?? []).sort((a, b) => a.year - b.year);
  }, [canEdit, personId, persons, rows, clan.generation_offset, eventsQ.data, sourcesQ.data, wantHeritage, wantGraves]);

  return {
    clan,
    userId,
    persons,
    milestones,
    suggestions,
    isLoading: rowsQ.isLoading,
    suggestionsLoading: canEdit && (treeQ.isLoading || eventsQ.isLoading || sourcesQ.isLoading),
    canEdit,
  };
}
