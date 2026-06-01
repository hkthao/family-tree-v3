import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queries/keys";
import {
  deleteSubscription,
  listMySubscriptions,
  upsertSubscription,
  type SubScope,
} from "@/lib/queries/subscriptions";

interface Props {
  clanId: string;
  scope: SubScope;
  /** Required when scope is "branch" or "person". */
  targetId?: string;
  /** Inline icon (already sized) shown before the label. */
  icon?: React.ReactNode;
  labelOn?: string;
  labelOff?: string;
  size?: "default" | "sm" | "lg";
  disabled?: boolean;
}

/**
 * One-click "follow / unfollow" button for an event subscription.
 *
 * Reads the user's full subscription list for this clan (cached + shared
 * across instances) and finds the row matching (scope, targetId). Clicking
 * toggles between insert with defaults and delete.
 *
 * For fine-grained config (channels/lead_days/event_types), use
 * <SubscriptionSettings/> instead.
 */
export function SubscribeToggle({
  clanId,
  scope,
  targetId,
  icon,
  labelOn = "Đang theo dõi",
  labelOff = "Theo dõi",
  size = "sm",
  disabled,
}: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();

  const { data: subs } = useQuery({
    queryKey: queryKeys.subscriptions(clanId, userId),
    queryFn: () => listMySubscriptions(clanId, userId),
    enabled: !!userId,
  });

  const existing = subs?.find((s) => {
    if (s.scope !== scope) return false;
    if (scope === "clan") return s.target_id === null;
    return s.target_id === targetId;
  });

  const m = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("not signed in");
      if (existing) {
        await deleteSubscription(existing.id);
      } else {
        await upsertSubscription({
          clan_id: clanId,
          user_id: userId,
          scope,
          target_id: targetId ?? null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.subscriptions(clanId, userId),
      });
      toast.success(existing ? "Đã huỷ theo dõi" : "Đã bật theo dõi");
    },
    onError: (e) =>
      toast.error("Không cập nhật được", {
        description: (e as Error).message,
      }),
  });

  const on = !!existing;
  return (
    <Button
      size={size}
      variant={on ? "default" : "outline"}
      disabled={disabled || m.isPending || !userId}
      onClick={() => m.mutate()}
      aria-pressed={on}
    >
      {icon}
      {m.isPending ? "Đang lưu…" : on ? labelOn : labelOff}
    </Button>
  );
}
