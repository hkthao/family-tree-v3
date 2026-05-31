import { useMutation } from "@tanstack/react-query";

import { IconDownload } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { ClanDetail } from "@/lib/queries/clan-detail";

interface Props {
  clan: ClanDetail;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
}

/**
 * Click → fetch full clan data → render React-PDF doc → download.
 *
 * The @react-pdf/renderer bundle is ~1.5MB; we dynamic-import it on
 * click so the initial app payload doesn't carry it.
 */
export function ExportPdfButton({ clan, variant = "outline", size }: Props) {
  const m = useMutation({
    mutationFn: async () => {
      const { downloadClanBookPdf } = await import("@/lib/pdf/exportClanBook");
      return downloadClanBookPdf(clan, { tree: true, detail: true });
    },
  });

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={() => m.mutate()}
        disabled={m.isPending}
      >
        <IconDownload className="h-4 w-4 mr-1.5" />
        {m.isPending ? "Đang xuất PDF…" : "Xuất sổ gia phả PDF"}
      </Button>
      {m.error && (
        <p className="text-xs text-destructive">
          {(m.error as Error).message}
        </p>
      )}
    </div>
  );
}
