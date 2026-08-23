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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  AI_PROVIDERS,
  AiNotInstalledError,
  QA_MODELS,
  deleteProviderKey,
  getAiConfig,
  setAiEnabled,
  setQaModel,
  listKeyStatus,
  setProviderKey,
  testProviderKey,
  type AiProvider,
  type KeyStatus,
} from "@/lib/queries/aiAdmin";

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

  const toggleEnabled = useMutation({
    mutationFn: setAiEnabled,
    onSuccess: (_, on) => {
      qc.invalidateQueries({ queryKey: ["ai-config"] });
      qc.invalidateQueries({ queryKey: ["ai-enabled"] });
      toast.success(on ? "Đã bật trợ lý" : "Đã tắt trợ lý");
    },
    onError: (e: Error) => toast.error("Không đổi được", { description: e.message }),
  });

  const changeModel = useMutation({
    mutationFn: setQaModel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-config"] });
      toast.success("Đã đổi model");
    },
    onError: (e: Error) => toast.error("Không đổi được", { description: e.message }),
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
        toast.success("Đã lưu và kết nối được", {
          description: `Nhà cung cấp trả lời sau ${res.test.ms}ms.`,
        });
      } else {
        toast.error("Đã lưu nhưng kết nối thất bại", {
          description: res.test.error ?? "Kiểm tra lại khoá.",
        });
      }
    },
    onError: (e: Error) => toast.error("Không lưu được", { description: e.message }),
  });

  const test = useMutation({
    mutationFn: (p: AiProvider) => testProviderKey(p),
    onSuccess: (res) => {
      invalidate();
      if (res.test.ok) {
        toast.success("Kết nối tốt", {
          description: `${res.test.model} · ${res.test.ms}ms`,
        });
      } else {
        toast.error("Không kết nối được", {
          description: res.test.error ?? "Không rõ nguyên nhân.",
        });
      }
    },
    onError: (e: Error) => toast.error("Lỗi kiểm tra", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (p: AiProvider) => deleteProviderKey(p),
    onSuccess: () => {
      invalidate();
      toast.success("Đã xoá khoá");
    },
    onError: (e: Error) => toast.error("Không xoá được", { description: e.message }),
  });

  if (statusQ.isLoading) return <LoadingState label="Đang tải cấu hình…" />;

  // Frontend có thể lên trước database: prod là Supabase tự host, migration
  // áp bằng tay. Hiện hướng dẫn thay vì quăng lỗi PostgREST thô.
  if (statusQ.error instanceof AiNotInstalledError) return <SetupGuide />;

  if (statusQ.error) {
    return (
      <ErrorState
        title="Không tải được cấu hình"
        error={statusQ.error}
        onRetry={() => statusQ.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border bg-secondary/40 p-4 text-sm">
        <p className="mb-1 font-semibold">Khoá được mã hoá trước khi lưu</p>
        <p className="text-muted-foreground">
          Khoá mã hoá bằng AES-256-GCM ngay tại máy chủ hàm, khoá giải mã nằm ở biến
          môi trường <code>AI_KEY_ENCRYPTION_KEY</code> — cơ sở dữ liệu không bao giờ
          thấy khoá gốc. Cách này chặn được rò rỉ qua bản sao lưu hay truy vấn nhầm;
          nó <b>không</b> chặn được người đã vào được máy chủ.
        </p>
        <p className="mt-2 text-muted-foreground">
          Đổi <code>AI_KEY_ENCRYPTION_KEY</code> sẽ làm mọi khoá đã lưu không giải mã
          được nữa — phải nhập lại ở đây.
        </p>
      </div>

      <section className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Công tắc tổng</h3>
            <p className="text-sm text-muted-foreground">
              Tắt thì trợ lý ẩn hoàn toàn với mọi dòng họ, kể cả dòng họ đã bật
              tính năng. Mặc định tắt.
            </p>
          </div>
          <Button
            variant={configQ.data?.enabled ? "outline" : "default"}
            disabled={configQ.isLoading || toggleEnabled.isPending}
            onClick={() => toggleEnabled.mutate(!configQ.data?.enabled)}
          >
            <IconSparkles className="h-4 w-4" />
            {configQ.data?.enabled ? "Đang bật — bấm để tắt" : "Đang tắt — bấm để bật"}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
          <label htmlFor="qa-model" className="text-sm font-medium">
            Model cho hỏi đáp
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
            Phải có khoá của nhà cung cấp tương ứng ở dưới thì model mới chạy.
          </p>
        </div>
      </section>

      {AI_PROVIDERS.map((p) => {
        const st = byProvider.get(p.id);
        const draft = drafts[p.id] ?? "";
        const busy =
          (save.isPending && save.variables?.p === p.id) ||
          (test.isPending && test.variables === p.id) ||
          (remove.isPending && remove.variables === p.id);

        return (
          <section key={p.id} className="rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{p.label}</h3>
              {st ? (
                <span className="rounded-full border px-2 py-0.5 font-mono text-xs">
                  {st.hint}
                </span>
              ) : (
                <span className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
                  chưa cắm khoá
                </span>
              )}
              {st?.last_test_ok === true && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                  kết nối tốt · {st.last_test_ms}ms
                </span>
              )}
              {st?.last_test_ok === false && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                  lỗi kết nối
                </span>
              )}
            </div>

            {st?.last_test_ok === false && st.last_test_error && (
              <p className="mb-3 break-words rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                {st.last_test_error}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                icon={<IconKey />}
                type="password"
                autoComplete="off"
                value={draft}
                placeholder={st ? "Nhập khoá mới để thay" : p.hint}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                }
                className="flex-1 font-mono"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => save.mutate({ p: p.id, key: draft })}
                  disabled={!draft.trim() || busy}
                >
                  <IconCheck className="h-4 w-4" />
                  Lưu &amp; kiểm tra
                </Button>
                {st && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => test.mutate(p.id)}
                      disabled={busy}
                    >
                      <IconRefresh className="h-4 w-4" />
                      Kiểm tra
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-destructive"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Xoá khoá ${p.label}?`,
                          description:
                            "Trợ lý sẽ ngừng dùng được nhà cung cấp này cho tới khi cắm khoá mới.",
                          confirmLabel: "Xoá",
                          destructive: true,
                        });
                        if (ok) remove.mutate(p.id);
                      }}
                    >
                      <IconTrash className="h-4 w-4" />
                      Xoá
                    </Button>
                  </>
                )}
              </div>
            </div>

            {st && (
              <p className="mt-2 text-xs text-muted-foreground">
                Cập nhật {new Date(st.updated_at).toLocaleString("vi-VN")}
                {st.last_test_at &&
                  ` · kiểm tra lần cuối ${new Date(st.last_test_at).toLocaleString("vi-VN")}`}
              </p>
            )}
          </section>
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
          Phần trợ lý AI chưa được cài trên máy chủ này
        </h3>
        <p className="text-sm text-muted-foreground">
          Giao diện đã lên nhưng cơ sở dữ liệu và hàm phía máy chủ thì chưa. Đây là
          bình thường: bản tự host áp migration bằng tay, nên frontend có thể lên
          trước. Làm ba bước dưới đây rồi tải lại trang.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        <li className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-semibold">1. Áp ba migration</p>
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
            2. Đẩy Edge Function và khởi động lại
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
            3. Đặt khoá mã hoá cho dịch vụ <code>functions</code>
          </p>
          <pre className="overflow-x-auto rounded bg-secondary/60 p-3 text-xs">
{`services:
  functions:
    environment:
      AI_KEY_ENCRYPTION_KEY: <openssl rand -base64 32>`}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Cất giá trị này cẩn thận: đổi nó là mọi khoá API đã lưu không giải mã
            được nữa và phải nhập lại.
          </p>
        </li>
      </ol>

      <p className="text-sm text-muted-foreground">
        Chi tiết đầy đủ nằm ở <code>supabase/functions/ai-chat/README.md</code>.
      </p>
    </div>
  );
}
