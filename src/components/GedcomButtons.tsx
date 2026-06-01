import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "@/components/Toast";
import { IconDownload, IconUpload } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { invalidateClanData } from "@/lib/cache";
import type { ClanDetail } from "@/lib/queries/clan-detail";

interface Props {
  clan: ClanDetail;
}

/**
 * Export + Import GEDCOM controls. Both branches dynamic-import the
 * gedcom module so the bundle isn't carried for users who never use
 * either.
 */
export function GedcomButtons({ clan }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const exportM = useMutation({
    mutationFn: async () => {
      const { downloadClanGedcom } = await import("@/lib/gedcom/exportClan");
      return downloadClanGedcom(clan);
    },
    onSuccess: (res) =>
      toast.success("Đã xuất GEDCOM", {
        description: `${res.filename} (${Math.round(res.bytes / 1024)} KB)`,
      }),
    onError: (e) =>
      toast.error("Không xuất được", { description: (e as Error).message }),
  });

  const importM = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const { parseGedcom } = await import("@/lib/gedcom/parse");
      const { importGedcomIntoClan } = await import("@/lib/gedcom/import");
      const parsed = parseGedcom(text);
      return importGedcomIntoClan(clan.id, parsed);
    },
    onSuccess: (res) => {
      const summary =
        `Đã nhập ${res.personsCreated} người, ${res.familiesCreated} gia đình` +
        (res.branchesCreated ? `, ${res.branchesCreated} chi` : "") +
        (res.warnings.length
          ? `. Có ${res.warnings.length} cảnh báo (xem console).`
          : ".");
      setImportMsg(summary);
      if (res.warnings.length) console.warn(res.warnings);
      invalidateClanData(qc, clan.id);
      toast.success("Đã nhập GEDCOM", { description: summary });
    },
    onError: (e) =>
      toast.error("Không nhập được", { description: (e as Error).message }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => exportM.mutate()}
          disabled={exportM.isPending}
        >
          <IconDownload className="h-4 w-4 mr-1.5" />
          {exportM.isPending ? "Đang xuất…" : "Xuất GEDCOM"}
        </Button>
        <label className="inline-block">
          <input
            type="file"
            accept=".ged,.gedcom,text/plain"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setImportMsg(null);
                importM.mutate(file);
              }
              e.target.value = "";
            }}
          />
          <span
            className="inline-flex h-12 px-5 items-center justify-center gap-2 rounded-md border border-input bg-background hover:bg-muted cursor-pointer text-base font-medium"
            aria-disabled={importM.isPending}
          >
            <IconUpload className="h-4 w-4" />
            {importM.isPending ? "Đang nhập…" : "Nhập GEDCOM"}
          </span>
        </label>
      </div>
      {exportM.error && (
        <Alert variant="destructive">
          <AlertDescription>{(exportM.error as Error).message}</AlertDescription>
        </Alert>
      )}
      {importM.error && (
        <Alert variant="destructive">
          <AlertDescription>{(importM.error as Error).message}</AlertDescription>
        </Alert>
      )}
      {importMsg && (
        <Alert>
          <AlertDescription>{importMsg}</AlertDescription>
        </Alert>
      )}
      <p className="text-xs text-muted-foreground">
        GEDCOM 5.5.1 là chuẩn trao đổi dữ liệu phả hệ. Nhập sẽ tạo
        người mới — không hợp nhất với dữ liệu hiện có.
      </p>
    </div>
  );
}
