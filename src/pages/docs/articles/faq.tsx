import { Callout, Code, H2, Lead, LI, P, Steps, Strong, UL } from "../prose";

export function AuthAndSync() {
  return (
    <>
      <Lead>
        Hai loại sự cố hay gặp nhất: không nhận được email đăng nhập, và dữ
        liệu trên màn hình không khớp với thực tế (ai đó vừa sửa nhưng bạn
        chưa thấy).
      </Lead>

      <H2>Không nhận được email magic link</H2>
      <Steps>
        <LI>
          Kiểm tra <Strong>Spam / Quảng cáo / Mạng xã hội</Strong>. Lần đầu
          Gmail / Outlook hay xếp vào đó.
        </LI>
        <LI>
          Tìm thư từ <Code>noreply@thaohk.com</Code>. Nếu thấy, đánh dấu{" "}
          <Strong>Không phải spam</Strong> hoặc kéo về Hộp thư đến — các lần
          sau vào đúng chỗ.
        </LI>
        <LI>
          Gõ lại email cho chắc, đặc biệt với địa chỉ dài hoặc có dấu chấm.
        </LI>
        <LI>
          Vẫn không thấy sau 5 phút: dùng <Strong>mã OTP</Strong> 6 chữ số ở
          trang đăng nhập (chỗ "Không nhận được link?") — app gửi mã ngắn,
          gõ vào là vào.
        </LI>
      </Steps>

      <Callout kind="tip" title="Tránh chờ email mỗi lần">
        Đặt mật khẩu ở <Code>Tài khoản → Mật khẩu</Code>. Có mật khẩu rồi thì
        đăng nhập nhanh, không phải chờ email.
      </Callout>

      <H2>Dữ liệu cũ — chưa thấy thay đổi của người khác</H2>
      <P>
        App cache dữ liệu trên máy bạn để vào nhanh. Khi ai đó cùng dòng họ
        vừa sửa, máy bạn chưa biết — vẫn hiển thị bản cũ. Cách sync:
      </P>
      <UL>
        <LI>
          Bấm nút <Strong>↻ (Làm mới)</Strong> ở góc trên mỗi trang. App so
          phiên bản; nếu có thay đổi sẽ kéo về.
        </LI>
        <LI>
          Hoặc đóng tab, mở lại — app tự check phiên bản khi load.
        </LI>
      </UL>
      <Callout kind="tip">
        App có hệ thống <Strong>data_version</Strong> — mỗi dòng họ có 1 số
        version, sửa gì cũng tăng. Làm mới chỉ gọi 1 request rất nhẹ kiểm tra
        số đó; chỉ pull dữ liệu mới nếu khác.
      </Callout>

      <H2>Mất kết nối / offline</H2>
      <P>
        App là PWA — vẫn xem được những trang đã load gần đây ngay cả khi
        offline. Có thanh báo "Đang offline" ở dưới khi mạng rớt. Khi mạng
        trở lại, app tự đồng bộ.
      </P>
      <P>
        Sửa offline chưa hỗ trợ — nút Lưu sẽ báo lỗi nếu không có mạng.
      </P>
    </>
  );
}

export function RecoverAndTransfer() {
  return (
    <>
      <Lead>
        Hai tình huống đáng lo nhưng dễ giải quyết: lỡ xoá nhầm 1 người, và
        muốn giao dòng họ cho người khác quản lý.
      </Lead>

      <H2>Lỡ xoá người, gia đình, chi</H2>
      <P>
        App dùng <Strong>xoá mềm</Strong> — dữ liệu chỉ ẩn, không xoá hẳn.
        Khôi phục:
      </P>
      <Steps>
        <LI>
          Vào <Code>Nhật ký</Code> (Drawer trái). Lọc{" "}
          <Strong>Hành động → Xoá</Strong>.
        </LI>
        <LI>
          Tìm dòng tương ứng. Bấm <Strong>Khôi phục</Strong> — người (và mọi
          quan hệ) trở lại y nguyên.
        </LI>
      </Steps>
      <Callout kind="tip">
        Khôi phục được mọi loại: người, gia đình (Family Unit), chi. Nhật ký
        lưu vô hạn — không bao giờ tự xoá.
      </Callout>

      <H2>Lỡ sửa sai một trường</H2>
      <P>
        <Code>Nhật ký</Code> → lọc <Strong>Hành động → Sửa</Strong>. Mở chi
        tiết dòng tương ứng — sẽ có cột <Strong>Trước</Strong> và{" "}
        <Strong>Sau</Strong> để bạn thấy thay đổi nào đã xảy ra. Bấm{" "}
        <Strong>Khôi phục</Strong> sẽ revert về phiên bản trước khi sửa.
      </P>
      <Callout kind="warn">
        Khôi phục dòng sửa sẽ ghi đè toàn bộ phiên bản hiện tại, kể cả các
        sửa hợp lệ sau đó. Cân nhắc trước khi khôi phục.
      </Callout>

      <H2>Chuyển dòng họ cho người khác</H2>
      <P>
        Bạn không muốn quản trị nữa, muốn giao cho con / em / người khác
        trong họ. Quy trình:
      </P>
      <Steps>
        <LI>
          Bảo người nhận đăng ký tài khoản trước (1 lần). Lấy email họ dùng.
        </LI>
        <LI>
          Vào <Code>Thành viên</Code> (Drawer trái) → <Strong>Mời thêm</Strong>
          . Gõ email người nhận, chọn vai trò <Strong>Quản trị</Strong>.
        </LI>
        <LI>
          Người nhận đăng nhập, xác nhận thấy dòng họ trong "Dòng họ của
          tôi".
        </LI>
        <LI>
          (Tuỳ chọn) Bạn hạ vai trò mình xuống <Strong>Biên tập</Strong> hoặc{" "}
          <Strong>Xem</Strong>. Hoặc nhờ admin mới gỡ bạn khỏi dòng họ.
        </LI>
      </Steps>
      <Callout kind="warn" title="Đừng tự hạ cấp trước khi có admin khác">
        Nếu hạ chính mình từ Quản trị xuống thấp hơn khi chưa có admin khác,
        dòng họ <Strong>không còn ai làm admin</Strong>. Tính năng admin mới
        không gọi được. Liên hệ platform admin để khôi phục.
      </Callout>

      <H2>Xoá dòng họ</H2>
      <P>
        Hiện chưa có nút xoá dòng họ trên UI. Cần xoá vĩnh viễn, liên hệ
        platform admin. (Tài khoản cá nhân có nút <Strong>Xoá tài khoản</Strong>{" "}
        riêng ở trang Tài khoản — sẽ cảnh báo nếu bạn đang là owner duy nhất
        của dòng họ có thành viên.)
      </P>
    </>
  );
}
