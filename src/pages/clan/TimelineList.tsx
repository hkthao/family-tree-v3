import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { Chip } from "@/components/Chip";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Fab } from "@/components/Fab";
import { FilterableSelect } from "@/components/FilterableSelect";
import {
  IconCalendar,
  IconTrash,
  IconTree,
  IconUser,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Label } from "@/components/ui/label";
import {
  LIST_PAGE_SIZE_OPTIONS,
  useClientPaging,
  useSearchBox,
} from "@/hooks/useClientPaging";
import { useClanTimeline } from "@/hooks/useClanTimeline";
import { queryKeys } from "@/lib/queries/keys";
import { deletePersonTimeline } from "@/lib/queries/timeline";
import { unaccent } from "@/lib/unaccent";

import { t } from "@lingui/core/macro";

interface TimelineItem {
  key: string;
  /** null = dòng thời gian của cả dòng họ. */
  personId: string | null;
  title: string;
  count: number;
  from: number | null;
  to: number | null;
  /** Số mốc của người này đang hiện trên poster dòng họ. */
  onClanCount: number;
}

/**
 * Trang "Dòng thời gian": danh sách các DÒNG THỜI GIAN — một cho cả dòng họ và mỗi thành viên có mốc một cái.
 * Quản lý theo từng dòng thời gian (không phải từng mốc): bấm một mục mở trang chi tiết poster; thêm dòng thời gian
 * cho một thành viên bằng nút nổi; xoá cả dòng thời gian của một người. Mốc được thêm / sửa ở trang chi tiết.
 */
export default function TimelineList() {
  const { clan, userId, persons, milestones, isLoading, canEdit } = useClanTimeline({ all: true });
  const confirm = useConfirm();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { q: query, text: queryText, setText: setQueryText } = useSearchBox();
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState("");

  const nameOf = useMemo(() => new Map(persons.map((p) => [p.id, p.full_name])), [persons]);

  const items = useMemo(() => {
    const years = (ms: typeof milestones) => {
      const ys = ms.map((m) => m.year);
      return ys.length ? ([Math.min(...ys), Math.max(...ys)] as const) : ([null, null] as const);
    };
    const clanMs = milestones.filter((m) => m.onClan);
    const [cf, ct] = years(clanMs);
    const out: TimelineItem[] = [
      { key: "clan", personId: null, title: clan.name, count: clanMs.length, from: cf, to: ct, onClanCount: clanMs.length },
    ];
    const byPerson = new Map<string, typeof milestones>();
    for (const m of milestones) {
      if (!m.personId) continue;
      byPerson.set(m.personId, [...(byPerson.get(m.personId) ?? []), m]);
    }
    const people = [...byPerson.entries()].map(([pid, ms]) => {
      const [f, to] = years(ms);
      return {
        key: pid,
        personId: pid,
        title: nameOf.get(pid) ?? t`(người đã xoá)`,
        count: ms.length,
        from: f,
        to,
        onClanCount: ms.filter((m) => m.onClan).length,
      } satisfies TimelineItem;
    });
    people.sort((a, b) => a.title.localeCompare(b.title, "vi"));
    return [...out, ...people];
  }, [milestones, clan.name, nameOf]);

  const filtered = useMemo(() => {
    const needle = unaccent(query.trim()).toLowerCase();
    return needle ? items.filter((i) => unaccent(i.title).toLowerCase().includes(needle)) : items;
  }, [items, query]);
  const paging = useClientPaging(filtered, 20);

  // Người chưa có dòng thời gian riêng → có thể tạo.
  const withTimeline = useMemo(() => new Set(items.map((i) => i.personId).filter(Boolean) as string[]), [items]);
  const createOptions = useMemo(
    () =>
      persons
        .filter((p) => !withTimeline.has(p.id))
        .map((p) => ({
          value: p.id,
          label: [
            p.full_name,
            p.generation !== null ? t`Đời ${p.generation}` : null,
            p.birth_date ? t`sinh ${p.birth_date.slice(0, 4)}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
    [persons, withTimeline],
  );

  const remove = useMutation({
    mutationFn: (personId: string) => deletePersonTimeline(clan.id, personId),
    onSuccess: () => {
      toast.success(t`Đã xoá dòng thời gian`);
      qc.invalidateQueries({ queryKey: queryKeys.timelineRows(clan.id, userId) });
    },
    onError: (e) => toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  async function onDelete(i: TimelineItem) {
    if (!i.personId) return;
    const ok = await confirm({
      title: t`Xoá dòng thời gian của ${i.title}?`,
      description:
        i.onClanCount > 0
          ? t`${i.count - i.onClanCount} mốc chỉ có ở trang người này sẽ bị xoá. ${i.onClanCount} mốc đang hiện trên poster dòng họ được giữ lại cho dòng họ.`
          : t`Toàn bộ ${i.count} mốc của người này sẽ bị xoá.`,
      confirmLabel: t`Xoá`,
      destructive: true,
    });
    if (ok) remove.mutate(i.personId);
  }

  const href = (i: TimelineItem) =>
    `/clans/${clan.id}/timeline/${i.personId ? `p/${i.personId}` : "clan"}`;

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: clan.name, to: `/clans/${clan.id}` }, { label: t`Dòng thời gian` }]} />
      <PageHeader
        icon={<IconCalendar className="h-7 w-7" />}
        title={t`Dòng thời gian`}
        description={t`Mỗi dòng thời gian là một poster: của cả dòng họ hoặc của từng thành viên. Bấm vào một dòng để xem poster.`}
      />

      <SearchInput
        label={t`Tìm dòng thời gian`}
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
        placeholder={t`Tìm theo tên thành viên…`}
      />

      {isLoading ? (
        <p className="text-muted-foreground">{t`Đang tải…`}</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconCalendar className="h-10 w-10" />}
          title={t`Không có dòng thời gian nào khớp`}
          description={t`Thử bỏ bớt từ khoá.`}
        />
      ) : (
        <>
          <ul className="space-y-2">
            {paging.paged.map((i) => (
              <li
                key={i.key}
                className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm transition-colors hover:border-primary sm:flex-row sm:items-center sm:p-4"
              >
                <Link to={href(i)} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {i.personId ? <IconUser className="h-6 w-6" /> : <IconTree className="h-6 w-6" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-lg font-semibold leading-snug">
                      {i.personId ? i.title : t`Cả dòng họ ${i.title}`}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Chip tone={i.count > 0 ? "success" : "neutral"}>{t`${i.count} mốc`}</Chip>
                      {i.from !== null && (
                        <Chip tone="neutral">{i.from === i.to ? `${i.from}` : `${i.from} – ${i.to}`}</Chip>
                      )}
                      {i.personId && i.onClanCount > 0 && (
                        <Chip tone="neutral">{t`${i.onClanCount} mốc trên poster dòng họ`}</Chip>
                      )}
                    </span>
                  </span>
                </Link>
                {canEdit && i.personId && (
                  <Button
                    size="sm"
                    variant="destructive-outline"
                    className="w-full shrink-0 sm:w-auto"
                    disabled={remove.isPending}
                    onClick={() => onDelete(i)}
                  >
                    <IconTrash className="h-4 w-4" />
                    {t`Xoá`}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            page={paging.page}
            totalPages={paging.totalPages}
            total={paging.total}
            pageSize={paging.pageSize}
            unit={t`dòng thời gian`}
            onPageChange={paging.setPage}
            pageSizeOptions={LIST_PAGE_SIZE_OPTIONS}
            onPageSizeChange={paging.setPageSize}
          />
        </>
      )}

      {canEdit && <Fab label={t`Thêm dòng thời gian`} onClick={() => setCreating(true)} />}
      <SidePanel
        open={creating}
        title={t`Thêm dòng thời gian`}
        subtitle={t`Tạo dòng thời gian riêng cho một thành viên. Sau đó thêm các mốc trong đời người đó.`}
        onClose={() => setCreating(false)}
        guard={false}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tl-create-person" required>{t`Thành viên`}</Label>
            <FilterableSelect
              id="tl-create-person"
              icon={<IconUser />}
              value={pick}
              onChange={setPick}
              options={createOptions}
              emptyLabel={t`Chọn thành viên`}
              filterPlaceholder={t`Gõ tên để tìm (không cần dấu)`}
              filterLabel={t`Tìm thành viên`}
              className="h-12 text-base"
            />
            <p className="text-sm text-muted-foreground">
              {createOptions.length === 0
                ? t`Mọi thành viên đều đã có dòng thời gian.`
                : t`Chỉ hiện những thành viên chưa có dòng thời gian riêng.`}
            </p>
          </div>
          <FormActions>
            <Button type="button" size="sm" variant="outline" onClick={() => setCreating(false)}>
              {t`Hủy`}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!pick}
              onClick={() => {
                setCreating(false);
                navigate(`/clans/${clan.id}/timeline/p/${pick}`);
                setPick("");
              }}
            >
              {t`Tạo và mở poster`}
            </Button>
          </FormActions>
        </div>
      </SidePanel>
    </div>
  );
}
