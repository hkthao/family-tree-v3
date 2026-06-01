import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { IconCheck, IconTrash } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queries/keys";
import {
  DEFAULT_CHANNELS,
  DEFAULT_EVENT_TYPES,
  DEFAULT_LEAD_DAYS,
  deleteSubscription,
  listMySubscriptions,
  setSubscriptionEnabled,
  upsertSubscription,
  type SubChannel,
  type SubEventType,
} from "@/lib/queries/subscriptions";

const LEAD_OPTIONS = [
  { value: 14, label: "14 ngày trước" },
  { value: 7, label: "7 ngày trước" },
  { value: 3, label: "3 ngày trước" },
  { value: 1, label: "1 ngày trước" },
  { value: 0, label: "Đúng ngày" },
];

const TYPE_OPTIONS: { value: SubEventType; label: string }[] = [
  { value: "birthday", label: "Sinh nhật" },
  { value: "death_anniversary", label: "Ngày giỗ" },
  { value: "custom", label: "Sự kiện tuỳ chỉnh" },
];

interface Props {
  clanId: string;
}

/**
 * Full editor for the user's clan-scope subscription: channels, event
 * types, lead days, on/off toggle, and a delete button. Lives on the
 * Events page so members can self-serve their notification prefs.
 */
export function SubscriptionSettings({ clanId }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();

  const { data: subs } = useQuery({
    queryKey: queryKeys.subscriptions(clanId, userId),
    queryFn: () => listMySubscriptions(clanId, userId),
    enabled: !!userId,
  });

  const current = subs?.find(
    (s) => s.scope === "clan" && s.target_id === null,
  );

  const [channels, setChannels] = useState<SubChannel[]>(DEFAULT_CHANNELS);
  const [types, setTypes] = useState<SubEventType[]>(DEFAULT_EVENT_TYPES);
  const [leadDays, setLeadDays] = useState<number[]>(DEFAULT_LEAD_DAYS);

  // Hydrate from server when row loads / changes
  useEffect(() => {
    if (current) {
      setChannels(current.channels as SubChannel[]);
      setTypes(current.event_types as SubEventType[]);
      setLeadDays(current.lead_days);
    } else {
      setChannels(DEFAULT_CHANNELS);
      setTypes(DEFAULT_EVENT_TYPES);
      setLeadDays(DEFAULT_LEAD_DAYS);
    }
  }, [current?.id]);

  const saveM = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error("not signed in");
      return upsertSubscription({
        clan_id: clanId,
        user_id: userId,
        scope: "clan",
        target_id: null,
        channels,
        event_types: types,
        lead_days: leadDays.length > 0 ? leadDays.sort((a, b) => b - a) : [0],
        is_enabled: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.subscriptions(clanId, userId),
      });
      toast.success("Đã lưu cài đặt theo dõi");
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  const toggleM = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!current) throw new Error("no subscription");
      return setSubscriptionEnabled(current.id, enabled);
    },
    onSuccess: (_data, enabled) => {
      qc.invalidateQueries({
        queryKey: queryKeys.subscriptions(clanId, userId),
      });
      toast.success(enabled ? "Đã bật theo dõi" : "Đã tạm tắt theo dõi");
    },
    onError: (e) =>
      toast.error("Không cập nhật được", {
        description: (e as Error).message,
      }),
  });

  const deleteM = useMutation({
    mutationFn: () => {
      if (!current) throw new Error("no subscription");
      return deleteSubscription(current.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.subscriptions(clanId, userId),
      });
      toast.success("Đã huỷ theo dõi");
    },
    onError: (e) =>
      toast.error("Không huỷ được", { description: (e as Error).message }),
  });

  if (!userId) return null;

  const hasValid =
    types.length > 0 && channels.length > 0 && leadDays.length > 0;

  return (
    <div className="space-y-4">
      {current && (
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`text-sm font-medium ${
              current.is_enabled ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {current.is_enabled
              ? "Đang theo dõi sự kiện dòng họ"
              : "Đã tạm tắt theo dõi"}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={toggleM.isPending}
            onClick={() => toggleM.mutate(!current.is_enabled)}
          >
            {current.is_enabled ? "Tạm tắt" : "Bật lại"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={deleteM.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: "Huỷ theo dõi sự kiện dòng họ này?",
                description: "Bạn sẽ không nhận email nhắc nữa.",
                confirmLabel: "Huỷ theo dõi",
                destructive: true,
              });
              if (ok) deleteM.mutate();
            }}
          >
            <IconTrash className="h-4 w-4 mr-1" />
            Huỷ theo dõi
          </Button>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Loại sự kiện</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={types.includes(opt.value)}
                onChange={(e) =>
                  setTypes((prev) =>
                    e.target.checked
                      ? [...prev, opt.value]
                      : prev.filter((t) => t !== opt.value),
                  )
                }
                className="h-4 w-4 accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Báo trước</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {LEAD_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={leadDays.includes(opt.value)}
                onChange={(e) =>
                  setLeadDays((prev) =>
                    e.target.checked
                      ? [...prev, opt.value]
                      : prev.filter((d) => d !== opt.value),
                  )
                }
                className="h-4 w-4 accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Kênh nhận</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={channels.includes("email")}
              onChange={(e) =>
                setChannels((prev) =>
                  e.target.checked
                    ? Array.from(new Set([...prev, "email" as SubChannel]))
                    : prev.filter((c) => c !== "email"),
                )
              }
              className="h-4 w-4 accent-primary"
            />
            Email
          </label>
          <label
            className="flex items-center gap-2 cursor-not-allowed text-sm text-muted-foreground"
            title="SMS sẽ thêm sau"
          >
            <input
              type="checkbox"
              disabled
              checked={false}
              className="h-4 w-4"
            />
            SMS (sắp có)
          </label>
        </div>
      </fieldset>

      {saveM.error && (
        <Alert variant="destructive">
          <AlertDescription>{(saveM.error as Error).message}</AlertDescription>
        </Alert>
      )}

      <Button
        size="sm"
        disabled={!hasValid || saveM.isPending}
        onClick={() => saveM.mutate()}
      >
        <IconCheck className="h-4 w-4 mr-1.5" />
        {current
          ? saveM.isPending
            ? "Đang lưu…"
            : "Lưu thay đổi"
          : saveM.isPending
            ? "Đang bật…"
            : "Bật theo dõi"}
      </Button>
    </div>
  );
}
