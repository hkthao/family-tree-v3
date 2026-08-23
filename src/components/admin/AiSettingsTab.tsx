import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AI_PROVIDERS,
  deleteProviderKey,
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

  const statusQ = useQuery({
    queryKey: ["ai-provider-keys"],
    queryFn: listKeyStatus,
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
                  Lưu &amp; kiểm tra
                </Button>
                {st && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => test.mutate(p.id)}
                      disabled={busy}
                    >
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
