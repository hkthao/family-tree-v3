import { ClanOgPanel } from "@/components/ClanOgPanel";
import { t } from "@lingui/core/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { useConfirm } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import {
  IconCheck,
  IconClock,
  IconCopy,
  IconGrave,
  IconMail,
  IconPlus,
  IconQrCode,
  IconScroll,
  IconSearch,
  IconShare2,
  IconTrash,
  IconTree,
  IconUndo,
  IconUser,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { makeQrDataUrl } from "@/lib/cards/exportCard";
import { listHeritageItems } from "@/lib/queries/heritage";
import { createContributeLink } from "@/lib/queries/community";
import { listRestingPlaces } from "@/lib/queries/restingPlaces";
import {
  endCardNow,
  extendCardExpiry,
  extendShareLinkExpiry,
  loadShareHub,
} from "@/lib/queries/share-hub";
import {
  createShareLink,
  deleteShareLink,
  revokeShareLink,
} from "@/lib/queries/share-links";
import { supabase } from "@/lib/supabase";
import {
  buildHubItems,
  daysUntil,
  filterHubItems,
  hubItemUrl,
  hubStats,
  hubStatus,
  HUB_KINDS,
  type HubItem,
  type HubKind,
  type HubStatus,
  type StatusFilter,
} from "@/lib/shareHub";
import { menuHubPath } from "@/lib/navModel";
import { cn } from "@/lib/utils";

const KIND_LABEL = (k: HubKind): string =>
  ({
    tree: t`Link cây`,
    person: t`QR người`,
    grave: t`QR mộ`,
    heritage: t`QR di sản`,
    contribute: t`Mời góp`,
    card: t`Thiệp khoe`,
  })[k];

function KindIcon({ kind, className }: { kind: HubKind; className?: string }) {
  const I = {
    tree: IconTree,
    person: IconUser,
    grave: IconGrave,
    heritage: IconScroll,
    contribute: IconMail,
    card: IconShare2,
  }[kind];
  return <I className={className} />;
}

function StatusChip({ status, days }: { status: HubStatus; days: number }) {
  const m: Record<HubStatus, { label: string; cls: string }> = {
    active: {
      label: t`Hoạt động`,
      cls: "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300",
    },
    expiring: {
      label: t`Sắp hết hạn (${Math.max(days, 0)} ngày)`,
      cls: "border-amber-600 text-amber-700 dark:border-amber-400 dark:text-amber-300",
    },
    expired: {
      label: t`Đã hết hạn`,
      cls: "border-red-600 text-red-700 dark:border-red-400 dark:text-red-300",
    },
    revoked: {
      label: t`Đã thu hồi`,
      cls: "border-muted-foreground text-muted-foreground",
    },
  };
  const { label, cls } = m[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        cls,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Trung tâm chia sẻ — `/clans/:id/chia-se` (nằm trong "Tất cả tính năng", chỉ quản trị viên). Gom mọi link / QR / thiệp khoe của
 * dòng họ; tạo, xem chi tiết, gia hạn, thu hồi, xoá đều trong ngăn kéo bên phải.
 */
export default function ShareHub() {
  const { clan } = useClanContext();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const admin = isClanAdmin(clan);
  const [kind, setKind] = useState<HubKind | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["share-hub", clan.id],
    queryFn: () => loadShareHub(clan.id),
    enabled: admin,
  });
  const items = useMemo(
    () =>
      q.data
        ? buildHubItems(q.data.links, q.data.cards, q.data.names, {
            tree: t`Cây gia phả`,
            treeSub: t`Cả dòng họ · trang chủ`,
            person: t`Một người`,
            personSub: t`QR cá nhân`,
            place: t`Mộ phần`,
            placeSub: t`QR tại mộ`,
            item: t`Di sản`,
            heritageSub: t`QR di sản`,
            contribute: t`Mời góp`,
            contributeSub: t`Link mời góp`,
            cardSub: t`Thiệp khoe`,
          })
        : [],
    [q.data],
  );
  const shown = useMemo(
    () => filterHubItems(items, { kind, status, search }),
    [items, kind, status, search],
  );
  const stats = useMemo(() => hubStats(items), [items]);
  const selected = items.find((i) => i.key === openKey) ?? null;
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["share-hub", clan.id] });
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (!admin) return <Navigate to={`/clans/${clan.id}`} replace />;

  async function copy(i: HubItem) {
    try {
      await navigator.clipboard.writeText(hubItemUrl(origin, i));
      toast.success(t`Đã sao chép liên kết.`);
    } catch {
      toast.error(t`Không sao chép được liên kết.`);
    }
  }
  async function remove(i: HubItem) {
    const ok = await confirm({
      title: t`Xoá link này vĩnh viễn?`,
      description: t`Link và mã QR đã in sẽ không mở được nữa, không khôi phục lại được.`,
      confirmLabel: t`Xoá`,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteShareLink(i.id);
      setOpenKey(null);
      void refresh();
      toast.success(t`Đã xoá link`);
    } catch (e) {
      toast.error(t`Không xoá được`, { description: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: t`Tất cả tính năng`, to: menuHubPath(clan.id) },
          { label: t`Chia sẻ` },
        ]}
      />
      <PageHeader
        icon={<IconShare2 className="h-7 w-7" />}
        title={t`Trung tâm chia sẻ`}
        description={t`Mọi liên kết và mã QR của dòng họ ở một nơi. Chỉ quản trị viên thấy trang này.`}
        actions={
          <Button
            size="sm"
            className="px-3 text-sm"
            onClick={() => setCreating(true)}
          >
            <IconPlus className="mr-1.5 h-4 w-4" />
            {t`Tạo liên kết mới`}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label={t`Link đang hoạt động`}
          value={stats.active}
          sub={t`trên ${stats.total} link đã tạo`}
        />
        <Stat
          label={t`Lượt xem thiệp khoe`}
          value={stats.cardViews}
          sub={t`tổng từ trước đến nay`}
        />
        <Stat
          label={t`Sắp hết hạn`}
          value={stats.expiring}
          sub={t`trong 7 ngày`}
        />
      </div>

      <ClanOgPanel clan={clan} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b">
        <div
          role="tablist"
          aria-label={t`Loại liên kết`}
          className="flex gap-4 overflow-x-auto"
        >
          {(["all", ...HUB_KINDS] as const).map((k) => (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "min-h-11 whitespace-nowrap border-b-2 px-1 text-sm",
                kind === k
                  ? "border-primary font-semibold"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {k === "all" ? t`Tất cả` : KIND_LABEL(k)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-1.5">
          <Input
            icon={<IconSearch />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t`Tìm theo tên…`}
            aria-label={t`Tìm theo tên`}
            className="h-9 w-48 text-sm"
          />
          <select
            aria-label={t`Trạng thái`}
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="active">{t`Đang hoạt động`}</option>
            <option value="ended">{t`Hết hạn / thu hồi`}</option>
            <option value="all">{t`Tất cả trạng thái`}</option>
          </select>
        </div>
      </div>

      {q.isLoading && <p className="text-muted-foreground">{t`Đang tải…`}</p>}
      {q.isError && (
        <p className="text-destructive">{t`Không tải được danh sách chia sẻ.`}</p>
      )}
      {q.data && shown.length === 0 && (
        <EmptyState
          icon={<IconShare2 className="h-10 w-10" />}
          title={
            items.length === 0
              ? t`Chưa có liên kết nào`
              : t`Không có liên kết phù hợp`
          }
          description={
            items.length === 0
              ? t`Tạo link cây, mã QR cho một người, mộ phần, di sản hoặc link mời người thân cùng góp.`
              : t`Thử đổi loại hoặc trạng thái đang lọc.`
          }
          primary={
            items.length === 0
              ? {
                  label: t`Tạo liên kết mới`,
                  onClick: () => setCreating(true),
                  icon: <IconPlus className="h-4 w-4" />,
                }
              : null
          }
        />
      )}
      {shown.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {shown.map((i) => {
            const st = hubStatus(i.expiresAt, i.revoked);
            return (
              <li
                key={i.key}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3",
                  openKey === i.key && "bg-muted/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenKey(i.key)}
                  className="flex min-w-0 flex-[1_1_16rem] items-center gap-3 text-left"
                  aria-label={t`Mở chi tiết ${i.title}`}
                >
                  <KindIcon
                    kind={i.kind}
                    className="h-5 w-5 shrink-0 text-accent"
                  />
                  <span className="min-w-0">
                    <span
                      className="block truncate font-semibold"
                      title={i.title}
                    >
                      {i.title}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {i.subtitle}
                    </span>
                  </span>
                </button>
                <span className="w-24 text-sm text-muted-foreground">
                  {KIND_LABEL(i.kind)}
                </span>
                <span className="w-44">
                  <StatusChip status={st} days={daysUntil(i.expiresAt)} />
                </span>
                <span
                  className="w-16 text-sm text-muted-foreground"
                  title={t`Lượt xem`}
                >
                  {i.views ?? "—"}
                </span>
                <span className="ml-auto flex gap-1.5">
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label={t`Sao chép liên kết`}
                    title={t`Sao chép liên kết`}
                    onClick={() => void copy(i)}
                  >
                    <IconCopy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label={t`Mở chi tiết và mã QR`}
                    title={t`Mã QR`}
                    onClick={() => setOpenKey(i.key)}
                  >
                    <IconQrCode className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">{t`Muốn đổi phần nào của dòng họ được hiện ra ngoài? Vào Cài đặt dòng họ › Trang dòng họ hiển thị gì.`}</p>

      <SidePanel
        open={!!selected}
        onClose={() => setOpenKey(null)}
        title={selected?.title ?? ""}
        subtitle={
          selected
            ? `${KIND_LABEL(selected.kind)} · ${selected.subtitle}`
            : undefined
        }
        guard={false}
      >
        {selected && (
          <Detail
            item={selected}
            origin={origin}
            onCopy={() => void copy(selected)}
            onChanged={() => void refresh()}
            onRemove={() => void remove(selected)}
          />
        )}
      </SidePanel>
      <SidePanel
        open={creating}
        onClose={() => setCreating(false)}
        title={t`Tạo liên kết mới`}
        subtitle={t`Chọn loại, đích và thời hạn`}
      >
        {creating && (
          <CreateForm
            clanId={clan.id}
            onDone={(key) => {
              setCreating(false);
              void refresh().then(() => key && setOpenKey(key));
            }}
          />
        )}
      </SidePanel>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="clan-name text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{sub}</div>
    </div>
  );
}

const EXTEND = [
  { d: 30, label: () => t`+1 tháng` },
  { d: 90, label: () => t`+3 tháng` },
  { d: 365, label: () => t`+1 năm` },
];

function Detail({
  item,
  origin,
  onCopy,
  onChanged,
  onRemove,
}: {
  item: HubItem;
  origin: string;
  onCopy: () => void;
  onChanged: () => void;
  onRemove: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const st = hubStatus(item.expiresAt, item.revoked);
  const url = hubItemUrl(origin, item);
  const fbUrl = hubItemUrl(origin, {
    path: item.path.replace(/^\/share\//, "/s/"),
  });
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void makeQrDataUrl(url).then((d) => live && setQr(d));
    return () => {
      live = false;
    };
  }, [url]);
  const canExtend =
    !item.revoked && (item.source === "link" || st !== "expired");

  const extend = useMutation({
    mutationFn: (days: number) =>
      item.source === "card"
        ? extendCardExpiry(item.id, item.expiresAt, days)
        : extendShareLinkExpiry(item.id, item.expiresAt, days),
    onSuccess: () => {
      onChanged();
      toast.success(t`Đã gia hạn`);
    },
    onError: (e) =>
      toast.error(t`Không gia hạn được`, { description: (e as Error).message }),
  });
  const end = useMutation({
    mutationFn: () =>
      item.source === "card" ? endCardNow(item.id) : revokeShareLink(item.id),
    onSuccess: () => {
      onChanged();
      toast.success(
        item.source === "card" ? t`Đã gỡ thiệp` : t`Đã thu hồi link`,
      );
    },
    onError: (e) =>
      toast.error(t`Không thực hiện được`, {
        description: (e as Error).message,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-white p-2">
          {qr ? (
            <img src={qr} alt={t`Mã QR`} className="h-full w-full" />
          ) : (
            <IconQrCode className="h-12 w-12 text-neutral-400" />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <StatusChip status={st} days={daysUntil(item.expiresAt)} />
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <IconClock className="h-4 w-4 shrink-0" />
            {item.revoked
              ? t`Đã thu hồi`
              : `${t`Hết hạn`} ${new Date(item.expiresAt).toLocaleDateString()}`}
          </p>
          {item.views !== null && (
            <p className="text-sm text-muted-foreground">{t`${item.views} lượt xem`}</p>
          )}
          {qr && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="px-3 text-sm"
            >
              <a href={qr} download={`qr-${item.token.slice(0, 8)}.png`}>
                <IconQrCode className="mr-1.5 h-4 w-4" />
                {t`Tải mã QR`}
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-semibold">{t`Đường dẫn`}</div>
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-sm" title={url}>
            {url}
          </code>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={t`Sao chép liên kết`}
            onClick={onCopy}
          >
            <IconCopy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {item.kind === "tree" && item.path.startsWith("/share/") && (
        <div className="space-y-1">
          <div className="text-sm font-semibold">{t`Link ngắn cho Facebook`}</div>
          <p className="text-xs text-muted-foreground">
            {t`Dùng khi đăng lên Facebook nếu link thường không hiện ảnh. Người mở vẫn vào đúng trang này.`}
          </p>
          <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-sm" title={fbUrl}>
              {fbUrl}
            </code>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label={t`Sao chép link cho Facebook`}
              onClick={() =>
                void navigator.clipboard
                  .writeText(fbUrl)
                  .then(() => toast.success(t`Đã sao chép link cho Facebook.`))
                  .catch(() => toast.error(t`Không sao chép được liên kết.`))
              }
            >
              <IconCopy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {canExtend && (
        <div className="space-y-1.5">
          <div className="text-sm font-semibold">{t`Gia hạn`}</div>
          <div className="flex flex-wrap gap-2">
            {EXTEND.map((e) => (
              <Button
                key={e.d}
                size="sm"
                variant="outline"
                className="px-3 text-sm"
                disabled={extend.isPending}
                onClick={() => extend.mutate(e.d)}
              >
                <IconPlus className="mr-1.5 h-4 w-4" />
                {e.label()}
              </Button>
            ))}
          </div>
          {item.source === "card" && (
            <p className="text-xs text-muted-foreground">{t`Thiệp khoe tối đa 90 ngày kể từ lúc gia hạn.`}</p>
          )}
        </div>
      )}

      <p className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
        {scopeNote(item.kind)}
      </p>

      <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
        {item.source === "link" ? (
          <Button
            size="sm"
            variant="outline"
            className="px-3 text-sm text-destructive"
            onClick={onRemove}
          >
            <IconTrash className="mr-1.5 h-4 w-4" />
            {t`Xoá hẳn`}
          </Button>
        ) : (
          <span />
        )}
        {!item.revoked && st !== "expired" && (
          <Button
            size="sm"
            variant="outline"
            className="px-3 text-sm"
            disabled={end.isPending}
            onClick={async () => {
              const ok = await confirm({
                title:
                  item.source === "card"
                    ? t`Gỡ thiệp này ngay?`
                    : t`Thu hồi link này?`,
                description: t`Người đang giữ link sẽ không mở được nữa.`,
                confirmLabel: item.source === "card" ? t`Gỡ` : t`Thu hồi`,
                destructive: true,
              });
              if (ok) end.mutate();
            }}
          >
            <IconUndo className="mr-1.5 h-4 w-4" />
            {item.source === "card" ? t`Gỡ thiệp` : t`Thu hồi`}
          </Button>
        )}
      </div>
    </div>
  );
}

function scopeNote(k: HubKind): string {
  switch (k) {
    case "tree":
      return t`Người mở link thấy cây gia phả và các mục dòng họ đã bật hiển thị; người còn sống luôn được ẩn.`;
    case "person":
      return t`Người mở link chỉ thấy hồ sơ của người này và người thân gần, không thấy phần còn lại của dòng họ.`;
    case "grave":
      return t`Người mở link chỉ thấy thông tin nơi an nghỉ này.`;
    case "heritage":
      return t`Người mở link chỉ thấy mục di sản này.`;
    case "contribute":
      return t`Người mở link có thể gửi ký ức, câu trả lời; mọi đóng góp chờ bạn duyệt.`;
    case "card":
      return t`Người mở link chỉ thấy tấm thiệp. Thiệp hết hạn sẽ tự được dọn.`;
  }
}

const TTLS = [
  { d: 30, label: () => t`1 tháng` },
  { d: 90, label: () => t`3 tháng` },
  { d: 365, label: () => t`1 năm` },
];
const CREATE_KINDS: Exclude<HubKind, "card">[] = [
  "tree",
  "person",
  "grave",
  "heritage",
  "contribute",
];

function CreateForm({
  clanId,
  onDone,
}: {
  clanId: string;
  onDone: (key: string | null) => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<Exclude<HubKind, "card">>("tree");
  const [ttl, setTtl] = useState(kind === "contribute" ? 30 : 365);
  const [target, setTarget] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [label, setLabel] = useState("");
  const [search, setSearch] = useState("");

  const pick = (k: typeof kind) => {
    setKind(k);
    setTarget(null);
    setSearch("");
    setTtl(k === "contribute" ? 30 : k === "tree" ? 90 : 365);
  };
  const needTarget =
    kind === "person" || kind === "grave" || kind === "heritage";

  const options = useQuery({
    queryKey: ["share-hub-options", clanId, kind, search],
    enabled: needTarget,
    queryFn: async (): Promise<{ id: string; label: string }[]> => {
      const s = search.trim().toLowerCase();
      if (kind === "person") {
        let qy = supabase
          .from("persons")
          .select("id, full_name")
          .eq("clan_id", clanId)
          .is("deleted_at", null)
          .order("full_name")
          .limit(30);
        if (s) qy = qy.ilike("full_name", `%${s}%`);
        const { data, error } = await qy;
        if (error) throw new Error(error.message);
        return (data ?? []).map((p) => ({
          id: p.id as string,
          label: p.full_name as string,
        }));
      }
      if (kind === "grave")
        return (await listRestingPlaces(clanId, { search: s }))
          .filter((p) => !s || (p.name ?? "").toLowerCase().includes(s))
          .slice(0, 30)
          .map((p) => ({ id: p.id, label: p.name ?? "" }));
      return (await listHeritageItems(clanId, { search: s }))
        .filter((h) => !s || h.title.toLowerCase().includes(s))
        .slice(0, 30)
        .map((h) => ({ id: h.id, label: h.title }));
    },
  });

  const create = useMutation({
    mutationFn: async (): Promise<string> => {
      if (kind === "contribute")
        return `link:${(await createContributeLink({ clan_id: clanId, recipient_label: label, ttlDays: ttl })).id}`;
      const base = { clan_id: clanId, ttlDays: ttl };
      const link =
        kind === "tree"
          ? await createShareLink({ ...base, scope: "tree_view" })
          : kind === "person"
            ? await createShareLink({
                ...base,
                scope: "single_person",
                root_person_id: target!.id,
              })
            : kind === "grave"
              ? await createShareLink({
                  ...base,
                  scope: "resting_place",
                  root_resting_place_id: target!.id,
                })
              : await createShareLink({
                  ...base,
                  scope: "heritage_item",
                  root_heritage_item_id: target!.id,
                });
      return `link:${link.id}`;
    },
    onSuccess: (key) => {
      toast.success(t`Đã tạo liên kết`);
      onDone(key);
    },
    onError: (e) =>
      toast.error(t`Không tạo được`, { description: (e as Error).message }),
  });

  const ttlOptions =
    kind === "contribute" ? TTLS.filter((x) => x.d <= 90) : TTLS;
  return (
    <div className="space-y-4">
      <Field label={t`Loại liên kết`}>
        <div className="flex flex-wrap gap-2">
          {CREATE_KINDS.map((k) => (
            <Button
              key={k}
              size="sm"
              variant={kind === k ? "default" : "outline"}
              className="px-3 text-sm"
              aria-pressed={kind === k}
              onClick={() => pick(k)}
            >
              <KindIcon kind={k} className="mr-1.5 h-4 w-4" />
              {KIND_LABEL(k)}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{scopeNote(kind)}</p>
      </Field>

      {needTarget && (
        <Field
          label={
            kind === "person"
              ? t`Người`
              : kind === "grave"
                ? t`Mộ phần`
                : t`Di sản`
          }
        >
          {target ? (
            <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
              <span className="min-w-0 truncate font-medium">
                {target.label}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="px-3 text-sm"
                onClick={() => setTarget(null)}
              >{t`Đổi`}</Button>
            </div>
          ) : (
            <>
              <Input
                icon={<IconSearch />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t`Gõ để tìm…`}
                aria-label={t`Tìm đích`}
                className="h-10 text-sm"
              />
              <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                {(options.data ?? []).map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className="min-h-11 w-full px-3 text-left text-sm hover:bg-muted/50"
                      onClick={() => setTarget(o)}
                    >
                      {o.label}
                    </button>
                  </li>
                ))}
                {options.data?.length === 0 && (
                  <li className="px-3 py-3 text-sm text-muted-foreground">{t`Không tìm thấy.`}</li>
                )}
              </ul>
            </>
          )}
        </Field>
      )}

      {kind === "contribute" && (
        <Field label={t`Gửi cho ai (ghi chú riêng của bạn)`}>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t`Ví dụ: Cô Ba`}
            maxLength={60}
            className="h-10 text-sm"
          />
        </Field>
      )}

      <Field label={t`Thời hạn`}>
        <div className="flex flex-wrap gap-2">
          {ttlOptions.map((x) => (
            <Button
              key={x.d}
              size="sm"
              variant={ttl === x.d ? "default" : "outline"}
              className="px-3 text-sm"
              aria-pressed={ttl === x.d}
              onClick={() => setTtl(x.d)}
            >
              {x.label()}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t`QR in ra nên để dài; link gửi tạm thì chọn ngắn.`}</p>
      </Field>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button
          size="sm"
          className="px-3 text-sm"
          disabled={create.isPending || (needTarget && !target)}
          onClick={() => create.mutate()}
        >
          <IconCheck className="mr-1.5 h-4 w-4" />
          {create.isPending ? t`Đang tạo…` : t`Tạo liên kết`}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-semibold">{label}</div>
      {children}
    </div>
  );
}
