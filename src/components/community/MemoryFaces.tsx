import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { FaceTagger } from "@/components/community/FaceTagger";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";
import {
  addFace,
  deleteFace,
  listFaces,
  setFaceStatus,
  type FaceStatus,
  type PersonMemory,
} from "@/lib/queries/community";
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData } from "@/lib/queries/tree";

import { t } from "@lingui/core/macro";

/**
 * Ảnh "đây là ai?" trong app (thành viên): khoanh mặt + gắn người trong cây / ghi tên; editor+
 * xác nhận, bác, xoá. Người gắn tự xoá được khung của mình.
 */
export function MemoryFaces({
  memory,
  canModerate,
}: {
  memory: Pick<PersonMemory, "id" | "clan_id" | "media_url" | "body">;
  canModerate: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["photo-faces", memory.id] as const;
  const { data: faces = [] } = useQuery({ queryKey: key, queryFn: () => listFaces(memory.id) });
  const { data: tree } = useQuery({
    queryKey: queryKeys.treeData(memory.clan_id, userId, "persons"),
    queryFn: () => getTreeData(memory.clan_id, "persons"),
    enabled: !!userId,
  });
  const options = useMemo(
    () =>
      [...(tree?.persons ?? [])]
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"))
        .map((p) => ({ value: p.id, label: `${p.full_name}${p.is_living ? "" : " †"}` })),
    [tree],
  );
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["clan-memories", memory.clan_id] });
    void qc.invalidateQueries({ queryKey: ["pending-faces", memory.clan_id] });
  };
  const add = useMutation({
    mutationFn: (input: Parameters<typeof addFace>[0]) => addFace(input),
    onSuccess: () => {
      refresh();
      toast.success(canModerate ? t`Đã lưu` : t`Đã gửi, chờ người quản lý xác nhận`);
    },
    onError: (e) => toast.error(t`Chưa lưu được`, { description: (e as Error).message }),
  });
  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: FaceStatus }) => setFaceStatus(id, s),
    onSuccess: refresh,
    onError: (e) => toast.error(t`Không cập nhật được`, { description: (e as Error).message }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFace(id),
    onSuccess: refresh,
    onError: (e) => toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  if (!memory.media_url) return null;
  // Đã bác thì ẩn khỏi người thường; người quản lý vẫn thấy (để khỏi bác lại cùng gợi ý).
  const shown = faces.filter((f) => f.status !== "rejected" || canModerate);

  return (
    <FaceTagger
      src={memory.media_url}
      alt={memory.body ?? t`Ảnh nhờ nhận diện`}
      canAdd
      canModerate={canModerate}
      submitting={add.isPending}
      personOptions={options}
      faces={shown.map((f) => ({
        id: f.id,
        box: f.box,
        confirmed: f.status === "confirmed",
        label: f.person_name ?? f.suggested_name,
        note: f.suggested_note,
        detail:
          f.status === "rejected"
            ? t`Đã bác · ${f.tagger_label} gợi ý`
            : f.status === "suggested"
              ? t`Chờ xác nhận · ${f.tagger_label} gợi ý`
              : t`Đã xác nhận · ${f.tagger_label}`,
        canDelete: f.tagged_by === userId,
      }))}
      onSubmit={(f) => add.mutateAsync({ memory_id: memory.id, ...f })}
      onConfirm={(id) => status.mutate({ id, s: "confirmed" })}
      onReject={(id) => status.mutate({ id, s: "rejected" })}
      onDelete={(id) => remove.mutate(id)}
    />
  );
}
