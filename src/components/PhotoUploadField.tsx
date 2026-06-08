import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { IconTrash, IconUpload } from "@/components/icons";
import { PersonAvatar } from "@/components/PersonAvatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queries/keys";
import { updatePerson } from "@/lib/queries/persons";
import {
  deletePersonPhoto,
  getSignedPhotoUrl,
  uploadPersonPhoto,
  type UploadProgress,
} from "@/lib/photoUpload";

// File-size cushion above which we warn the user that compression
// will take a while. iPhone 13+ photos are routinely 5–8MB; anything
// past this is usually a screenshot at full resolution or a downloaded
// raw, and the user benefits from knowing it won't be instant.
const LARGE_FILE_THRESHOLD = 8 * 1024 * 1024;

interface Props {
  clanId: string;
  personId: string;
  gender: "M" | "F";
  photoPath: string | null;
  /**
   * Called after photo_path changes (either upload-success or delete).
   * The parent should refresh the person query to pick up the new
   * path; we also invalidate the relevant query keys here.
   */
  onChange?: (newPath: string | null) => void;
}

/**
 * Upload + delete control for a person's avatar. Client-side compresses
 * the image to ≤ 512px / ≤ 80 KB so a 1 GB project bucket fits
 * thousands of avatars.
 */
export function PhotoUploadField({
  clanId,
  personId,
  gender,
  photoPath,
  onChange,
}: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const [stats, setStats] = useState<{ bytes: number } | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: signedUrl } = useQuery({
    queryKey: ["signed-photo", personId, photoPath],
    queryFn: () => getSignedPhotoUrl(photoPath),
    enabled: !!photoPath,
    staleTime: 5 * 60 * 1000,
  });

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > LARGE_FILE_THRESHOLD) {
        toast.info("File khá lớn — đang nén, có thể mất vài giây", {
          description: `${Math.round(file.size / 1024 / 1024)} MB`,
        });
      }
      setProgress({ phase: "compress", percent: 0 });
      const res = await uploadPersonPhoto(clanId, personId, file, setProgress);
      await updatePerson(personId, { photo_path: res.path });
      return res;
    },
    onSuccess: async (res) => {
      setProgress(null);
      setStats({ bytes: res.bytes });
      await qc.invalidateQueries({
        queryKey: queryKeys.person(personId, userId),
      });
      await qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "signed-photo",
      });
      onChange?.(res.path);
      toast.success("Đã tải ảnh lên", {
        description: `${Math.round(res.bytes / 1024)} KB sau khi nén.`,
      });
    },
    onError: (e) => {
      setProgress(null);
      toast.error("Tải ảnh thất bại", { description: (e as Error).message });
    },
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      if (photoPath) await deletePersonPhoto(photoPath);
      await updatePerson(personId, { photo_path: null });
    },
    onSuccess: async () => {
      setStats(null);
      await qc.invalidateQueries({
        queryKey: queryKeys.person(personId, userId),
      });
      onChange?.(null);
      toast.success("Đã xoá ảnh");
    },
    onError: (e) =>
      toast.error("Xoá ảnh thất bại", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-start gap-3">
        {photoPath && signedUrl ? (
          <img
            src={signedUrl}
            alt=""
            width={96}
            height={96}
            className="rounded-full object-cover bg-muted"
          />
        ) : (
          <PersonAvatar gender={gender} size={96} />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadM.mutate(file);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={uploadM.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <IconUpload className="h-4 w-4 mr-1.5" />
            {uploadM.isPending
              ? progress?.phase === "upload"
                ? "Đang tải lên…"
                : "Đang nén ảnh…"
              : photoPath
                ? "Đổi ảnh"
                : "Tải ảnh lên"}
          </Button>
          {photoPath && (
            <Button
              type="button"
              variant="outline"
              className="text-destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: "Xoá ảnh của người này?",
                  confirmLabel: "Xoá",
                  destructive: true,
                });
                if (ok) deleteM.mutate();
              }}
              disabled={deleteM.isPending}
            >
              <IconTrash className="h-4 w-4 mr-1.5" />
              {deleteM.isPending ? "Đang xoá…" : "Xoá ảnh"}
            </Button>
          )}
        </div>
      </div>
      {progress && (
        <div className="space-y-1">
          <div className="h-1.5 w-full max-w-xs rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-150"
              style={{ width: `${Math.round(progress.percent)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress.phase === "compress"
              ? `Đang nén ảnh… ${Math.round(progress.percent)}%`
              : "Đang tải lên server…"}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Ảnh sẽ được nén còn tối đa 512×512, ≈ 80 KB (JPEG). Định dạng
        gốc: JPG, PNG, WebP, HEIC.
      </p>
      {stats && (
        <p className="text-xs text-muted-foreground">
          Đã tải lên — {Math.round(stats.bytes / 1024)} KB.
        </p>
      )}
      {uploadM.error && (
        <Alert variant="destructive">
          <AlertDescription>{(uploadM.error as Error).message}</AlertDescription>
        </Alert>
      )}
      {deleteM.error && (
        <Alert variant="destructive">
          <AlertDescription>{(deleteM.error as Error).message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
