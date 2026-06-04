import { Link } from "react-router-dom";

import {
  Callout,
  Code,
  H2,
  H3,
  Lead,
  LI,
  P,
  Steps,
  Strong,
  UL,
} from "../prose";

export function Overview() {
  return (
    <>
      <Lead>
        App này là sổ gia phả điện tử — thay cuốn sổ giấy đang để trong tủ
        bằng một nơi cả họ cùng tra cứu, cùng cập nhật.
      </Lead>

      <H2>Dành cho ai</H2>
      <UL>
        <LI>
          <Strong>Trưởng họ / người soạn gia phả</Strong> — chính là người
          nhập liệu và quản trị dòng họ.
        </LI>
        <LI>
          <Strong>Con cháu trong họ</Strong> — chỉ cần xem cây, biết quan hệ,
          không sửa được gì.
        </LI>
        <LI>
          <Strong>Người ngoài</Strong> — chỉ vào được nếu dòng họ để chế độ
          công khai hoặc được gửi link chia sẻ.
        </LI>
      </UL>

      <H2>Làm được gì</H2>
      <UL>
        <LI>
          <Strong>Cây gia phả</Strong> tự vẽ — chọn 1 người làm trung tâm, xem
          mấy đời lên, mấy đời xuống. In ra PDF mang đi họp họ.
        </LI>
        <LI>
          <Strong>Danh bạ</Strong> — danh sách phẳng, lọc theo chi, đời, năm
          sinh; tìm theo tên không dấu cũng được.
        </LI>
        <LI>
          <Strong>Sự kiện</Strong> — sinh nhật, ngày giỗ tự nhảy lên Dashboard.
          Đăng ký email báo trước 7 ngày.
        </LI>
        <LI>
          <Strong>Nhập từ Excel</Strong> — đổ một lúc cả trăm người, hoặc nhờ
          AI sinh file từ mô tả tự do của bạn.
        </LI>
        <LI>
          <Strong>Chia sẻ</Strong> — gửi 1 đường link, người nhận xem được
          cây mà không cần đăng ký.
        </LI>
      </UL>

      <H2>Có gì khác sổ giấy</H2>
      <UL>
        <LI>
          Sửa lúc nào cũng được, có nhật ký lưu lại từng thay đổi —{" "}
          <Strong>không bao giờ mất dữ liệu</Strong>. Xoá nhầm vẫn khôi phục
          được.
        </LI>
        <LI>
          Nhiều người cùng vào cùng lúc, không cần chuyền sổ.
        </LI>
        <LI>
          Mở trên điện thoại như ứng dụng — tải về thêm vào màn hình chính
          (PWA).
        </LI>
      </UL>

      <Callout kind="tip" title="Bắt đầu thế nào?">
        Đọc tiếp{" "}
        <Link to="/docs/dang-nhap" className="text-primary underline">
          Đăng nhập
        </Link>{" "}
        →{" "}
        <Link to="/docs/tao-dong-ho" className="text-primary underline">
          Tạo dòng họ đầu tiên
        </Link>
        . Mất chừng 5 phút là có dòng họ rỗng sẵn sàng thêm Thuỷ tổ.
      </Callout>
    </>
  );
}

export function Login() {
  return (
    <>
      <Lead>
        Không cần nhớ mật khẩu — gõ email, app gửi 1 đường link, bấm vào là
        vào. Có sẵn rồi thì quét QR sang điện thoại đỡ phải nhập email lần nữa.
      </Lead>

      <H2>Đăng nhập lần đầu trên máy tính</H2>
      <Steps>
        <LI>
          Mở trang đăng nhập, gõ email của bạn.
        </LI>
        <LI>
          Bấm <Code>Gửi link đăng nhập</Code>. Mở email — sẽ có thư từ{" "}
          <Code>noreply@thaohk.com</Code>.
        </LI>
        <LI>
          Bấm vào link trong email. Tab mới mở ra — đã đăng nhập xong.
        </LI>
      </Steps>

      <Callout kind="warn" title="Không thấy email?">
        Kiểm tra thư mục Spam / Quảng cáo. Gmail và Outlook đôi khi xếp link
        đăng nhập lần đầu vào đó. Đánh dấu <Strong>không phải spam</Strong>,
        các lần sau sẽ vào Hộp thư đến bình thường.
      </Callout>

      <H2>Sang điện thoại bằng QR</H2>
      <P>
        Đã đăng nhập trên máy tính rồi, không muốn gõ lại email + chờ link
        trên điện thoại. Cách nhanh:
      </P>
      <Steps>
        <LI>
          Vào <Code>Tài khoản</Code> → card <Strong>Đăng nhập trên điện thoại</Strong>.
        </LI>
        <LI>
          Bấm nút — màn hình hiện mã QR.
        </LI>
        <LI>
          Mở camera điện thoại, hướng vào mã. iPhone / Android đời mới đều
          tự nhận, hỏi mở link.
        </LI>
        <LI>
          Bấm <Code>Mở</Code> → điện thoại tự đăng nhập cùng tài khoản đó.
        </LI>
      </Steps>
      <Callout kind="warn" title="Bảo mật">
        Mã QR có giá trị ~5 phút và <Strong>chỉ dùng được 1 lần</Strong>.
        Đừng chụp màn hình rồi gửi đi — ai cầm mã đó đều vào được tài khoản
        của bạn.
      </Callout>

      <H2>Đăng ký mới</H2>
      <P>
        Lần đầu vào app: gõ email mới chưa có tài khoản, app sẽ tự tạo tài
        khoản và gửi link xác nhận. Không phân biệt đăng nhập / đăng ký.
      </P>

      <H2>Đổi mật khẩu, đăng xuất</H2>
      <P>
        Đặt mật khẩu (tuỳ chọn) ở <Code>Tài khoản</Code> → card{" "}
        <Strong>Mật khẩu</Strong>. Có mật khẩu thì lần sau vào nhanh hơn —
        không cần chờ email. Đăng xuất ở cùng trang, card{" "}
        <Strong>Đăng xuất</Strong> — sẽ xoá cache cục bộ luôn, an toàn khi
        dùng chung máy.
      </P>
    </>
  );
}

export function FirstClan() {
  return (
    <>
      <Lead>
        Mỗi tài khoản tạo được nhiều dòng họ. Tài khoản mới mặc định cho
        phép 3 dòng họ — đủ cho hầu hết. Liên hệ admin nếu cần thêm.
      </Lead>

      <H2>3 bước tạo</H2>
      <Steps>
        <LI>
          Vào <Code>Dòng họ của tôi</Code> (icon nhà ở thanh điều hướng) →
          bấm <Strong>Tạo dòng họ</Strong>.
        </LI>
        <LI>
          Điền tên dòng họ (vd: <Code>Họ Huỳnh</Code>) và mô tả ngắn (lịch
          sử, nguồn gốc — có thể bỏ trống, sửa sau).
        </LI>
        <LI>
          Chọn <Strong>Riêng tư</Strong> (chỉ thành viên xem) hoặc{" "}
          <Strong>Công khai</Strong> (mọi tài khoản đăng nhập xem được, người
          còn sống bị ẩn). Đổi sau cũng được.
        </LI>
      </Steps>

      <H2>Thêm Thuỷ tổ</H2>
      <P>
        Dòng họ vừa tạo còn rỗng. Vào <Code>Danh bạ</Code> →{" "}
        <Strong>Thêm người</Strong>. Khi điền, bật ô <Strong>Thuỷ tổ</Strong>.
        Thuỷ tổ tự được đánh dấu <Strong>Đời 1</Strong> — mọi người thêm sau
        làm con/cháu của Thuỷ tổ sẽ tự nhảy đời 2, 3, 4…
      </P>
      <Callout kind="tip" title="Nhiều Thuỷ tổ cũng được">
        Nếu dòng họ có nhiều chi tách lập, mỗi chi 1 Thuỷ tổ — vẫn được. Đời
        tính từ Thuỷ tổ gần nhất.
      </Callout>

      <H2>Mời thành viên</H2>
      <P>
        Vào <Code>Cài đặt</Code> → <Code>Thành viên</Code>. Gõ email của
        người bạn muốn mời, chọn vai trò (Xem / Biên tập / Quản trị).
      </P>
      <Callout kind="warn">
        Người được mời <Strong>cần có sẵn tài khoản</Strong> trên app —
        chưa có cơ chế tự gửi mail mời. Bảo họ đăng ký trước bằng email
        đó, rồi bạn mời.
      </Callout>

      <H2>Có sẵn dữ liệu Excel?</H2>
      <P>
        Vào <Code>Nhập từ Excel</Code> (Drawer trái). Tải file mẫu, điền
        theo cấu trúc, đẩy lên. App kiểm tra lỗi từng dòng và cho xem trước
        trước khi import — không có ai bị thêm nhầm.
      </P>
      <P>
        Không có Excel, chỉ có mô tả văn bản? Dùng{" "}
        <Strong>Sinh bằng AI</Strong> ở trang Import — dán mô tả tự do (vd:
        "Họ Nguyễn, Thuỷ tổ Nguyễn Văn A sinh 1850, có 3 con trai…"), AI sẽ
        sinh file CSV chuẩn cho bạn.
      </P>
    </>
  );
}

export function Roles() {
  return (
    <>
      <Lead>
        Mỗi dòng họ có 3 vai trò. Người tạo dòng họ mặc định là{" "}
        <Strong>Quản trị</Strong>; mời thêm người khác và gán cho họ vai trò
        phù hợp.
      </Lead>

      <H2>Bảng so sánh</H2>
      <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-2 text-left font-medium">Việc</th>
              <th className="px-2 py-2 text-center font-medium">Xem</th>
              <th className="px-2 py-2 text-center font-medium">Biên tập</th>
              <th className="px-2 py-2 text-center font-medium">Quản trị</th>
            </tr>
          </thead>
          <tbody>
            <RoleRow label="Xem danh bạ, cây gia phả" v e a />
            <RoleRow label="Xem sự kiện, đăng ký nhận email" v e a />
            <RoleRow label="Thêm / sửa / xoá người" e a />
            <RoleRow label="Nhập Excel, gộp người trùng" e a />
            <RoleRow label="Khôi phục từ Nhật ký" e a />
            <RoleRow label="Sửa thông tin dòng họ" a />
            <RoleRow label="Mời / xoá thành viên" a />
            <RoleRow label="Đổi vai trò người khác" a />
            <RoleRow label="Tạo / huỷ link chia sẻ công khai" a />
          </tbody>
        </table>
      </div>

      <H3>Xem (Viewer)</H3>
      <P>
        Đọc-chỉ. Phù hợp cho con cháu, người ngoài chi. Không cần biết kỹ
        thuật.
      </P>

      <H3>Biên tập (Editor)</H3>
      <P>
        Sửa được mọi dữ liệu trong dòng họ nhưng không quản được thành viên
        hay đổi cài đặt. Phù hợp cho người phụ trợ trưởng họ nhập liệu.
      </P>

      <H3>Quản trị (Admin)</H3>
      <P>
        Toàn quyền. Người tạo dòng họ là admin đầu tiên. Có thể thêm/xoá
        admin khác — nên có ít nhất 2 admin để phòng khi 1 người mất quyền
        truy cập.
      </P>

      <Callout kind="warn" title="Đổi vai trò là vĩnh viễn">
        Hạ chính mình từ Quản trị xuống Biên tập sẽ mất luôn quyền hạ-cấp
        lại — phải nhờ admin khác hoặc liên hệ platform admin. Cẩn thận khi
        đổi.
      </Callout>
    </>
  );
}

function RoleRow({
  label,
  v,
  e,
  a,
}: {
  label: string;
  v?: boolean;
  e?: boolean;
  a?: boolean;
}) {
  return (
    <tr className="border-b">
      <td className="px-2 py-2">{label}</td>
      <td className="px-2 py-2 text-center">{v ? "✓" : ""}</td>
      <td className="px-2 py-2 text-center">{e ? "✓" : ""}</td>
      <td className="px-2 py-2 text-center">{a ? "✓" : ""}</td>
    </tr>
  );
}
