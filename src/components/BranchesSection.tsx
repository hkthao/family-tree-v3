import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconTrash,
  IconTree,
  IconX,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import {
  createBranch,
  deleteBranch,
  listBranches,
  updateBranch,
  type BranchRow,
} from "@/lib/queries/branches";
import { queryKeys } from "@/lib/queries/keys";

interface Props {
  clanId: string;
  /** When false, render read-only (viewer role). */
  canEdit: boolean;
}

/**
 * Branches (chi họ) management. Embedded inside the clan Settings page so
 * admins/editors can add, rename, or remove sub-lineages. Viewers see the
 * list only. Persons reference branches via persons.branch_id.
 */
export function BranchesSection({ clanId, canEdit }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();

  const { data: branches, isLoading } = useQuery({
    queryKey: queryKeys.branches(clanId, userId),
    queryFn: () => listBranches(clanId),
    enabled: !!userId,
  });

  const [newName, setNewName] = useState("");

  const addM = useMutation({
    mutationFn: () =>
      createBranch({ clan_id: clanId, name: newName.trim() }),
    onSuccess: async () => {
      await invalidateClanData(qc, clanId);
      toast.success("Đã thêm chi", { description: newName.trim() });
      setNewName("");
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-muted-foreground text-sm">Đang tải…</p>}

      {branches && branches.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Chưa có chi nào.{" "}
          {canEdit
            ? "Thêm chi đầu tiên ở form bên dưới — chi giúp lọc danh bạ và đăng ký thông báo riêng."
            : "Quản trị sẽ thêm sau."}
        </p>
      )}

      {branches && branches.length > 0 && (
        <ul className="divide-y border rounded-md">
          {branches.map((b) => (
            <BranchItem key={b.id} branch={b} clanId={clanId} canEdit={canEdit} />
          ))}
        </ul>
      )}

      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) addM.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="new-branch">Tên chi mới</Label>
            <Input
              id="new-branch"
              icon={<IconTree />}
              value={newName}
              maxLength={100}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Vd: Chi cả"
            />
          </div>
          {/* Hành động xuống hàng riêng, căn phải — xem
              docs/design-language.md §Đặt hành động ở đâu. Đứng cạnh ô
              nhập thì trên màn hẹp nó bóp ô còn vài ký tự. */}
          <div className="flex justify-end border-t pt-3">
            <Button type="submit" disabled={!newName.trim() || addM.isPending}>
              {addM.isPending ? (
                "Đang thêm…"
              ) : (
                <>
                  <IconPlus className="h-4 w-4 mr-1.5" />
                  Thêm chi
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {addM.error && (
        <Alert variant="destructive">
          <AlertDescription>{(addM.error as Error).message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function BranchItem({
  branch,
  clanId,
  canEdit,
}: {
  branch: BranchRow;
  clanId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(branch.name);

  const renameM = useMutation({
    mutationFn: () => updateBranch(branch.id, { name }),
    onSuccess: async () => {
      await invalidateClanData(qc, clanId);
      toast.success("Đã đổi tên chi");
      setEditing(false);
    },
    onError: (e) =>
      toast.error("Không đổi được", { description: (e as Error).message }),
  });

  const delM = useMutation({
    mutationFn: () => deleteBranch(branch.id),
    onSuccess: () => {
      invalidateClanData(qc, clanId);
      toast.success(`Đã xoá chi "${branch.name}"`);
    },
    onError: (e) =>
      toast.error("Không xoá được", { description: (e as Error).message }),
  });

  if (!canEdit) {
    return (
      <li className="px-3 py-2.5">
        <span>{branch.name}</span>
      </li>
    );
  }

  return (
    <li className="px-3 py-2.5">
      {editing ? (
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Input
            icon={<IconTree />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!name.trim() || renameM.isPending || name === branch.name}
              onClick={() => renameM.mutate()}
            >
              <IconCheck className="h-4 w-4 mr-1.5" />
              Lưu
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setName(branch.name);
              }}
            >
              <IconX className="h-4 w-4 mr-1.5" />
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="flex-1 min-w-0 truncate">{branch.name}</span>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <IconPencil className="h-4 w-4 mr-1" />
              Sửa
            </Button>
            <Button
              size="sm"
              variant="destructive-outline"
              disabled={delM.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: `Xoá chi "${branch.name}"?`,
                  description:
                    "Các người đang thuộc chi này sẽ không còn chi.",
                  confirmLabel: "Xoá",
                  destructive: true,
                });
                if (ok) delM.mutate();
              }}
            >
              {delM.isPending ? (
                "Đang xoá…"
              ) : (
                <>
                  <IconTrash className="h-4 w-4 mr-1" />
                  Xoá
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
