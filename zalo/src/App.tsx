import { useEffect, useState } from "react";
import { closeApp, setNavigationBarLeftButton, setNavigationBarTitle } from "zmp-sdk";

import { IconBuildings, IconCalendar, IconUser } from "@/components/icons";
import type { ClanSummary } from "@/lib/queries/clans";
import { getMyProfile } from "@/lib/queries/profile";
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
import { listenBack, pushBack } from "./nav";
import { scrollTopScreen } from "./scroll";
import { AddRelativeScreen } from "./screens/AddRelative";
import { ClanScreen } from "./screens/Clan";
import { EditPersonScreen } from "./screens/EditPerson";

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
  | { kind: "person"; clan: ClanSummary; personId: string }
  | { kind: "edit"; clan: ClanSummary; personId: string }
  | { kind: "add"; clan: ClanSummary; personId: string; relation: "spouse" | "child" };

/**
 * Không phải thành viên (họ công khai ở mục Cộng đồng) thì đọc qua bản đã
 * che — đúng luật riêng tư của web: người ngoài không thấy thông tin chi
 * tiết của người còn sống.
 */
const sourceOf = (clan: ClanSummary) =>
  clan.role ? ("persons" as const) : ("persons_public_safe" as const);

/** Thời gian trượt màn hình — phải khớp với `.screen.in/.out` trong app.css. */
const SLIDE_MS = 240;

type Tab = "clans" | "anniv" | "account";

const TABS: { id: Tab; label: string; title: string; icon: JSX.Element }[] = [
  { id: "clans", label: "Dòng họ", title: "Dòng Họ Việt", icon: <IconBuildings /> },
  { id: "anniv", label: "Sự kiện", title: "Sự kiện", icon: <IconCalendar /> },
  { id: "account", label: "Tài khoản", title: "Tài khoản", icon: <IconUser /> },
];

type Auth =
  | { kind: "loading" }
  | { kind: "ready"; userId: string; email: string | null; name: string; zaloOnly: boolean }
  | { kind: "error"; message: string }
  | { kind: "dev-login"; message?: string }
  | { kind: "deleted" };

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
  const [leaving, setLeaving] = useState(false);
  // Tăng sau mỗi lần lưu, để màn hồ sơ bên dưới tải lại dữ liệu mới.
  const [rev, setRev] = useState(0);

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
          email: data.user.email ?? null,
          // Tên thật nằm ở bảng profiles (người dùng sửa được); metadata
          // của phiên đăng nhập chỉ là giá trị lúc tạo tài khoản.
          name:
            (await getMyProfile(data.user.id).catch(() => null))?.display_name ??
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

  // Nút quay lại là của ZALO (trên thanh tiêu đề gốc); nó lùi lịch sử trình
  // duyệt. Mọi bước tiến đều đăng ký cách hoàn tác qua `pushBack` (xem nav.ts).
  useEffect(listenBack, []);
  const push = (s: Screen) => {
    setStack((st) => [...st, s]);
    pushBack(() => {
      // Cho màn hình trên cùng TRƯỢT RA trước rồi mới gỡ khỏi chồng — gỡ
      // ngay thì nó biến mất cái rụp, không ra dáng app.
      setLeaving(true);
      window.setTimeout(() => {
        setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
        setLeaving(false);
      }, SLIDE_MS);
    });
  };

  const top = stack[stack.length - 1];
  const title =
    top.kind === "clans"
      ? TABS.find((t) => t.id === tab)!.title
      : top.kind === "tree"
        ? top.clan.name
        : top.kind === "edit"
          ? "Sửa hồ sơ"
          : top.kind === "add"
            ? top.relation === "spouse" ? "Thêm vợ / chồng" : "Thêm con"
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
  if (auth.kind === "deleted") {
    return (
      <div className="center">
        <b className="serif" style={{ fontSize: 19 }}>Tài khoản đã được xoá</b>
        <p className="muted" style={{ margin: 0, maxWidth: 300 }}>
          Dữ liệu tài khoản của bạn đã bị xoá vĩnh viễn. Bạn có thể đóng ứng
          dụng. Nếu mở lại, một tài khoản mới sẽ được tạo từ Zalo của bạn.
        </p>
        <button type="button" className="btn ghost" onClick={() => closeApp({}).catch(() => {})}>Đóng ứng dụng</button>
        <button type="button" className="btn text" onClick={login}>Tạo tài khoản mới</button>
      </div>
    );
  }
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
      {stack.map((s, i) => {
        // Mỗi màn hình là một khung cuộn RIÊNG phủ kín màn hình, xếp chồng
        // lên nhau: màn mới trượt vào từ phải, lùi thì trượt ra; màn bên
        // dưới giữ nguyên trạng thái lẫn vị trí cuộn. Chỉ hai màn trên cùng
        // được vẽ, các màn sâu hơn ẩn đi cho nhẹ máy.
        const fromTop = stack.length - 1 - i;
        const cls =
          fromTop === 0
            ? `screen top${i > 0 ? (leaving ? " out" : " in") : ""}`
            : fromTop === 1
              ? "screen under"
              : "screen hidden";
        return (
        <div key={i} className={`${cls}${isLocalDev && i > 0 ? " with-devbar" : ""}`}>
          {s.kind === "clans" && (
            // Ba tab gốc đều được giữ sẵn (chỉ giấu), đổi tab không tải lại.
            <div className="has-tabs">
              <div className="tabpane" style={{ display: tab === "clans" ? undefined : "none" }}>
                <ClansScreen
                  userId={auth.userId}
                  openClan={(clan) => push({ kind: "tree", clan })}
                />
              </div>
              <div className="tabpane" style={{ display: tab === "anniv" ? undefined : "none" }}>
                <AnniversariesScreen
                  userId={auth.userId}
                  openPerson={(clan, personId) => push({ kind: "person", clan, personId })}
                />
              </div>
              <div className="tabpane" style={{ display: tab === "account" ? undefined : "none" }}>
                <AccountScreen
                  userId={auth.userId}
                  email={auth.email}
                  name={auth.name}
                  zaloOnly={auth.zaloOnly}
                  onLinked={login}
                  onRenamed={(name) => setAuth((a) => (a.kind === "ready" ? { ...a, name } : a))}
                  onDeleted={() => {
                    // KHÔNG tự đăng nhập lại: mở Mini App là Zalo cấp ngay một
                    // tài khoản mới, người vừa xoá sẽ tưởng xoá không thành.
                    void supabase.auth.signOut({ scope: "local" });
                    setStack([{ kind: "clans" }]);
                    setAuth({ kind: "deleted" });
                  }}
                />
              </div>
            </div>
          )}
          {s.kind === "tree" && (
            <ClanScreen
              clan={s.clan}
              source={sourceOf(s.clan)}
              openPerson={(personId) => push({ kind: "person", clan: s.clan, personId })}
            />
          )}
          {s.kind === "person" && (
            <PersonScreen
              clanId={s.clan.id}
              clanName={s.clan.name}
              personId={s.personId}
              source={sourceOf(s.clan)}
              genOffset={s.clan.generation_offset ?? 0}
              rev={rev}
              // Quyền sửa do cơ sở dữ liệu kiểm; ở đây chỉ để khỏi bày nút
              // cho người chắc chắn không sửa được.
              onEdit={
                s.clan.role === "admin" || s.clan.role === "editor"
                  ? () => push({ kind: "edit", clan: s.clan, personId: s.personId })
                  : undefined
              }
              onAdd={
                s.clan.role === "admin" || s.clan.role === "editor"
                  ? (relation) => push({ kind: "add", clan: s.clan, personId: s.personId, relation })
                  : undefined
              }
              openPerson={(personId) => push({ kind: "person", clan: s.clan, personId })}
            />
          )}
          {s.kind === "add" && (
            <AddRelativeScreen
              clanId={s.clan.id}
              personId={s.personId}
              relation={s.relation}
              onSaved={() => {
                setRev((n) => n + 1);
                window.history.back();
              }}
            />
          )}
          {s.kind === "edit" && (
            <EditPersonScreen
              personId={s.personId}
              onSaved={() => {
                setRev((n) => n + 1);
                window.history.back();
              }}
            />
          )}
        </div>
        );
      })}

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
                scrollTopScreen();
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
