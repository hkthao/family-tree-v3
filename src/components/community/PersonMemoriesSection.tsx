import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";

import { SectionCard } from "@/components/SectionCard";
import { SidePanel } from "@/components/SidePanel";
import { ContributeLinkPanel } from "@/components/community/ContributeLinkPanel";
import { MemoryCard } from "@/components/community/MemoryCard";
import { MemoryForm, type PersonFacts } from "@/components/community/MemoryForm";
import { IconBook, IconPlus, IconSend } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { listPersonMemories, type MemoryStatus } from "@/lib/queries/community";

import { t } from "@lingui/core/macro";

/** Gần PAGE_BTN của PersonDetail: điện thoại chia đều hàng; từ sm tối thiểu 100px, giãn theo chữ. */
const MEMORY_BTN = "min-w-0 flex-1 px-3 sm:w-auto sm:min-w-[100px] sm:flex-none";

export const personMemoriesKey = (personId: string, userId: string) =>
  ["person-memories", personId, userId] as const;

function StatusBadge({ status }: { status: MemoryStatus }) {
  if (status === "visible") return null;
  const cls =
    status === "pending"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
      : "border-muted-foreground/30 bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status === "pending" ? t`Chờ duyệt` : t`Đã ẩn`}
    </span>
  );
}

/**
 * "Người thân kể về …" ở Chi tiết người (plan §4.1): ai trong họ cũng kể được (chuyện / ảnh /
 * ghi âm); nút "Mời người khác kể" tạo link gửi người chưa có tài khoản. Duyệt / ẩn / xoá ở trang /dong-gop.
 */
export function PersonMemoriesSection({
  clanId,
  clanName,
  personId,
  personName,
  userId,
  canModerate,
  facts,
}: {
  clanId: string;
  clanName: string;
  personId: string;
  personName: string;
  userId: string;
  canModerate: boolean;
  /** Thông tin hiện có — để form có loại "Sửa thông tin" điền sẵn. */
  facts?: PersonFacts;
}) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const key = personMemoriesKey(personId, userId);

  const { data: memories = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listPersonMemories(personId),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["community-summary", clanId] });
    void qc.invalidateQueries({ queryKey: ["pending-memories", clanId] });
  };

  const visibleCount = memories.filter((m) => m.status === "visible").length;

  return (
    <>
      <SectionCard
        id="person-memories"
        icon={<IconBook />}
        title={t`Đóng góp về ${personName}`}
        action={
          visibleCount > 0 ? (
            <span className="text-xs text-muted-foreground">{t`${visibleCount} đóng góp`}</span>
          ) : undefined
        }
        footer={
          // Hai nút cùng bề rộng: điện thoại chia đôi hàng, từ sm cùng cỡ cố định, dồn phải.
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {canModerate && memories.some((m) => m.status === "pending") && (
              <Link
                to={`/clans/${clanId}/dong-gop?tt=pending`}
                className="text-sm text-primary hover:underline sm:mr-auto"
              >
                {t`Duyệt đóng góp chờ →`}
              </Link>
            )}
            {/* Cùng kiểu nút với hàng Sửa / Khoe / QR / Xoá ở trang người (PAGE_BTN): tối thiểu 100px, vừa chữ. */}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className={MEMORY_BTN}
                title={t`Mời người khác đóng góp (gửi link, không cần tài khoản)`}
                onClick={() => setInviteOpen(true)}
              >
                <IconSend className="mr-1.5 h-4 w-4 shrink-0" />
                {t`Mời góp`}
              </Button>
              <Button size="sm" className={MEMORY_BTN} onClick={() => setFormOpen(true)}>
                <IconPlus className="mr-1.5 h-4 w-4 shrink-0" />
                {t`Đóng góp`}
              </Button>
            </div>
          </div>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t`Đang tải…`}</p>
        ) : memories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t`Chưa có đóng góp về ${personName}. Bạn nhớ một kỷ niệm, có tấm ảnh cũ, hay muốn ghi âm lời ông bà? Bấm "Đóng góp" — hoặc gửi link mời người biết rõ hơn.`}
          </p>
        ) : (
          <div className="space-y-3">
            {memories.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                badge={m.status === "visible" ? undefined : <StatusBadge status={m.status} />}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SidePanel
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={t`Đóng góp về ${personName}`}
      >
        <MemoryForm
          mode="member"
          clanId={clanId}
          userId={userId}
          personId={personId}
          personName={personName}
          facts={facts}
          onCancel={() => setFormOpen(false)}
          onDone={() => {
            setFormOpen(false);
            refresh();
          }}
        />
      </SidePanel>

      <ContributeLinkPanel
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        clanId={clanId}
        clanName={clanName}
        personId={personId}
        personName={personName}
      />
    </>
  );
}
