import { useMutation } from "@tanstack/react-query";

import { useToast } from "@/components/Toast";
import { IconDownload } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { ClanDetail } from "@/lib/queries/clan-detail";

interface Props {
  clan: ClanDetail;
}

/**
 * One-click CSV export of the bloodline / in-law spreadsheet that
 * round-trips with the existing "Nhập từ Excel" importer.
 *
 * Dynamic-imports the csv module so the bundle isn't carried for
 * users who never click the button.
 */
export function CsvExportButton({ clan }: Props) {
  const toast = useToast();

  const m = useMutation({
    mutationFn: async () => {
      const [{ getClanBookData }, { downloadClanCsv }] = await Promise.all([
        import("@/lib/queries/clan-book"),
        import("@/lib/csv/exportClanCsv"),
      ]);
      const data = await getClanBookData(clan.id);
      return downloadClanCsv(clan, data);
    },
    onSuccess: (res) =>
      toast.success("Đã xuất CSV", {
        description: `${res.filename} (${Math.round(res.bytes / 1024)} KB)`,
      }),
    onError: (e) =>
      toast.error("Không xuất được", { description: (e as Error).message }),
  });

  return (
    <Button
      variant="outline"
      onClick={() => m.mutate()}
      disabled={m.isPending}
    >
      <IconDownload className="h-4 w-4 mr-1.5" />
      {m.isPending ? "Đang xuất…" : "Xuất CSV"}
    </Button>
  );
}
