import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { openWebview } from "zmp-sdk";

import { IconChevronDown } from "@/components/icons";
import {
  countMyBlockingClans,
  deleteMyAccount,
  getMyProfile,
  updateMyDisplayName,
  updateMyMonthlyLunarPref,
  updateMyWeeklyDigestPref,
} from "@/lib/queries/profile";
import { formatDate } from "@/lib/formatDate";
import { supabase } from "@/lib/supabase";
import { getTheme, setTheme, type Theme } from "@/lib/theme";

import {
  confirmEmailChange,
  forgetZaloLeftovers,
  getLinkStatus,
  requestEmailChange,
  unlinkZalo,
} from "../auth";
import { LinkAccount } from "../LinkAccount";
import { toast } from "../toast";
import { useAsync } from "../useAsync";

/**
 * Tài khoản — CÙNG CHỨC NĂNG với trang Tài khoản của bản web (tên hiển thị,
 * mật khẩu, bản tin tuần, nhắc mùng 1/rằm, giao diện) nhưng trình bày kiểu
 * danh sách thiết lập của điện thoại: nhóm dòng, công tắc bên phải, bấm
 * dòng để mở phần sửa — thay cho mỗi thiết lập một thẻ lớn như trên web.
 *
 * Không có ở đây, vì không hợp với Mini App: thông báo đẩy của trình duyệt,
 * đăng nhập bằng QR, đăng xuất (vào Mini App là tự đăng nhập bằng Zalo), và
 * dòng họ đang theo dõi.
 */
/** Một nhóm thiết lập kiểu danh sách của điện thoại: tiêu đề nhỏ + khối bo góc. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 className="grouptitle">{title}</h3>
      <div className="card group">{children}</div>
    </>
  );
}

/** Trạng thái lưu của một dòng: đang lưu / báo xong / báo lỗi. */
function useSave() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setMsg(null);
    fn()
      .then(() => toast(done))
      .catch((e: Error) => {
        setMsg({ ok: false, text: e.message });
        toast(e.message, "error");
      })
      .finally(() => setBusy(false));
  };
  const note = msg && <p className={msg.ok ? "ok" : "error"}>{msg.text}</p>;
  return { busy, run, note };
}

/** Dòng bấm để mở phần sửa ngay bên dưới (thay cho cả một thẻ như trên web). */
function ExpandRow({
  label,
  value,
  danger,
  defaultOpen = false,
  children,
}: {
  label: string;
  value?: string;
  danger?: boolean;
  defaultOpen?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="grow">
      <button type="button" className="growhead" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={danger ? "dangertext" : undefined}>{label}</span>
        <span className="val">{value}</span>
        <span className={`chev${open ? "" : " closed"}`} style={{ margin: 0, width: 24, height: 24 }}><IconChevronDown /></span>
      </button>
      {open && <div className="growbody">{children(() => setOpen(false))}</div>}
    </div>
  );
}

function DisplayName({ userId, current, onSaved }: { userId: string; current: string; onSaved: (n: string) => void }) {
  const [name, setName] = useState(current);
  useEffect(() => setName(current), [current]);
  const save = useSave();
  const changed = name.trim() !== current.trim() && !!name.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!changed) return;
    const next = name.trim();
    save.run(async () => {
      await updateMyDisplayName(userId, next);
      onSaved(next);
    }, "Đã đổi tên hiển thị");
  };
  return (
    <ExpandRow label="Tên hiển thị" value={current}>
      {() => (
        <form onSubmit={submit}>
          <p className="note" style={{ marginTop: 0 }}>Tên hiển thị trong dòng họ và các sự kiện. Không phải email.</p>
          <input className="field" aria-label="Tên hiển thị" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="btn block" style={{ marginTop: 8 }} disabled={!changed || save.busy}>
            {save.busy ? "Đang lưu…" : "Lưu"}
          </button>
          {save.note}
        </form>
      )}
    </ExpandRow>
  );
}

function Password() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const save = useSave();
  const tooShort = pw.length > 0 && pw.length < 8;
  const mismatch = pw2.length > 0 && pw !== pw2;
  const ok = pw.length >= 8 && pw === pw2;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    save.run(async () => {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw new Error(error.message);
      setPw("");
      setPw2("");
    }, "Đã đổi mật khẩu");
  };
  return (
    <ExpandRow label="Mật khẩu" value="Đổi">
      {() => (
        <form onSubmit={submit}>
          <p className="note" style={{ marginTop: 0 }}>Ít nhất 8 ký tự. Dùng khi đăng nhập bằng email.</p>
          <input className="field" type="password" autoComplete="new-password" placeholder="Mật khẩu mới" aria-label="Mật khẩu mới" value={pw} onChange={(e) => setPw(e.target.value)} />
          {tooShort && <p className="error" style={{ margin: "4px 0 0", fontSize: 12 }}>Mật khẩu cần ít nhất 8 ký tự.</p>}
          <input className="field" style={{ marginTop: 8 }} type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" aria-label="Xác nhận mật khẩu mới" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          {mismatch && <p className="error" style={{ margin: "4px 0 0", fontSize: 12 }}>Hai mật khẩu chưa khớp.</p>}
          <button type="submit" className="btn block" style={{ marginTop: 8 }} disabled={!ok || save.busy}>
            {save.busy ? "Đang lưu…" : "Đổi mật khẩu"}
          </button>
          {save.note}
        </form>
      )}
    </ExpandRow>
  );
}

/** Dòng có công tắc bên phải — bật/tắt là lưu ngay. */
function SwitchRow({
  title,
  desc,
  value,
  disabledNote,
  onChange,
}: {
  title: string;
  desc: string;
  value: boolean;
  disabledNote?: string;
  onChange: (v: boolean) => Promise<void>;
}) {
  const [on, setOn] = useState(value);
  useEffect(() => setOn(value), [value]);
  const save = useSave();
  return (
    <div className="grow">
      <label className="switchrow">
        <span style={{ minWidth: 0 }}>
          <b>{title}</b>
          <span className="note" style={{ display: "block", margin: "2px 0 0" }}>{disabledNote ?? desc}</span>
        </span>
        <input
          type="checkbox"
          className="switch"
          role="switch"
          checked={on}
          disabled={save.busy || !!disabledNote}
          onChange={(e) => {
            const v = e.target.checked;
            setOn(v);
            save.run(async () => {
              try {
                await onChange(v);
              } catch (err) {
                setOn(!v); // lưu hỏng thì trả công tắc về như cũ
                throw err;
              }
            }, v ? "Đã bật" : "Đã tắt");
          }}
        />
      </label>
      {save.note && <div style={{ padding: "0 14px 10px" }}>{save.note}</div>}
    </div>
  );
}

/**
 * Xoá tài khoản — cùng hàm và cùng hai lớp chặn với bản web: không xoá được
 * khi còn sở hữu dòng họ có thành viên, và phải gõ "XOA" mới bấm được nút.
 * Việc này không hoàn tác được nên không có đường tắt nào.
 */
function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const blocking = useAsync(() => countMyBlockingClans(), []);
  const save = useSave();
  const count = blocking.data ?? 0;
  const blocked = count > 0;
  // Chưa đếm xong thì chưa cho xoá: không biết có bị chặn hay không.
  const canSubmit = !blocking.loading && !blocking.error && !blocked && confirmText.trim() === "XOA";

  return (
    <>
      <p className="note" style={{ marginTop: 0 }}>
        Hành động này không thể hoàn tác. Nếu bạn đang sở hữu dòng họ có thành
        viên, hãy chuyển quyền hoặc xoá dòng họ trước.
      </p>
      {blocking.error && <p className="error">{blocking.error}</p>}
      {blocked && (
        <p className="error">
          Bạn còn sở hữu {count} dòng họ có thành viên. Phải chuyển quyền hoặc
          xoá dòng họ trước khi xoá tài khoản.
        </p>
      )}
      <label className="lbl" htmlFor="confirm-delete">Gõ <b>XOA</b> để xác nhận</label>
      <input
        id="confirm-delete"
        className="field"
        autoCapitalize="characters"
        autoComplete="off"
        value={confirmText}
        disabled={blocked}
        onChange={(e) => setConfirmText(e.target.value)}
      />
      <button
        type="button"
        className="btn danger block"
        style={{ marginTop: 8 }}
        disabled={!canSubmit || save.busy}
        onClick={() =>
          save.run(async () => {
            await deleteMyAccount();
            await forgetZaloLeftovers();
            onDeleted();
          }, "Đã xoá tài khoản")
        }
      >
        {save.busy ? "Đang xoá…" : "Xoá tài khoản vĩnh viễn"}
      </button>
      {save.note}
    </>
  );
}

/**
 * Đổi email (hoặc thêm email cho tài khoản mới chỉ có Zalo). Hai bước: gửi
 * mã tới địa chỉ MỚI rồi nhập mã — phải chứng minh đọc được hộp thư đó.
 */
function ChangeEmail({ current, onChanged }: { current: string | null; onChanged: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const save = useSave();
  return (
    <ExpandRow label="Email" value={current ?? "Thêm email"}>
      {() =>
        step === "email" ? (
          <>
            <p className="note" style={{ marginTop: 0 }}>
              {current
                ? "Nhập email mới. Mã xác nhận sẽ được gửi tới địa chỉ đó."
                : "Thêm email để nhận thư nhắc và đăng nhập bằng email. Mã xác nhận sẽ được gửi tới địa chỉ đó."}
            </p>
            <input className="field" type="email" inputMode="email" autoComplete="email" placeholder="ten@vidu.com" aria-label="Email mới" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button
              type="button"
              className="btn block"
              style={{ marginTop: 8 }}
              disabled={save.busy || !email.trim() || email.trim().toLowerCase() === (current ?? "").toLowerCase()}
              onClick={() =>
                save.run(async () => {
                  await requestEmailChange(email.trim());
                  setStep("code");
                }, "Đã gửi mã xác nhận")
              }
            >
              {save.busy ? "Đang gửi…" : "Gửi mã xác nhận"}
            </button>
            {save.note}
          </>
        ) : (
          <>
            <p className="note" style={{ marginTop: 0 }}>
              Nhập mã 6 số đã gửi tới <b>{email.trim()}</b> (hiệu lực 10 phút).
            </p>
            <input className="field" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Mã 6 số" aria-label="Mã xác nhận" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ letterSpacing: 6, textAlign: "center", fontWeight: 600 }} />
            <button
              type="button"
              className="btn block"
              style={{ marginTop: 8 }}
              disabled={save.busy || code.length !== 6}
              onClick={() =>
                save.run(async () => {
                  await confirmEmailChange(code);
                  onChanged();
                }, "Đã đổi email")
              }
            >
              {save.busy ? "Đang kiểm tra…" : "Xác nhận"}
            </button>
            <button type="button" className="btn text block" style={{ marginTop: 10 }} disabled={save.busy} onClick={() => { setStep("email"); setCode(""); }}>
              Dùng email khác
            </button>
            {save.note}
          </>
        )
      }
    </ExpandRow>
  );
}

/**
 * Tài khoản liên kết: Zalo này đang nối với tài khoản email nào, và nút bỏ
 * liên kết. Phải bấm hai lần mới bỏ — bỏ xong là Mini App không còn thấy
 * các dòng họ của tài khoản đó (dữ liệu thì vẫn nguyên trên web).
 */
function LinkedAccounts({ email, onUnlinked }: { email: string | null; onUnlinked: () => void }) {
  const status = useAsync(() => getLinkStatus(), []);
  const [confirming, setConfirming] = useState(false);
  const save = useSave();
  const s = status.data;

  return (
    <Group title="Tài khoản liên kết">
      <div className="grow">
        <div className="growhead" style={{ cursor: "default" }}>
          <span>Zalo</span>
          <span className="val">
            {status.loading ? "Đang kiểm tra…" : s?.linked ? `Đã liên kết${s.linkedAt ? ` · ${formatDate(s.linkedAt)}` : ""}` : "Đang dùng"}
          </span>
        </div>
      </div>
      <div className="grow">
        <div className="growhead" style={{ cursor: "default" }}>
          <span>Email</span>
          <span className="val">{s?.email ?? email ?? "—"}</span>
        </div>
      </div>
      {status.error && (
        <div className="grow"><p className="note" style={{ margin: "10px 14px" }}>{status.error}</p></div>
      )}
      {s?.linked && (
        <div className="grow" style={{ padding: "10px 14px 12px" }}>
          {confirming ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                Sau khi bỏ liên kết, Mini App sẽ dùng một tài khoản Zalo riêng và
                không còn thấy các dòng họ của <b>{s.email}</b>. Tài khoản email và
                dữ liệu của nó vẫn nguyên, đăng nhập trên web như cũ.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn neutral" style={{ flex: 1 }} disabled={save.busy} onClick={() => setConfirming(false)}>Huỷ</button>
                <button
                  type="button"
                  className="btn danger"
                  style={{ flex: 1 }}
                  disabled={save.busy}
                  onClick={() =>
                    save.run(async () => {
                      await unlinkZalo();
                      onUnlinked();
                    }, "Đã bỏ liên kết")
                  }
                >
                  {save.busy ? "Đang bỏ…" : "Bỏ liên kết"}
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="btn text dangertext" style={{ minHeight: 0, padding: 0 }} onClick={() => setConfirming(true)}>
              Bỏ liên kết Zalo với tài khoản này
            </button>
          )}
          {save.note}
        </div>
      )}
    </Group>
  );
}

const THEMES: { id: Theme; label: string }[] = [
  { id: "light", label: "Sáng" },
  { id: "dark", label: "Tối" },
  { id: "system", label: "Theo máy" },
];

export function AccountScreen({
  userId,
  email,
  name,
  zaloOnly,
  onLinked,
  onRenamed,
  onDeleted,
  openPrivacy,
}: {
  userId: string;
  email: string | null;
  name: string;
  zaloOnly: boolean;
  onLinked: () => void;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
  openPrivacy: () => void;
}) {
  const profile = useAsync(() => getMyProfile(userId), [userId]);
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const p = profile.data;
  const shownName = p?.display_name ?? name;
  // Nhắc qua email cần một hộp thư thật; tài khoản chỉ có Zalo thì chưa có.
  const needEmail = zaloOnly ? "Cần liên kết tài khoản có email để nhận thư." : undefined;

  return (
    <div className="page">
      <div className="me">
        <span className="mono">{shownName.trim().charAt(0).toUpperCase() || "?"}</span>
        <div style={{ minWidth: 0 }}>
          <b className="serif ell">{shownName}</b>
          <span className="muted ell">{zaloOnly ? "Đăng nhập bằng Zalo" : email}</span>
        </div>
      </div>

      {/* Chưa liên kết thì mời liên kết; liên kết rồi thì hiện danh sách +
          nút bỏ. Bỏ xong đăng nhập lại (onLinked) để nhận tài khoản Zalo riêng. */}
      {zaloOnly ? (
        <Group title="Tài khoản liên kết">
          <div className="grow">
            <div className="growhead" style={{ cursor: "default" }}>
              <span>Zalo</span>
              <span className="val">Đang dùng</span>
            </div>
          </div>
          {/* Mở sẵn: người mới vào thường là người đã có gia phả trên web. */}
          <ExpandRow label="Tài khoản email" value="Chưa liên kết" defaultOpen>
            {() => <LinkAccount onLinked={onLinked} />}
          </ExpandRow>
        </Group>
      ) : (
        <LinkedAccounts email={email} onUnlinked={onLinked} />
      )}
      {profile.error && <p className="error">{profile.error}</p>}

      <Group title="Hồ sơ">
        <DisplayName userId={userId} current={shownName} onSaved={onRenamed} />
        {/* Đổi email xong thì đăng nhập lại (onLinked) để nhận thông tin mới. */}
        <ChangeEmail current={zaloOnly ? null : email} onChanged={onLinked} />
        {!zaloOnly && <Password />}
      </Group>

      {(profile.loading || p) && (
        <Group title="Thông báo qua email">
          {profile.loading && <div className="sk" style={{ height: 120, margin: 10 }} />}
          {p && (
            <>
              <SwitchRow
                title="Bản tin tuần"
                desc="Mỗi tuần một email gộp: sự kiện 7 ngày tới, người mới thêm vào cây, thông báo mới của dòng họ."
                value={p.notify_weekly_digest}
                disabledNote={needEmail}
                onChange={(v) => updateMyWeeklyDigestPref(userId, v)}
              />
              <SwitchRow
                title="Nhắc mùng 1 / rằm âm lịch"
                desc="Ngày 1 và 15 âm lịch, app gửi email nhắc thắp hương."
                value={p.notify_monthly_lunar}
                disabledNote={needEmail}
                onChange={(v) => updateMyMonthlyLunarPref(userId, v)}
              />
            </>
          )}
        </Group>
      )}

      <Group title="Giao diện">
        <div style={{ padding: 12 }}>
          <div className="seg full" style={{ margin: 0 }} role="group" aria-label="Chế độ màu">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={theme === t.id}
                onClick={() => {
                  setTheme(t.id);
                  setThemeState(t.id);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Group>

      <Group title="Thông tin">
        <div className="grow">
          <button type="button" className="growhead" onClick={openPrivacy}>
            <span>Chính sách riêng tư</span>
            <span className="chev closed" style={{ margin: "0 0 0 auto", width: 24, height: 24 }}><IconChevronDown /></span>
          </button>
        </div>
      </Group>

      <Group title="Vùng nguy hiểm">
        <ExpandRow label="Xoá tài khoản" danger>
          {() => <DeleteAccount onDeleted={onDeleted} />}
        </ExpandRow>
      </Group>

      {/* Liên kết DUY NHẤT ra ngoài của cả app, để kín ở cuối màn Tài khoản:
          tiêu chí duyệt của Zalo không cho Mini App mời người dùng sang
          ứng dụng/trang riêng. */}
      <p className="note" style={{ margin: "16px 4px 0", textAlign: "center" }}>
        Dòng Họ Việt cũng có trên{" "}
        <button type="button" className="btn text" style={{ display: "inline", padding: 0, fontSize: "inherit" }} onClick={() => openWebview({ url: "https://giapha.thaohk.com" })}>
          giapha.thaohk.com
        </button>
      </p>
    </div>
  );
}
