import { openWebview } from "zmp-sdk";

import { LinkAccount } from "../LinkAccount";

/** Tài khoản: đang đăng nhập bằng gì, liên kết tài khoản web, mở bản web. */
export function AccountScreen({
  name,
  zaloOnly,
  onLinked,
}: {
  name: string;
  zaloOnly: boolean;
  onLinked: () => void;
}) {
  return (
    <div className="page">
      <div className="card account">
        <span className="mono">{name.trim().charAt(0).toUpperCase() || "?"}</span>
        <span style={{ minWidth: 0 }}>
          <b>{name}</b>
          <span className="muted">
            {zaloOnly
              ? "Đăng nhập bằng Zalo · chưa liên kết tài khoản web"
              : "Đã liên kết với tài khoản web"}
          </span>
        </span>
      </div>

      {zaloOnly && <LinkAccount onLinked={onLinked} />}

      <h2 className="section-title">Bản web đầy đủ</h2>
      <div className="card" style={{ padding: 14 }}>
        <p className="muted" style={{ margin: "0 0 10px" }}>
          Thêm và sửa thành viên, xuất sổ gia phả PDF, nhập từ Excel… làm trên
          bản web.
        </p>
        <button
          type="button"
          className="btn ghost block"
          onClick={() => openWebview({ url: "https://giapha.thaohk.com/clans" })}
        >
          Mở giapha.thaohk.com
        </button>
      </div>
    </div>
  );
}
