import { useState } from "react";

import { confirmAccountLink, requestAccountLink } from "./auth";
import { toast } from "./toast";

/**
 * Liên kết Zalo với tài khoản đã có trên web (bước 3 của kế hoạch).
 *
 * Người đăng ký bằng email trên web mà mở Mini App sẽ vào một tài khoản
 * mới tinh, không thấy dòng họ của mình. Nhập email → nhận mã qua thư →
 * nhập mã là Zalo này dùng chung tài khoản cũ.
 *
 * Chỉ là phần thân form: màn Tài khoản đặt nó trong một dòng của nhóm
 * "Tài khoản liên kết", cùng kiểu danh sách thiết lập với cả màn.
 */
export function LinkAccount({ onLinked }: { onLinked: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    fn()
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <div className="link">
      <p className="note" style={{ marginTop: 0 }}>
        Đã lập gia phả trên web bằng email? Liên kết để thấy các dòng họ đó ngay trong Zalo.
      </p>

      {step === "email" ? (
        <>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email đã đăng ký"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
          <button
            type="button"
            disabled={busy || !email.trim()}
            className="btn block"
            onClick={() =>
              run(async () => {
                await requestAccountLink(email.trim());
                setStep("code");
              })
            }
          >
            {busy ? "Đang gửi…" : "Gửi mã xác nhận"}
          </button>
        </>
      ) : (
        <>
          <p className="note" style={{ fontSize: 14 }}>
            Nếu <b>{email}</b> có tài khoản, mã 6 số đã được gửi tới đó (hiệu
            lực 10 phút).
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Mã 6 số"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="field"
            style={{ letterSpacing: 6, textAlign: "center", fontWeight: 600 }}
          />
          <button
            type="button"
            disabled={busy || code.length !== 6}
            className="btn block"
            onClick={() =>
              run(async () => {
                await confirmAccountLink(code);
                toast("Đã liên kết tài khoản");
                onLinked();
              })
            }
          >
            {busy ? "Đang kiểm tra…" : "Liên kết"}
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn text block"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Đổi email
          </button>
        </>
      )}

      {error && <p className="error" style={{ margin: "10px 0 0" }}>{error}</p>}
    </div>
  );
}
