import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Callout } from "@/components/ui/callout";
import { useState } from "react";

import { Chip } from "@/components/Chip";
import { useConfirm } from "@/components/ConfirmDialog";
import { friendlyError } from "@/components/ErrorState";
import {
  IconBuildings,
  IconCalendar,
  IconCheck,
  IconClock,
  IconCopy,
  IconKey,
  IconSend,
  IconShield,
  IconTrash,
  IconUser,
} from "@/components/icons";
import { ClanPicker, type ClanOption } from "@/components/ClanPicker";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { currentIntlTag } from "@/lib/i18n";
import {
  createApiToken,
  mcpUrl,
  revokeApiToken,
  type ApiToken,
  type ApiTokenScope,
} from "@/lib/queries/api-tokens";
import { scopeMeta, statusMeta, tokenStatus } from "@/components/apiTokenMeta";

import { t } from "@lingui/core/macro";

const fmt = (iso: string) => new Date(iso).toLocaleDateString(currentIntlTag());

/** Màu chip hạn dùng: quá hạn = đỏ, còn ≤ 7 ngày = vàng, còn lại = chàm. */
function expiryTone(iso: string): "danger" | "warning" | "indigo" {
  const left = new Date(iso).getTime() - Date.now();
  return left <= 0 ? "danger" : left <= 7 * 86_400_000 ? "warning" : "indigo";
}

/** Dòng danh sách token — dùng ở trang quản trị và thẻ Cài đặt dòng họ. */
export function ApiTokenRow({
  tk,
  onOpen,
  owner,
}: {
  tk: ApiToken;
  onOpen: () => void;
  /** Quản trị hệ thống thấy thêm chủ token và dòng họ. */
  owner?: { user: string; clan?: string };
}) {
  const sc = scopeMeta(tk.scope);
  const st = statusMeta(tokenStatus(tk));
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-stretch p-3 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {tk.name}{" "}
            <span className="font-mono text-xs text-muted-foreground">
              {tk.token_prefix}…
            </span>
          </p>
          {owner && (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <IconUser className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{owner.user}</span>
              {owner.clan && (
                <>
                  <IconBuildings className="ml-1 h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{owner.clan}</span>
                </>
              )}
            </p>
          )}
          <div className="mt-2 flex flex-wrap justify-end gap-1.5">
            {tk.clan_count ? (
              <Chip tone="info" icon={<IconBuildings />}>
                {t`${tk.clan_count} dòng họ`}
              </Chip>
            ) : null}
            <Chip tone={sc.tone} icon={<sc.icon />}>
              {sc.label}
            </Chip>
            <Chip tone={st.tone} icon={<IconCheck />}>
              {st.label}
            </Chip>
            <Chip tone={expiryTone(tk.expires_at)} icon={<IconClock />}>
              {t`Hết hạn ${fmt(tk.expires_at)}`}
            </Chip>
            <Chip
              tone={tk.last_used_at ? "violet" : "neutral"}
              icon={<IconCalendar />}
            >
              {tk.last_used_at ? t`Dùng ${fmt(tk.last_used_at)}` : t`Chưa dùng`}
            </Chip>
          </div>
        </div>
      </button>
    </li>
  );
}

const DAY_OPTIONS = [30, 90, 365] as const;

/**
 * Ngăn kéo "Token mới": form tạo, rồi chuyển sang màn "Chép token" (bản rõ chỉ hiện một lần).
 * Không truyền `fixedClanId` = quản trị hệ thống tự tìm và chọn dòng họ (ClanPicker); có = đã biết dòng họ (Cài đặt dòng họ).
 */
export function ApiTokenCreatePanel({
  open,
  onClose,
  userId,
  fixedClanId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  /** Có = dòng họ đã biết (Cài đặt dòng họ), không hiện ô chọn. Không có = quản trị hệ thống chọn. */
  fixedClanId?: string;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [clan, setClan] = useState<ClanOption | null>(null);
  const clanId = fixedClanId ?? clan?.id ?? "";
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ApiTokenScope>("read");
  const [days, setDays] = useState<number>(90);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createApiToken({
        clanId: scope === "admin" ? null : clanId,
        userId,
        name,
        scope,
        days,
      }),
    onSuccess: (token) => {
      setFresh(token);
      onCreated();
    },
    onError: (e) =>
      toast.error(t`Không tạo được token`, { description: friendlyError(e) }),
  });

  function close() {
    setFresh(null);
    setName("");
    setClan(null);
    setScope("read");
    setCopied(null);
    onClose();
  }
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* người dùng chép tay từ ô */
    }
  }

  const url = mcpUrl();
  const cmd = `claude mcp add --transport http dong-ho-viet ${url} --header "Authorization: Bearer ${fresh ?? "<TOKEN>"}"`;
  const sc = scopeMeta(scope);

  return (
    <SidePanel
      open={open}
      title={fresh ? t`Chép token` : t`Token mới`}
      subtitle={t`Cho AI bên ngoài làm việc với gia phả`}
      onClose={close}
      size="lg"
      guard={!fresh && !!name.trim()}
    >
      {fresh ? (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              {t`Chép token ngay — sẽ không hiện lại lần nữa. Mất thì tạo token mới.`}
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="api-token-fresh">{t`Token`}</Label>
            <Input
              id="api-token-fresh"
              readOnly
              icon={<IconKey />}
              value={fresh}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
              action={
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => copy("tok", fresh)}
                  aria-label={t`Chép token`}
                >
                  {copied === "tok" ? (
                    <IconCheck className="h-4 w-4" />
                  ) : (
                    <IconCopy className="h-4 w-4" />
                  )}
                </Button>
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-token-cmd">{t`Claude Code — chạy một lần trong terminal`}</Label>
            <Input
              id="api-token-cmd"
              readOnly
              icon={<IconSend />}
              value={cmd}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
              action={
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => copy("cmd", cmd)}
                  aria-label={t`Chép lệnh`}
                >
                  {copied === "cmd" ? (
                    <IconCheck className="h-4 w-4" />
                  ) : (
                    <IconCopy className="h-4 w-4" />
                  )}
                </Button>
              }
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {t`Client MCP khác (Claude Desktop, ChatGPT…): địa chỉ ${url}, header Authorization: Bearer <token>.`}
          </p>
          <FormActions>
            <Button type="button" onClick={close}>
              <IconCheck className="mr-1.5 h-4 w-4" />
              {t`Tôi đã chép xong`}
            </Button>
          </FormActions>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if ((clanId || scope === "admin") && name.trim()) create.mutate();
          }}
        >
          {!fixedClanId && scope !== "admin" && (
            <div className="space-y-2">
              <Label htmlFor="api-token-clan" required>
                {t`Dòng họ`}
              </Label>
              <ClanPicker id="api-token-clan" value={clan} onChange={setClan} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="api-token-name" required>
              {t`Tên token`}
            </Label>
            <Input
              id="api-token-name"
              icon={<IconKey />}
              value={name}
              maxLength={80}
              placeholder={t`Ví dụ: Claude trên laptop`}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-token-scope">{t`Quyền`}</Label>
            <Select
              id="api-token-scope"
              icon={<IconShield />}
              value={scope}
              onChange={(e) => setScope(e.target.value as ApiTokenScope)}
            >
              {(
                [
                  ...(["read", "propose", "write"] as const),
                  ...(fixedClanId ? [] : (["admin"] as const)),
                ] as const
              ).map((s) => (
                <option key={s} value={s}>
                  {scopeMeta(s).label}
                </option>
              ))}
            </Select>
            <Callout icon={<sc.icon className="h-4 w-4" />}>{sc.hint}</Callout>
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-token-days">{t`Hạn dùng`}</Label>
            <Select
              id="api-token-days"
              icon={<IconClock />}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 365 ? t`1 năm` : t`${d} ngày`}
                </option>
              ))}
            </Select>
          </div>
          <FormActions>
            <Button type="button" variant="outline" onClick={close}>
              {t`Hủy`}
            </Button>
            <Button
              type="submit"
              disabled={
                create.isPending ||
                (!clanId && scope !== "admin") ||
                !name.trim()
              }
            >
              <IconKey className="mr-1.5 h-4 w-4" />
              {create.isPending ? t`Đang tạo…` : t`Tạo token`}
            </Button>
          </FormActions>
        </form>
      )}
    </SidePanel>
  );
}

/** Ngăn kéo xem một token (chỉ đọc) + thu hồi. */
export function ApiTokenViewPanel({
  tk,
  owner,
  onClose,
  invalidateKeys,
}: {
  tk: ApiToken | null;
  owner?: { user: string; clan?: string };
  onClose: () => void;
  invalidateKeys: unknown[][];
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiToken(id),
    onSuccess: () => {
      invalidateKeys.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      toast.success(t`Đã thu hồi token`);
      onClose();
    },
    onError: (e) =>
      toast.error(t`Không thu hồi được`, { description: friendlyError(e) }),
  });

  const sc = tk ? scopeMeta(tk.scope) : null;
  const st = tk ? statusMeta(tokenStatus(tk)) : null;
  const rows: Array<[string, string, React.ReactNode]> = tk
    ? [
        [t`Tên`, tk.name, <IconKey key="k" />],
        ...(owner
          ? ([
              [t`Chủ token`, owner.user, <IconUser key="u" />],
              ...(owner.clan
                ? [[t`Dòng họ`, owner.clan, <IconBuildings key="b" />]]
                : []),
            ] as Array<[string, string, React.ReactNode]>)
          : []),
        [t`Quyền`, sc!.label, <IconShield key="s" />],
        [t`Ngày tạo`, fmt(tk.created_at), <IconCalendar key="c" />],
        [t`Hết hạn`, fmt(tk.expires_at), <IconClock key="e" />],
        [
          t`Dùng gần nhất`,
          tk.last_used_at ? fmt(tk.last_used_at) : t`chưa dùng`,
          <IconClock key="l" />,
        ],
      ]
    : [];

  return (
    <SidePanel
      open={tk !== null}
      title={t`Token AI`}
      subtitle={tk ? `${tk.name} · ${tk.token_prefix}…` : undefined}
      onClose={onClose}
      size="lg"
      guard={false}
    >
      {tk && sc && st && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <Chip tone={sc.tone} icon={<sc.icon />}>
              {sc.label}
            </Chip>
            <Chip tone={st.tone} icon={<IconCheck />}>
              {st.label}
            </Chip>
          </div>
          {rows.map(([label, value, icon]) => (
            <div key={label} className="space-y-2">
              <Label>{label}</Label>
              <Input readOnly icon={icon} value={value} />
            </div>
          ))}
          <Callout icon={<sc.icon className="h-4 w-4" />}>{sc.hint}</Callout>
          {tokenStatus(tk) === "active" && (
            <FormActions>
              <Button
                type="button"
                variant="destructive-outline"
                disabled={revoke.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: t`Thu hồi token "${tk.name}"?`,
                    description: t`AI đang dùng token này sẽ bị chặn ngay.`,
                    confirmLabel: t`Thu hồi`,
                    destructive: true,
                  });
                  if (ok) revoke.mutate(tk.id);
                }}
              >
                <IconTrash className="mr-1.5 h-4 w-4" />
                {t`Thu hồi`}
              </Button>
            </FormActions>
          )}
        </div>
      )}
    </SidePanel>
  );
}
