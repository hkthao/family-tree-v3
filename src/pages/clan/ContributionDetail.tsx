import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { useConfirm } from "@/components/ConfirmDialog";
import { ContributionDiffView } from "@/components/ContributionDiffView";
import { useToast } from "@/components/Toast";
import { IconCheck, IconX } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import {
  approveContribution,
  getContribution,
  rejectContribution,
  type ContributionStatus,
} from "@/lib/queries/contributions";
import { queryKeys } from "@/lib/queries/keys";
import { getPerson } from "@/lib/queries/persons";

const TYPE_LABEL = {
  edit_person: "Sửa thông tin",
  add_note: "Bổ sung tiểu sử",
  add_person: "Thêm người mới",
};

const STATUS_LABEL: Record<ContributionStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
  needs_info: "Cần thêm thông tin",
};

/**
 * /clans/:id/contributions/:contribId — full review of one
 * contribution. Shows the side-by-side diff, the submitter's
 * attribution, and (for pending items) Approve / Reject / Needs-info
 * actions. Only clan admin can approve; editor sees the page but the
 * RPCs reject non-admin callers at the SQL layer.
 */
export default function ContributionDetail() {
  const { contribId } = useParams<{ contribId: string }>();
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();
  const askConfirm = useConfirm();

  const canView = canEditClan(clan);
  const canAct = isClanAdmin(clan);

  if (!canView) {
    return <Navigate to={`/clans/${clan.id}`} replace />;
  }

  const { data: contribution, isLoading, error } = useQuery({
    queryKey: queryKeys.contribution(contribId ?? "", userId),
    queryFn: () => getContribution(contribId!),
    enabled: !!contribId,
  });

  // Current state of the target person — drives the "Hiện tại"
  // column in the diff. Null when contribution is add_person (no
  // target yet) or when the target was soft-deleted.
  const { data: currentPerson } = useQuery({
    queryKey: queryKeys.person(contribution?.person_id ?? "", userId),
    queryFn: () => getPerson(contribution!.person_id!),
    enabled: !!contribution?.person_id,
  });

  const approveM = useMutation({
    mutationFn: () => approveContribution(contribId!),
    onSuccess: async () => {
      await invalidateClanData(qc, clan.id);
      qc.invalidateQueries({
        queryKey: queryKeys.contribution(contribId!, userId),
      });
      qc.invalidateQueries({ queryKey: ["contributions", clan.id] });
      qc.invalidateQueries({
        queryKey: queryKeys.pendingContributionsCount(clan.id, userId),
      });
      toast.success("Đã duyệt — cây gia phả đã cập nhật");
    },
    onError: (e) =>
      toast.error("Không duyệt được", { description: (e as Error).message }),
  });

  const rejectM = useMutation({
    mutationFn: (args: { status: "rejected" | "needs_info"; note: string }) =>
      rejectContribution(contribId!, args.status, args.note || null),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.contribution(contribId!, userId),
      });
      qc.invalidateQueries({ queryKey: ["contributions", clan.id] });
      qc.invalidateQueries({
        queryKey: queryKeys.pendingContributionsCount(clan.id, userId),
      });
      toast.success("Đã ghi nhận");
    },
    onError: (e) =>
      toast.error("Không xử lý được", { description: (e as Error).message }),
  });

  const [rejectNote, setRejectNote] = useState("");

  return (
    <div className="space-y-5">
      <nav>
        <BackLink fallback={`/clans/${clan.id}/contributions`} />
      </nav>

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}
      {!isLoading && !contribution && (
        <Alert variant="destructive">
          <AlertDescription>Không tìm thấy đóng góp này.</AlertDescription>
        </Alert>
      )}

      {contribution && (
        <>
          <header className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {TYPE_LABEL[contribution.contribution_type]}
            </p>
            <h1 className="clan-name text-xl sm:text-2xl font-semibold">
              {contribution.person_id && currentPerson
                ? currentPerson.full_name
                : (contribution.proposed_data as { full_name?: string })
                    .full_name ?? "Người mới"}
            </h1>
            <p className="text-sm">
              Trạng thái:{" "}
              <span
                className={
                  contribution.status === "approved"
                    ? "text-accent font-medium"
                    : contribution.status === "rejected"
                      ? "text-destructive font-medium"
                      : contribution.status === "needs_info"
                        ? "text-muted-foreground font-medium"
                        : "text-amber-600 dark:text-amber-400 font-medium"
                }
              >
                {STATUS_LABEL[contribution.status]}
              </span>
            </p>
          </header>

          {/* Submitter info */}
          <Card>
            <CardHeader>
              <CardTitle>Người đóng góp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row
                label="Tên"
                value={contribution.submitter_name ?? "(thành viên đã đăng nhập)"}
              />
              {contribution.submitter_contact && (
                <Row label="Liên hệ" value={contribution.submitter_contact} />
              )}
              {contribution.submitter_relation && (
                <Row label="Quan hệ" value={contribution.submitter_relation} />
              )}
              {contribution.submitter_note && (
                <Row label="Ghi chú" value={contribution.submitter_note} />
              )}
              <Row
                label="Gửi lúc"
                value={new Date(contribution.created_at).toLocaleString("vi-VN")}
              />
              {contribution.submitter_user_id === null && (
                <p className="text-xs text-muted-foreground italic">
                  Đề xuất gửi qua link chia sẻ (khách).
                </p>
              )}
            </CardContent>
          </Card>

          {/* Diff */}
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">So sánh</h2>
            <ContributionDiffView
              contribution={contribution}
              currentPerson={currentPerson ?? null}
            />
          </section>

          {/* If already resolved, show the review note */}
          {contribution.status !== "pending" && (
            <Alert>
              <AlertDescription>
                Đã được xử lý lúc{" "}
                {contribution.reviewed_at
                  ? new Date(contribution.reviewed_at).toLocaleString("vi-VN")
                  : "—"}
                {contribution.review_note && (
                  <>
                    {". Ghi chú: "}
                    <span className="font-medium">
                      {contribution.review_note}
                    </span>
                  </>
                )}
                {contribution.status === "approved" && contribution.person_id && (
                  <>
                    {" · "}
                    <Link
                      to={`/clans/${clan.id}/people/${contribution.person_id}`}
                      className="text-primary hover:underline"
                    >
                      Xem trang người đã được cập nhật →
                    </Link>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions — only for pending + admin */}
          {contribution.status === "pending" && canAct && (
            <Card>
              <CardHeader>
                <CardTitle>Xử lý</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full sm:w-auto"
                  disabled={approveM.isPending || rejectM.isPending}
                  onClick={async () => {
                    const ok = await askConfirm({
                      title: "Duyệt đóng góp?",
                      description:
                        contribution.contribution_type === "edit_person"
                          ? "Các trường đã đổi sẽ ghi đè dữ liệu hiện tại. Tiếp tục?"
                          : contribution.contribution_type === "add_person"
                            ? "Người mới sẽ được thêm vào cây gia phả. Tiếp tục?"
                            : "Nội dung sẽ được nối vào tiểu sử hiện tại. Tiếp tục?",
                      confirmLabel: "Duyệt",
                    });
                    if (ok) approveM.mutate();
                  }}
                >
                  <IconCheck className="h-4 w-4 mr-1.5" />
                  {approveM.isPending ? "Đang duyệt…" : "Duyệt + áp dụng"}
                </Button>

                <div className="pt-3 border-t space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Hoặc từ chối / yêu cầu thêm thông tin (gửi cho người đóng góp lý do):
                  </p>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="VD: Cần ảnh giấy chứng tử để xác nhận ngày mất"
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={approveM.isPending || rejectM.isPending}
                      onClick={() =>
                        rejectM.mutate({
                          status: "needs_info",
                          note: rejectNote.trim(),
                        })
                      }
                    >
                      Cần thêm thông tin
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      disabled={approveM.isPending || rejectM.isPending}
                      onClick={async () => {
                        const ok = await askConfirm({
                          title: "Từ chối đóng góp?",
                          description:
                            "Đóng góp sẽ bị đánh dấu rejected. Người gửi vẫn thấy nó.",
                          confirmLabel: "Từ chối",
                          destructive: true,
                        });
                        if (ok)
                          rejectM.mutate({
                            status: "rejected",
                            note: rejectNote.trim(),
                          });
                      }}
                    >
                      <IconX className="h-4 w-4 mr-1.5" />
                      Từ chối
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {contribution.status === "pending" && !canAct && (
            <Alert>
              <AlertDescription>
                Chỉ admin của dòng họ mới duyệt/từ chối được. Bạn đang xem
                ở chế độ editor — có thể đọc nhưng không tác động.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}
