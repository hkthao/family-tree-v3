import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import { isZaloOnlyAccount, signInWithZalo } from "./auth";
import { LinkAccount } from "./LinkAccount";

/**
 * Bước 2–3 của kế hoạch (docs/plan-zalo-mini-app.md): màn hình KIỂM CHỨNG
 * đăng nhập và liên kết tài khoản, chưa phải giao diện thật. Mở app → tự
 * đăng nhập bằng Zalo → hiện tên tài khoản → mời liên kết tài khoản web.
 * Màn hình xem cây (bước 4) sẽ thay chỗ này.
 */
type State =
  | { kind: "loading" }
  | { kind: "ready"; name: string; isNew: boolean; zaloOnly: boolean }
  | { kind: "error"; message: string };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const login = () => {
    setState({ kind: "loading" });
    signInWithZalo()
      .then(async ({ isNew }) => {
        const { data } = await supabase.auth.getUser();
        const name =
          (data.user?.user_metadata?.display_name as string | undefined) ??
          "bạn";
        setState({
          kind: "ready",
          name,
          isNew,
          zaloOnly: isZaloOnlyAccount(data.user?.email),
        });
      })
      .catch((e: Error) => setState({ kind: "error", message: e.message }));
  };
  useEffect(login, []);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Dòng Họ Việt</h1>

      {state.kind === "loading" && <p>Đang đăng nhập bằng Zalo…</p>}

      {state.kind === "ready" && (
        <p>
          Xin chào <b>{state.name}</b>.{" "}
          {state.isNew
            ? "Tài khoản của bạn vừa được tạo."
            : "Bạn đã đăng nhập."}
        </p>
      )}

      {/* Chỉ mời liên kết khi đang ở tài khoản tạo từ Zalo; đã liên kết
          rồi (email thật) thì không còn gì để làm ở đây. */}
      {state.kind === "ready" && state.zaloOnly && <LinkAccount onLinked={login} />}

      {state.kind === "error" && (
        <>
          <p style={{ color: "#B3261E" }}>{state.message}</p>
          <button type="button" onClick={login} style={{ padding: "8px 16px" }}>
            Thử lại
          </button>
        </>
      )}
    </main>
  );
}
