import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  IconCheck,
  IconKey,
  IconRefresh,
  IconSparkles,
  IconTrash,
} from "@/components/icons";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  AI_PROVIDERS,
  AiNotInstalledError,
  QA_MODELS,
  deleteProviderKey,
  AI_LIMIT_RANGE,
  getAiConfig,
  getAiLimits,
  getAiSpendToday,
  setAiEnabled,
  setAiLimits,
  type AiLimits,
  setQaModel,
  listKeyStatus,
  setProviderKey,
  testProviderKey,
  type AiProvider,
  type KeyStatus,
} from "@/lib/queries/aiAdmin";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
/**
 * Quản trị › Trợ lý AI — cắm khoá nhà cung cấp và kiểm tra kết nối.
 *
 * Khoá được mã hoá AES-GCM ở edge function trước khi vào DB; màn hình này
 * chỉ thấy 4 ký tự cuối và kết quả kiểm tra. Nhập xong là hệ thống tự gọi
 * thử nhà cung cấp luôn, để không ai phải đoán xem khoá có chạy không.
 */
export function AiSettingsTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [drafts, setDrafts] = useState<Partial<Record<AiProvider, string>>>({});

  const configQ = useQuery({ queryKey: ["ai-config"], queryFn: getAiConfig, retry: false });
  const limitsQ = useQuery({
    queryKey: ["ai-limits"],
    queryFn: getAiLimits,
    retry: false,
  });
  const [limits, setLimits] = useState<AiLimits | null>(null);
  const saveLimits = useMutation({
    mutationFn: (next: AiLimits) => setAiLimits(next),
    onSuccess: () => {
      toast.success(t`Đã lưu hạn mức`);
      setLimits(null);
      qc.invalidateQueries({ queryKey: ["ai-limits"] });
      qc.invalidateQueries({ queryKey: ["ai-spend-today"] });
    },
    onError: (e: Error) =>
      toast.error(t`Không lưu được`, { description: e.message }),
  });
  const current = limits ?? limitsQ.data ?? null;
  // Chi phí hôm nay — để ngắt mạch không phải là hộp đen.
  const spendQ = useQuery({
    queryKey: ["ai-spend-today"],
    queryFn: getAiSpendToday,
    retry: false,
    refetchInterval: 60_000,
  });

  const toggleEnabled = useMutation({
    mutationFn: setAiEnabled,
    onSuccess: (_, on) => {
      qc.invalidateQueries({ queryKey: ["ai-config"] });
      qc.invalidateQueries({ queryKey: ["ai-enabled"] });
      toast.success(on ? t`Đã bật trợ lý` : t`Đã tắt trợ lý`);
    },
    onError: (e: Error) => toast.error(t`Không đổi được`, { description: e.message }),
  });

  const changeModel = useMutation({
    mutationFn: setQaModel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-config"] });
      toast.success(t`Đã đổi model`);
    },
    onError: (e: Error) => toast.error(t`Không đổi được`, { description: e.message }),
  });

  const statusQ = useQuery({
    queryKey: ["ai-provider-keys"],
    queryFn: listKeyStatus,
    // Chưa cài thì thử lại cũng vô ích, chỉ tốn thêm ba lần 404 trong
    // console. Các lỗi khác (mạng chập) vẫn giữ retry mặc định.
    retry: (count, e) => !(e instanceof AiNotInstalledError) && count < 2,
  });

  const byProvider = new Map<AiProvider, KeyStatus>(
    (statusQ.data ?? []).map((s) => [s.provider, s]),
  );

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["ai-provider-keys"] });

  const save = useMutation({
    mutationFn: ({ p, key }: { p: AiProvider; key: string }) =>
      setProviderKey(p, key),
    onSuccess: (res, { p }) => {
      setDrafts((d) => ({ ...d, [p]: "" }));
      invalidate();
      if (res.test.ok) {
        toast.success(t`Đã lưu và kết nối được`, {
          description: t`Nhà cung cấp trả lời sau ${res.test.ms}ms.`,
        });
      } else {
        toast.error(t`Đã lưu nhưng kết nối thất bại`, {
          description: res.test.error ?? t`Kiểm tra lại khoá.`,
        });
      }
    },
    onError: (e: Error) => toast.error(t`Không lưu được`, { description: e.message }),
  });

  const test = useMutation({
    mutationFn: (p: AiProvider) => testProviderKey(p),
    onSuccess: (res) => {
      invalidate();
      if (res.test.ok) {
        toast.success(t`Kết nối tốt`, {
          description: `${res.test.model} · ${res.test.ms}ms`,
        });
      } else {
        toast.error(t`Không kết nối được`, {
          description: res.test.error ?? t`Không rõ nguyên nhân.`,
        });
      }
    },
    onError: (e: Error) => toast.error(t`Lỗi kiểm tra`, { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (p: AiProvider) => deleteProviderKey(p),
    onSuccess: () => {
      invalidate();
      toast.success(t`Đã xoá khoá`);
    },
    onError: (e: Error) => toast.error(t`Không xoá được`, { description: e.message }),
  });

  if (statusQ.isLoading) return <LoadingState label={t`Đang tải cấu hình…`} />;

  // Frontend có thể lên trước database: prod là Supabase tự host, migration
  // áp bằng tay. Hiện hướng dẫn thay vì quăng lỗi PostgREST thô.
  if (statusQ.error instanceof AiNotInstalledError) return <SetupGuide />;

  if (statusQ.error) {
    return (
      <ErrorState
        title={t`Không tải được cấu hình`}
        error={statusQ.error}
        onRetry={() => statusQ.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
        <p className="mb-1 font-semibold">{t`Khoá được mã hoá trước khi lưu`}</p>
        <p className="text-muted-foreground">
          <Trans>
          Khoá mã hoá bằng AES-256-GCM ngay tại máy chủ hàm, khoá giải mã nằm ở biến
          môi trường <code>AI_KEY_ENCRYPTION_KEY</code> — cơ sở dữ liệu không bao giờ
          thấy khoá gốc. Cách này chặn được rò rỉ qua bản sao lưu hay truy vấn nhầm;
          nó <b>{t`không`}</b> chặn được người đã vào được máy chủ.
          </Trans>
        </p>
        <p className="mt-2 text-muted-foreground">
          <Trans>
          Đổi <code>AI_KEY_ENCRYPTION_KEY</code> sẽ làm mọi khoá đã lưu không giải mã
          được nữa — phải nhập lại ở đây.
          </Trans>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IconSparkles className="h-5 w-5 text-primary" />
            {t`Công tắc tổng`}
          </CardTitle>
          <CardDescription>
            <Trans>Tắt thì trợ lý ẩn hoàn toàn với mọi dòng họ, kể cả dòng họ đã bật
            tính năng. Mặc định tắt.</Trans>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-2">
          <label htmlFor="qa-model" className="text-sm font-medium">
            {t`Model cho hỏi đáp`}
          </label>
          <Select
            icon={<IconSparkles />}
            id="qa-model"
            className="max-w-sm"
            value={configQ.data?.qaModel ?? ""}
            disabled={configQ.isLoading || changeModel.isPending}
            onChange={(e) => changeModel.mutate(e.target.value)}
          >
            {QA_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
          <p className="text-xs text-muted-foreground">
            {t`Phải có khoá của nhà cung cấp tương ứng ở dưới thì model mới chạy.`}
          </p>
        </CardContent>

        {/* Hành động nằm ở footer — xem docs/design-language.md. */}
        <CardFooter className="justify-between gap-3 border-t pt-4">
          <span className="text-sm text-muted-foreground">
            {configQ.data?.enabled ? t`Trợ lý đang bật` : t`Trợ lý đang tắt`}
            {spendQ.data && spendQ.data.capUsd > 0 && (
              <>
                {" · hôm nay "}
                <span
                  className={
                    spendQ.data.spentUsd >= spendQ.data.capUsd
                      ? "font-medium text-destructive"
                      : "tabular-nums"
                  }
                  title={t`Chạm trần thì trợ lý tự nghỉ tới hết ngày (giờ VN), không cần bật lại tay.`}
                >
                  ${spendQ.data.spentUsd.toFixed(2)}/${spendQ.data.capUsd}
                </span>
              </>
            )}
          </span>
          <Button size="sm"
            variant={configQ.data?.enabled ? "outline" : "default"}
            disabled={configQ.isLoading || toggleEnabled.isPending}
            onClick={() => toggleEnabled.mutate(!configQ.data?.enabled)}
          >
            <IconSparkles className="h-4 w-4" />
            {configQ.data?.enabled ? t`Tắt trợ lý` : t`Bật trợ lý`}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t`Hạn mức & chi phí`}</CardTitle>
          <CardDescription>
            <Trans>Ba con số này trước đây chỉ đổi được bằng SQL trên máy chủ. Đổi ở
            đây có hiệu lực ngay, không cần deploy lại.</Trans>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberSetting
            id="ai-free"
            label={t`Lượt miễn phí / tháng`}
            hint={t`Mỗi tài khoản. Đặt 0 để tắt hẳn phần miễn phí.`}
            value={current?.freePerMonth}
            range={AI_LIMIT_RANGE.freePerMonth}
            onChange={(v) =>
              current && setLimits({ ...current, freePerMonth: v })
            }
          />
          <NumberSetting
            id="ai-cap"
            label={t`Trần chi phí / ngày (USD)`}
            hint={t`Chạm trần thì trợ lý nghỉ tới hết ngày rồi tự mở lại. Đặt 0 để tắt ngắt mạch.`}
            value={current?.dailyCapUsd}
            range={AI_LIMIT_RANGE.dailyCapUsd}
            onChange={(v) => current && setLimits({ ...current, dailyCapUsd: v })}
          />
          <NumberSetting
            id="ai-retention"
            label={t`Giữ lịch sử chat (ngày)`}
            hint={t`Cron mỗi đêm xoá tin cũ hơn mốc này.`}
            value={current?.retentionDays}
            range={AI_LIMIT_RANGE.retentionDays}
            onChange={(v) =>
              current && setLimits({ ...current, retentionDays: v })
            }
          />
          <NumberSetting
            id="ai-clan-daily"
            label={t`Lượt / ngày cho mỗi dòng họ`}
            hint={t`Mức chung. Đặt riêng cho một dòng họ ở Báo cáo › Dòng họ. 0 = không giới hạn.`}
            value={current?.clanDailyLimit}
            range={AI_LIMIT_RANGE.clanDailyLimit}
            onChange={(v) =>
              current && setLimits({ ...current, clanDailyLimit: v })
            }
          />
          <NumberSetting
            id="ai-clan-monthly"
            label={t`Lượt / tháng cho mỗi dòng họ`}
            hint={t`Mức chung, tính theo tháng dương giờ Việt Nam. 0 = không giới hạn.`}
            value={current?.clanMonthlyLimit}
            range={AI_LIMIT_RANGE.clanMonthlyLimit}
            onChange={(v) =>
              current && setLimits({ ...current, clanMonthlyLimit: v })
            }
          />
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t pt-4">
          <span className="text-sm text-muted-foreground">
            {limits ? t`Có thay đổi chưa lưu` : t`Đang khớp với máy chủ`}
          </span>
          <Button size="sm"
            disabled={!limits || saveLimits.isPending}
            onClick={() => limits && saveLimits.mutate(limits)}
          >
            <IconCheck className="h-4 w-4" />
            {t`Lưu hạn mức`}
          </Button>
        </CardFooter>
      </Card>


      {AI_PROVIDERS.map((p) => {
        const st = byProvider.get(p.id);
        const draft = drafts[p.id] ?? "";
        const busy =
          (save.isPending && save.variables?.p === p.id) ||
          (test.isPending && test.variables === p.id) ||
          (remove.isPending && remove.variables === p.id);

        return (
          <Card key={p.id}>
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{p.label}</CardTitle>
                {st ? (
                  <span className="rounded-full border px-2 py-0.5 font-mono text-xs">
                    {st.hint}
                  </span>
                ) : (
                  <span className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
                    {t`chưa cắm khoá`}
                  </span>
                )}
                {st?.last_test_ok === true && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <IconCheck className="h-3 w-3" />
                    {t`kết nối tốt · ${st.last_test_ms ?? 0}ms`}
                  </span>
                )}
                {st?.last_test_ok === false && (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                    {t`lỗi kết nối`}
                  </span>
                )}
              </div>
              {st?.last_test_ok === false && st.last_test_error && (
                <p className="break-words rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                  {st.last_test_error}
                </p>
              )}
            </CardHeader>

            <CardContent>
              <label htmlFor={`key-${p.id}`} className="sr-only">
                {t`Khoá API ${p.label}`}
              </label>
              <Input
                icon={<IconKey />}
                id={`key-${p.id}`}
                type="password"
                autoComplete="off"
                value={draft}
                placeholder={st ? t`Nhập khoá mới để thay` : p.hint}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                }
                className="font-mono"
              />
            </CardContent>

            {/* Mọi hành động dồn xuống footer, không chen cạnh ô nhập:
                ở màn hẹp chúng đẩy ô nhập co lại còn vài ký tự. */}
            <CardFooter className="flex-wrap justify-between gap-3 border-t pt-4">
              <span className="text-xs text-muted-foreground">
                {st
                  ? t`Cập nhật ${new Date(st.updated_at).toLocaleString("vi-VN")}`
                  : t`Chưa có khoá nào được lưu`}
              </span>
              <div className="flex flex-wrap gap-2">
                {st && (
                  <>
                    <Button size="sm"
                      variant="destructive-outline"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await confirm({
                          title: t`Xoá khoá ${p.label}?`,
                          description:
                            t`Trợ lý sẽ ngừng dùng được nhà cung cấp này cho tới khi cắm khoá mới.`,
                          confirmLabel: t`Xoá`,
                          destructive: true,
                        });
                        if (ok) remove.mutate(p.id);
                      }}
                    >
                      <IconTrash className="h-4 w-4" />
                      {t`Xoá`}
                    </Button>
                    <Button size="sm"
                      variant="outline"
                      onClick={() => test.mutate(p.id)}
                      disabled={busy}
                    >
                      <IconRefresh className="h-4 w-4" />
                      {t`Kiểm tra`}
                    </Button>
                  </>
                )}
                <Button size="sm"
                  onClick={() => save.mutate({ p: p.id, key: draft })}
                  disabled={!draft.trim() || busy}
                >
                  <IconCheck className="h-4 w-4" />
                  {t`Lưu & kiểm tra`}
                </Button>
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Hiện khi bảng/hàm của phần AI chưa có trên máy chủ. Liệt kê đúng các
 * bước còn thiếu, kèm lệnh — người vận hành không phải đi tìm tài liệu.
 */
function SetupGuide() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-dashed p-5">
        <h3 className="mb-1 text-base font-semibold">
          {t`Phần trợ lý AI chưa được cài trên máy chủ này`}
        </h3>
        <p className="text-sm text-muted-foreground">
          <Trans>Giao diện đã lên nhưng cơ sở dữ liệu và hàm phía máy chủ thì chưa. Đây là
          bình thường: bản tự host áp migration bằng tay, nên frontend có thể lên
          trước. Làm ba bước dưới đây rồi tải lại trang.</Trans>
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        <li className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-semibold">{t`1. Áp ba migration`}</p>
          <pre className="overflow-x-auto rounded bg-secondary/60 p-3 text-xs">
{`# trên máy chủ database
for f in 20260823120000_ai_usage \\
         20260823140000_ai_messages \\
         20260823160000_ai_provider_keys; do
  docker exec -i supabase-db psql -U postgres -d postgres < "$f.sql"
done
# nhớ ghi vào bảng supabase_migrations.schema_migrations`}
          </pre>
        </li>

        <li className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-semibold">
            {t`2. Đẩy Edge Function và khởi động lại`}
          </p>
          <pre className="overflow-x-auto rounded bg-secondary/60 p-3 text-xs">
{`# thay <host> bằng máy chủ Supabase của bạn
scp -r supabase/functions/_shared \\
       supabase/functions/ai-chat \\
       supabase/functions/ai-admin \\
  <host>:<supabase-dir>/volumes/functions/

ssh <host> 'cd <supabase-dir> &&
  docker compose up -d --force-recreate functions'`}
          </pre>
        </li>

        <li className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-semibold">
            <Trans>
            3. Đặt khoá mã hoá cho dịch vụ <code>functions</code>
            </Trans>
          </p>
          <pre className="overflow-x-auto rounded bg-secondary/60 p-3 text-xs">
{`services:
  functions:
    environment:
      AI_KEY_ENCRYPTION_KEY: <openssl rand -base64 32>`}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            <Trans>Cất giá trị này cẩn thận: đổi nó là mọi khoá API đã lưu không giải mã
            được nữa và phải nhập lại.</Trans>
          </p>
        </li>
      </ol>

      <p className="text-sm text-muted-foreground">
        <Trans>
        Chi tiết đầy đủ nằm ở <code>supabase/functions/ai-chat/README.md</code>.
        </Trans>
      </p>
    </div>
  );
}

/**
 * Ô nhập số có chặn khoảng. Để rỗng thì KHÔNG gửi 0 lên máy chủ — 0 ở
 * đây có nghĩa riêng ("tắt hẳn"), lẫn với "chưa nhập gì" là đổi hành vi
 * hệ thống chỉ vì người dùng lỡ xoá ô.
 */
function NumberSetting({
  id,
  label,
  hint,
  value,
  range,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number | undefined;
  range: { min: number; max: number };
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={range.min}
        max={range.max}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return;
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
