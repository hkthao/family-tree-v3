import { useEffect, useState } from "react";

import type { ClanSummary } from "@/lib/queries/clans";
import { supabase } from "@/lib/supabase";

import "./app.css";
import { isZaloOnlyAccount, signInWithZalo } from "./auth";
import { LinkAccount } from "./LinkAccount";
import { ClansScreen } from "./screens/Clans";
import { PersonScreen } from "./screens/Person";
import { TreeScreen } from "./screens/Tree";

/**
 * Khung của Mini App: tự đăng nhập bằng Zalo rồi điều hướng giữa ba màn
 * hình chỉ-xem (dòng họ của tôi → cây thư mục → hồ sơ một người).
 *
 * Điều hướng là một CHỒNG màn hình trong state, không dùng router theo
 * đường dẫn: Mini App không có thanh địa chỉ, và chồng màn hình cho nút
 * quay lại đúng nghĩa "về chỗ vừa xem" (cây vẫn giữ các nhánh đã bung vì
 * màn hình bên dưới chỉ bị giấu đi chứ không gỡ).
 */
type Screen =
  | { kind: "clans" }
  | { kind: "tree"; clan: ClanSummary }
  | { kind: "person"; clan: ClanSummary; personId: string };

type Auth =
  | { kind: "loading" }
  | { kind: "ready"; userId: string; zaloOnly: boolean }
  | { kind: "error"; message: string };

export function App() {
  const [auth, setAuth] = useState<Auth>({ kind: "loading" });
  const [stack, setStack] = useState<Screen[]>([{ kind: "clans" }]);

  const login = () => {
    setAuth({ kind: "loading" });
    signInWithZalo()
      .then(async () => {
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("Không lấy được tài khoản.");
        setStack([{ kind: "clans" }]);
        setAuth({
          kind: "ready",
          userId: data.user.id,
          zaloOnly: isZaloOnlyAccount(data.user.email),
        });
      })
      .catch((e: Error) => setAuth({ kind: "error", message: e.message }));
  };
  useEffect(login, []);

  if (auth.kind === "loading") return <div className="page muted">Đang đăng nhập bằng Zalo…</div>;
  if (auth.kind === "error") {
    return (
      <div className="page">
        <p className="error">{auth.message}</p>
        <button type="button" className="btn" onClick={login}>Thử lại</button>
      </div>
    );
  }

  const push = (s: Screen) => setStack((st) => [...st, s]);
  const back = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
  const top = stack[stack.length - 1];
  const title =
    top.kind === "clans" ? "Dòng họ của tôi" : top.kind === "tree" ? top.clan.name : "Hồ sơ";

  return (
    <>
      <header className="topbar">
        {stack.length > 1 && (
          <button type="button" className="back" aria-label="Quay lại" onClick={back}>‹</button>
        )}
        <h1>{title}</h1>
      </header>

      {stack.map((s, i) => (
        // Màn hình bên dưới chỉ bị giấu, để quay lại còn nguyên trạng thái.
        <div key={i} style={{ display: i === stack.length - 1 ? undefined : "none" }}>
          {s.kind === "clans" && (
            <>
              <ClansScreen userId={auth.userId} openClan={(clan) => push({ kind: "tree", clan })} />
              {auth.zaloOnly && (
                <div className="page" style={{ paddingTop: 0 }}>
                  <LinkAccount onLinked={login} />
                </div>
              )}
            </>
          )}
          {s.kind === "tree" && (
            <TreeScreen
              clanId={s.clan.id}
              genOffset={s.clan.generation_offset ?? 0}
              openPerson={(personId) => push({ kind: "person", clan: s.clan, personId })}
            />
          )}
          {s.kind === "person" && (
            <PersonScreen
              clanId={s.clan.id}
              personId={s.personId}
              genOffset={s.clan.generation_offset ?? 0}
              openPerson={(personId) => push({ kind: "person", clan: s.clan, personId })}
            />
          )}
        </div>
      ))}
    </>
  );
}
