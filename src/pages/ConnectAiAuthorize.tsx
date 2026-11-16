import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { scopeMeta } from "@/components/apiTokenMeta";
import { ClanPicker, type ClanOption } from "@/components/ClanPicker";
import { IconCheck, IconShield, IconX } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { mcpUrl, type ApiTokenScope } from "@/lib/queries/api-tokens";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

import { t } from "@lingui/core/macro";

const CLAN_SCOPES: ApiTokenScope[] = ["read", "propose", "write"];

interface Info {
  ok: boolean;
  client_name?: string;
  error?: string;
}

/** Địa chỉ gốc của máy chủ MCP (nơi có /oauth/*): cùng tên miền với app, hoặc VITE_MCP_URL khi chạy dev. */
const oauthBase = () => new URL(mcpUrl()).origin;

async function post<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${oauthBase()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

/**
 * `/ket-noi-ai/cap-quyen` — màn "Cho phép" của OAuth: ChatGPT / Claude chuyển người dùng tới đây (đã đăng nhập, nhờ
 * RequireAuth), chọn dòng họ + gói quyền rồi bấm Cho phép. Mọi tham số OAuth do server MCP kiểm lại; trang này chỉ hiển thị
 * và không tin gì từ URL ngoài việc đưa nguyên xi lên server.
 */
export default function ConnectAiAuthorize() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const params = useMemo(
    () => ({
      client_id: sp.get("client_id") ?? "",
      redirect_uri: sp.get("redirect_uri") ?? "",
      response_type: sp.get("response_type") ?? "",
      code_challenge: sp.get("code_challenge") ?? "",
      code_challenge_method: sp.get("code_challenge_method") ?? "",
      state: sp.get("state") ?? "",
    }),
    [sp],
  );
  const [picked, setPicked] = useState<ClanOption[]>([]);
  const [scope, setScope] = useState<ApiTokenScope>("read");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const infoQ = useQuery({
    queryKey: ["oauth-info", params],
    queryFn: () => post<Info>("/oauth/authorize-info", params),
    retry: false,
  });
  const clansQ = useQuery({
    queryKey: ["oauth-admin-clans", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: mem } = await supabase
        .from("clan_members")
        .select("clan_id")
        .eq("user_id", user!.id)
        .eq("role", "admin");
      const ids = (mem ?? []).map((m) => m.clan_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("clans")
        .select("id, name, description, person_count")
        .in("id", ids)
        .order("name");
      return (data ?? []) as ClanOption[];
    },
  });
  const sysAdminQ = useQuery({
    queryKey: ["oauth-is-sysadmin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_platform_admin")
        .eq("id", user!.id)
        .maybeSingle();
      return !!data?.is_platform_admin;
    },
  });
  const sysAdmin = !!sysAdminQ.data;
  const scopes: ApiTokenScope[] = sysAdmin
    ? [...CLAN_SCOPES, "admin"]
    : CLAN_SCOPES;
  const isAdminScope = scope === "admin";
  const clans = clansQ.data ?? [];
  // Chỉ có đúng một dòng họ thì chọn sẵn.
  useEffect(() => {
    if (clans.length === 1) setPicked(clans);
  }, [clans]);
  const left = clans.filter((c) => !picked.some((p) => p.id === c.id));

  async function allow() {
    setBusy(true);
    setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await post<{ ok: boolean; redirect?: string; error?: string }>(
        "/oauth/approve",
        {
          ...params,
          clan_ids: isAdminScope ? undefined : picked.map((p) => p.id),
          scope,
        },
        data.session?.access_token,
      );
      if (r.ok && r.redirect) {
        window.location.assign(r.redirect);
        return;
      }
      setErr(r.error ?? t`Không cấp quyền được, thử lại.`);
    } catch {
      setErr(t`Không kết nối được tới máy chủ. Thử lại sau.`);
    }
    setBusy(false);
  }

  function deny() {
    const u = new URL(params.redirect_uri);
    u.searchParams.set("error", "access_denied");
    if (params.state) u.searchParams.set("state", params.state);
    window.location.assign(u.toString());
  }

  const info = infoQ.data;
  return (
    <div className="min-h-dvh bg-background grid place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5 rounded-xl border bg-card p-6 shadow-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <IconShield className="h-7 w-7" />
        </span>

        {infoQ.isLoading && (
          <p className="text-center text-muted-foreground">{t`Đang kiểm tra yêu cầu…`}</p>
        )}

        {!infoQ.isLoading && !info?.ok && (
          <div className="space-y-3 text-center">
            <h1 className="text-xl font-semibold">{t`Yêu cầu kết nối không hợp lệ`}</h1>
            <p className="text-muted-foreground">
              {info?.error ??
                t`Không kiểm tra được yêu cầu. Hãy bắt đầu lại từ ứng dụng AI.`}
            </p>
          </div>
        )}

        {info?.ok && (
          <div className="space-y-5">
            <div className="space-y-1 text-center">
              <p className="text-sm text-muted-foreground">{t`Ứng dụng muốn kết nối với gia phả của bạn`}</p>
              <h1 className="text-2xl font-semibold">{info.client_name}</h1>
            </div>

            {!clansQ.isLoading &&
            !sysAdminQ.isLoading &&
            clans.length === 0 &&
            !sysAdmin ? (
              <Alert variant="destructive">
                <AlertDescription>{t`Chỉ quản trị dòng họ mới kết nối được AI. Tài khoản này chưa quản trị dòng họ nào.`}</AlertDescription>
              </Alert>
            ) : (
              <>
                {!isAdminScope && (
                  <div className="space-y-2">
                    <Label htmlFor="oauth-clan">{t`Dòng họ cho phép AI làm việc`}</Label>
                    {picked.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {picked.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setPicked(picked.filter((p) => p.id !== c.id))
                              }
                              aria-label={t`Bỏ ${c.name}`}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-primary/5 px-2.5 py-1 text-sm hover:bg-primary/10"
                            >
                              <span className="truncate">{c.name}</span>
                              <IconX className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {left.length > 0 && (
                      <ClanPicker
                        id="oauth-clan"
                        value={null}
                        onChange={(c) => setPicked([...picked, c])}
                        onlyIds={left.map((c) => c.id)}
                      />
                    )}
                    {left.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPicked(clans)}
                      >
                        {t`Chọn tất cả ${clans.length} dòng họ`}
                      </Button>
                    )}
                  </div>
                )}

                <fieldset className="space-y-2">
                  <legend className="mb-1 text-sm font-medium">{t`Quyền cho AI`}</legend>
                  {scopes.map((s) => {
                    const m = scopeMeta(s);
                    return (
                      <label
                        key={s}
                        className={cn(
                          "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                          scope === s
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/40",
                        )}
                      >
                        <input
                          type="radio"
                          name="scope"
                          className="mt-1"
                          checked={scope === s}
                          onChange={() => setScope(s)}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{m.label}</span>
                          <span className="block text-sm text-muted-foreground">
                            {m.hint}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>

                <p className="text-sm text-muted-foreground">
                  {isAdminScope
                    ? t`AI làm việc trên mọi dòng họ và các chức năng quản trị, chỉ khi bạn còn là admin hệ thống. Lệnh nguy hiểm buộc xác nhận kèm lý do, mọi lệnh được ghi nhật ký. Thu hồi ở Quản trị → Kết nối AI.`
                    : picked.length > 1
                      ? t`AI làm việc trong các dòng họ đã chọn (bạn chỉ cần nói tên họ), cùng một gói quyền, và ở từng họ không vượt quá vai trò hiện tại của bạn. Thu hồi ở Cài đặt dòng họ → Kết nối AI.`
                      : t`AI chỉ làm việc trong dòng họ này, không vượt quá vai trò của bạn. Bạn thu hồi được bất cứ lúc nào ở Cài đặt dòng họ → Kết nối AI.`}
                </p>

                {err && (
                  <Alert variant="destructive">
                    <AlertDescription>{err}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={busy}
                    onClick={deny}
                  >
                    <IconX className="mr-1.5 h-4 w-4" />
                    {t`Từ chối`}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={busy || (!isAdminScope && picked.length === 0)}
                    onClick={() => void allow()}
                  >
                    <IconCheck className="mr-1.5 h-4 w-4" />
                    {busy ? t`Đang cấp quyền…` : t`Cho phép`}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
