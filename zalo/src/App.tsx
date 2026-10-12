import { useEffect, useState } from "react";
import { setNavigationBarLeftButton, setNavigationBarTitle } from "zmp-sdk";

import type { ClanSummary } from "@/lib/queries/clans";
import { supabase } from "@/lib/supabase";

import "./app.css";
import {
  devSignIn,
  isLocalDev,
  isZaloOnlyAccount,
  NotInZaloError,
  signInWithZalo,
} from "./auth";
import { AccountScreen } from "./screens/Account";
import { AnniversariesScreen } from "./screens/Anniversaries";
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

/**
 * Không phải thành viên (họ công khai ở mục Cộng đồng) thì đọc qua bản đã
 * che — đúng luật riêng tư của web: người ngoài không thấy thông tin chi
 * tiết của người còn sống.
 */
const sourceOf = (clan: ClanSummary) =>
  clan.role ? ("persons" as const) : ("persons_public_safe" as const);

type Tab = "clans" | "anniv" | "account";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const TABS: { id: Tab; label: string; title: string; icon: JSX.Element }[] = [
  { id: "clans", label: "Dòng họ", title: "Dòng Họ Việt", icon: icon("M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M10 21v-6h4v6") },
  { id: "anniv", label: "Ngày giỗ", title: "Ngày giỗ sắp tới", icon: icon("M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z") },
  { id: "account", label: "Tài khoản", title: "Tài khoản", icon: icon("M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z") },
];

type Auth =
  | { kind: "loading" }
  | { kind: "ready"; userId: string; name: string; zaloOnly: boolean }
  | { kind: "error"; message: string }
  | { kind: "dev-login"; message?: string };

/** Form đăng nhập cho lúc lập trình trên máy tính — xem `devSignIn`. */
function DevLogin({ message, onDone }: { message?: string; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(message);
  return (
    <form
      className="page"
      onSubmit={(e) => {
        e.preventDefault();
        devSignIn(email.trim(), password)
          .then(onDone)
          .catch((er: Error) => setError(er.message));
      }}
    >
      <p className="muted">
        Chế độ lập trình (localhost): không có Zalo nên đăng nhập bằng tài
        khoản web. Form này không có trong bản đưa lên Zalo.
      </p>
      <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 12 }} />
      <input className="field" type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} style={{ margin: "10px 0" }} />
      <button type="submit" className="btn block">Đăng nhập</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

export function App() {
  const [auth, setAuth] = useState<Auth>({ kind: "loading" });
  const [stack, setStack] = useState<Screen[]>([{ kind: "clans" }]);
  const [tab, setTab] = useState<Tab>("clans");

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
          name:
            (data.user.user_metadata?.display_name as string | undefined) ??
            "bạn",
          zaloOnly: isZaloOnlyAccount(data.user.email),
        });
      })
      .catch((e: Error) =>
        setAuth(
          isLocalDev && e instanceof NotInZaloError
            ? { kind: "dev-login" }
            : { kind: "error", message: e.message },
        ),
      );
  };
  useEffect(login, []);

  // Nút quay lại là của ZALO (trên thanh tiêu đề gốc), nó gọi lùi lịch sử
  // trình duyệt. Nên mỗi lần mở màn hình mới ta đẩy một mốc lịch sử, và
  // nghe sự kiện lùi để gỡ màn hình trên cùng — vuốt ngược trên Android
  // cũng đi đúng đường này.
  useEffect(() => {
    const onPop = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const push = (s: Screen) => {
    window.history.pushState({ depth: stack.length }, "");
    setStack((st) => [...st, s]);
  };

  const top = stack[stack.length - 1];
  const title =
    top.kind === "clans"
      ? TABS.find((t) => t.id === tab)!.title
      : top.kind === "tree"
        ? top.clan.name
        : "Hồ sơ";
  const canGoBack = stack.length > 1;
  useEffect(() => {
    // Ngoài Zalo (giả lập máy tính) hai lệnh này không có gì để điều khiển.
    setNavigationBarTitle({ title }).catch(() => {});
    setNavigationBarLeftButton({ type: canGoBack ? "back" : "none" }).catch(() => {});
  }, [title, canGoBack]);

  if (auth.kind === "loading") {
    return (
      <div className="center">
        <div className="sk" style={{ width: 64, height: 64, borderRadius: 20 }} />
        <p className="muted">Đang đăng nhập…</p>
      </div>
    );
  }
  if (auth.kind === "dev-login") return <DevLogin message={auth.message} onDone={login} />;
  if (auth.kind === "error") {
    return (
      <div className="center">
        <p className="error">{auth.message}</p>
        <button type="button" className="btn" onClick={login}>Thử lại</button>
      </div>
    );
  }

  return (
    <>
      {/* Trên Zalo đã có thanh tiêu đề + nút quay lại gốc. Giả lập máy tính
          cũng tự vẽ tiêu đề nhưng không có nút quay lại, nên chỉ thêm đúng
          một nút đó khi lập trình. */}
      {isLocalDev && canGoBack && (
        <div className="devbar">
          <button type="button" onClick={() => window.history.back()}>‹ Quay lại</button>
        </div>
      )}
      {stack.map((s, i) => (
        // Màn hình bên dưới chỉ bị giấu, để quay lại còn nguyên trạng thái.
        <div key={i} style={{ display: i === stack.length - 1 ? undefined : "none" }}>
          {s.kind === "clans" && (
            // Ba tab gốc đều được giữ sẵn (chỉ giấu), đổi tab không tải lại.
            <div className="has-tabs">
              <div style={{ display: tab === "clans" ? undefined : "none" }}>
                <ClansScreen
                  userId={auth.userId}
                  openClan={(clan) => push({ kind: "tree", clan })}
                />
              </div>
              <div style={{ display: tab === "anniv" ? undefined : "none" }}>
                <AnniversariesScreen
                  userId={auth.userId}
                  openPerson={(clan, personId) => push({ kind: "person", clan, personId })}
                />
              </div>
              <div style={{ display: tab === "account" ? undefined : "none" }}>
                <AccountScreen name={auth.name} zaloOnly={auth.zaloOnly} onLinked={login} />
              </div>
            </div>
          )}
          {s.kind === "tree" && (
            <TreeScreen
              clanId={s.clan.id}
              source={sourceOf(s.clan)}
              genOffset={s.clan.generation_offset ?? 0}
              openPerson={(personId) => push({ kind: "person", clan: s.clan, personId })}
            />
          )}
          {s.kind === "person" && (
            <PersonScreen
              clanId={s.clan.id}
              personId={s.personId}
              source={sourceOf(s.clan)}
              genOffset={s.clan.generation_offset ?? 0}
              openPerson={(personId) => push({ kind: "person", clan: s.clan, personId })}
            />
          )}
        </div>
      ))}

      {/* Tab chỉ hiện ở màn hình gốc; vào cây/hồ sơ thì nhường chỗ cho nội dung. */}
      {!canGoBack && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => {
                setTab(t.id);
                window.scrollTo(0, 0);
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </>
  );
}
