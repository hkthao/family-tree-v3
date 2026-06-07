import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { IconGrid, IconList } from "@/components/icons";
import { InlawMiniTree } from "@/components/InlawMiniTree";
import { PersonAvatar } from "@/components/PersonAvatar";
import {
  getInlawPeerRelatives,
  type InlawFocalCard,
  type InlawPeerRelatives,
  type InlawRelativeCard,
} from "@/lib/queries/person-links";
import { cn } from "@/lib/utils";

/**
 * Renders a peer person + their parents / spouses / children as a
 * compact "mini family" view, fetched via get_inlaw_peer_relatives.
 *
 * Used wherever the user wants to peek at the other side of a
 * confirmed in-law link without leaving their own clan's tree —
 * Tree.tsx badge dialog and PersonDetail's link card both embed it.
 * Living relatives in a clan that hides them appear masked.
 */
export function InlawFamilyCard({ linkId }: { linkId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["inlaw-peer-relatives", linkId],
    queryFn: () => getInlawPeerRelatives(linkId),
  });
  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">Đang tải gia đình bên đó…</p>
    );
  if (error)
    return (
      <p className="text-sm text-destructive">
        Không lấy được dữ liệu — {(error as Error).message}
      </p>
    );
  if (!data) return null;
  return <FamilyView data={data} />;
}

function FamilyView({ data }: { data: InlawPeerRelatives }) {
  const [view, setView] = useState<"list" | "tree">("list");
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          {data.peer_clan_name}
        </p>
        <div
          className="inline-flex rounded-md border bg-card overflow-hidden"
          role="group"
          aria-label="Chế độ hiển thị"
        >
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            title="Danh sách"
            className={cn(
              "inline-flex items-center justify-center w-8 h-8",
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted/50",
            )}
          >
            <IconList className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("tree")}
            aria-pressed={view === "tree"}
            title="Cây gia phả"
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 border-l",
              view === "tree"
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted/50",
            )}
          >
            <IconGrid className="h-4 w-4" />
          </button>
        </div>
      </header>

      {view === "tree" ? (
        <InlawMiniTree data={data} />
      ) : (
        <FamilyListView data={data} />
      )}
    </div>
  );
}

function FamilyListView({ data }: { data: InlawPeerRelatives }) {
  return (
    <div className="space-y-4">
      {data.parents.length > 0 && (
        <RelativeGroup
          label="Cha mẹ"
          rows={data.parents}
          peerClanId={data.peer_clan_id}
          callerIsMember={data.peer.caller_can_visit}
        />
      )}

      <FocalRow focal={data.peer} peerClanId={data.peer_clan_id} />

      {data.spouses.length > 0 && (
        <RelativeGroup
          label="Vợ / chồng"
          rows={data.spouses}
          peerClanId={data.peer_clan_id}
          callerIsMember={data.peer.caller_can_visit}
        />
      )}
      {data.children.length > 0 && (
        <RelativeGroup
          label="Con"
          rows={data.children}
          peerClanId={data.peer_clan_id}
          callerIsMember={data.peer.caller_can_visit}
        />
      )}

      {data.parents.length === 0 &&
        data.spouses.length === 0 &&
        data.children.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Bên kia chưa nhập cha mẹ, vợ/chồng, hoặc con cho người này.
          </p>
        )}
    </div>
  );
}

// ─── Focal row (peer person itself) ──────────────────────────────────

function FocalRow({
  focal,
  peerClanId,
}: {
  focal: InlawFocalCard;
  peerClanId: string;
}) {
  return (
    <div className="rounded-md border-2 border-primary bg-primary/5 p-3 flex items-center gap-3">
      <PersonAvatar gender={focal.gender} photoUrl={null} size={48} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {focal.masked ? "Người còn sống" : (focal.full_name ?? "—")}
        </p>
        <p className="text-xs text-muted-foreground">
          {focal.masked ? "Họ này chưa công khai" : metaLine(focal)}
        </p>
      </div>
      {!focal.masked && focal.caller_can_visit && (
        <Link
          to={`/clans/${peerClanId}/people/${focal.id}`}
          className="text-sm text-primary hover:underline whitespace-nowrap"
        >
          Xem →
        </Link>
      )}
    </div>
  );
}

// ─── Relative group (parents / spouses / children) ───────────────────

function RelativeGroup({
  label,
  rows,
  peerClanId,
  callerIsMember,
}: {
  label: string;
  rows: InlawRelativeCard[];
  peerClanId: string;
  callerIsMember: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.id}>
            <RelativeRow
              row={r}
              peerClanId={peerClanId}
              callerIsMember={callerIsMember}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RelativeRow({
  row,
  peerClanId,
  callerIsMember,
}: {
  row: InlawRelativeCard;
  peerClanId: string;
  callerIsMember: boolean;
}) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5",
        callerIsMember && !row.masked && "hover:border-primary transition-colors",
      )}
    >
      <PersonAvatar gender={row.gender} photoUrl={null} size={28} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {row.masked ? "Người còn sống" : (row.full_name ?? "—")}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {row.masked ? "chưa công khai" : metaLine(row)}
        </p>
      </div>
    </div>
  );
  if (callerIsMember && !row.masked) {
    return (
      <Link to={`/clans/${peerClanId}/people/${row.id}`} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

function metaLine(p: InlawRelativeCard): string {
  const bits: string[] = [];
  bits.push(p.gender === "M" ? "Nam" : "Nữ");
  if (p.generation) bits.push(`Đời ${p.generation}`);
  if (p.birth_year && p.death_year) {
    bits.push(`${p.birth_year}–${p.death_year}`);
  } else if (p.birth_year) {
    bits.push(`sinh ${p.birth_year}`);
  } else if (p.death_year) {
    bits.push(`mất ${p.death_year}`);
  } else if (!p.is_living) {
    bits.push("đã mất");
  }
  return bits.join(" · ");
}
