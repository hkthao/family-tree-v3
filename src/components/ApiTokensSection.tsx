import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ApiTokenCreatePanel, ApiTokenRow, ApiTokenViewPanel } from "@/components/ApiTokenPanels";
import { IconKey, IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { listMyApiTokens } from "@/lib/queries/api-tokens";

import { t } from "@lingui/core/macro";

/**
 * Thẻ "Kết nối AI" ở Cài đặt dòng họ (admin dòng họ): token của chính mình cho dòng họ này.
 * Hành động của cả thẻ nằm ở footer (docs/design-language.md); tạo token mở ngăn kéo.
 */
export function ApiTokensSection({ clanId }: { clanId: string }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const key = ["api-tokens", clanId, userId];
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listMyApiTokens(clanId, userId),
    enabled: !!userId,
  });
  const open = tokens.find((x) => x.id === openId) ?? null;

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t`Đang tải…`}</p>
      ) : tokens.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconKey className="h-4 w-4 shrink-0" />
          {t`Chưa có token nào.`}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {tokens.map((tk) => (
            <ApiTokenRow key={tk.id} tk={tk} onOpen={() => setOpenId(tk.id)} />
          ))}
        </ul>
      )}

      <div className="flex justify-end border-t pt-4">
        <Button size="sm" onClick={() => setCreating(true)}>
          <IconPlus className="mr-1.5 h-4 w-4" />
          {t`Tạo token`}
        </Button>
      </div>

      <ApiTokenCreatePanel
        open={creating}
        onClose={() => setCreating(false)}
        userId={userId}
        fixedClanId={clanId}
        onCreated={() => void qc.invalidateQueries({ queryKey: key })}
      />
      <ApiTokenViewPanel
        tk={open}
        onClose={() => setOpenId(null)}
        invalidateKeys={[key, ["admin-api-tokens"]]}
      />
    </div>
  );
}
