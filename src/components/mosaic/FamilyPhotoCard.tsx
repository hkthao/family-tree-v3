import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { IconCamera } from "@/components/icons";
import { SectionCard } from "@/components/SectionCard";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { MosaicBoard } from "@/components/mosaic/MosaicBoard";
import { MosaicFrame } from "@/components/mosaic/MosaicFrame";
import { listMosaicSummaries, listMosaicTiles } from "@/lib/queries/mosaics";

/**
 * Thẻ "Ảnh gia đình" ở màn Tổng quan: bức ghép được chọn hiển thị (hoặc bức đầu danh sách) (dải ảnh xem trước + số
 * mảnh). Chưa có bức nào thì chỉ admin/biên tập thấy lời mời tạo; thành viên thường không
 * thấy thẻ rỗng.
 */
export function FamilyPhotoCard({
  clanId,
  userId,
}: {
  clanId: string;
  userId: string;
}) {
  const { clan } = useClanContext();
  const canEdit = canEditClan(clan);
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["mosaics", clanId, userId, "summary"],
    queryFn: () => listMosaicSummaries(clanId),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Bức được chọn hiển thị ở Tổng quan; không có thì lấy bức đầu tiên trong danh sách.
  const latest = data?.find((m) => m.show_on_dashboard) ?? data?.[0];
  // Vẽ cả bức (mọi mảnh) ngay trên thẻ — không chỉ vài ảnh đầu.
  const { data: tiles } = useQuery({
    queryKey: ["mosaic-tiles", latest?.id, userId],
    queryFn: () => listMosaicTiles(latest!.id),
    enabled: !!latest && !!userId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (!latest && !canEdit) return null;
  if (data === undefined) return null;

  const base = `/clans/${clanId}/mosaics`;

  return (
    <SectionCard
      id="family-photo"
      icon={<IconCamera />}
      title="Ảnh gia đình"
      action={latest ? `${data.length} bức` : undefined}
      footer={
        <Link
          to={latest ? `${base}/${latest.id}` : base}
          className="shrink-0 text-sm text-primary hover:underline"
        >
          {latest ? "Xem bức ảnh →" : "Tạo bức ảnh →"}
        </Link>
      }
    >
      {latest ? (
        <div className="space-y-2">
          <MosaicFrame>
            <MosaicBoard
              seed={latest.id}
              variant="grid"
              cols={latest.cols}
              slots={latest.slots}
              tiles={tiles ?? []}
              arrange={false}
              canMove={() => false}
              canAdd={false}
              onSelect={() => navigate(`${base}/${latest.id}`)}
              onAdd={() => undefined}
              onMove={() => undefined}
            />
          </MosaicFrame>
          <p className="text-sm">
            <span className="font-medium">{latest.title}</span>
            <span className="text-muted-foreground">
              {" "}
              · {latest.tileCount}/{latest.slots} mảnh
              {latest.status === "open" ? " · đang nhận ảnh" : ""}
            </span>
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Mỗi thành viên góp một tấm ảnh, ghép thành bức tranh chung của dòng
          họ. Tạo bức đầu tiên để cả nhà cùng góp.
        </p>
      )}
    </SectionCard>
  );
}
