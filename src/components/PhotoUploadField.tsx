import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
} from "@/lib/photoUpload";

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
  const [stats, setStats] = useState<{ bytes: number } | null>(null);

  const { data: signedUrl } = useQuery({
    queryKey: ["signed-photo", personId, photoPath],
    queryFn: () => getSignedPhotoUrl(photoPath),
    enabled: !!photoPath,
    staleTime: 5 * 60 * 1000,
  });

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      const res = await uploadPersonPhoto(clanId, personId, file);
      await updatePerson(personId, { photo_path: res.path });
      return res;
    },
    onSuccess: async (res) => {
      setStats({ bytes: res.bytes });
      await qc.invalidateQueries({
        queryKey: queryKeys.person(personId, userId),
      });
      await qc.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) && q.queryKey[0] === "signed-photo",
      });
      onChange?.(res.path);
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
    },
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
        <div className="flex flex-wrap gap-2">
          <label className="inline-block">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadM.mutate(file);
                e.target.value = "";
              }}
            />
            <span className="inline-flex h-10 px-3 items-center gap-1.5 rounded-md border border-input bg-background hover:bg-muted cursor-pointer text-sm">
              <IconUpload className="h-4 w-4" />
              {uploadM.isPending
                ? "Đang nén & tải lên…"
                : photoPath
                  ? "Đổi ảnh"
                  : "Tải ảnh lên"}
            </span>
          </label>
          {photoPath && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => {
                if (window.confirm("Xoá ảnh của người này?")) {
                  deleteM.mutate();
                }
              }}
              disabled={deleteM.isPending}
            >
              <IconTrash className="h-4 w-4 mr-1.5" />
              {deleteM.isPending ? "Đang xoá…" : "Xoá ảnh"}
            </Button>
          )}
        </div>
      </div>
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
