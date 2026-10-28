import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { IconScroll } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";

/**
 * Điều khoản sử dụng — áp dụng cho bản web và Zalo Mini App.
 *
 * Zalo bắt buộc khai link trang này khi gửi duyệt Mini App, và yêu cầu nó
 * mô tả ĐỦ các quyền thiết bị và dữ liệu cá nhân Mini App dùng. Mục "Quyền
 * trong Zalo" phải khớp đúng những quyền đã xin ở trang quản lý Mini App và
 * những API `zalo/src` gọi thật — xin thêm quyền thì sửa trang này trước.
 *
 * Cùng nguyên tắc với Chính sách riêng tư: chỉ viết những gì mã nguồn làm
 * thật. Chi tiết dữ liệu (lưu gì, gửi đi đâu, giữ bao lâu) để ở trang
 * Chính sách riêng tư, ở đây dẫn sang.
 */

const UPDATED = "25/10/2026";

export default function TermsOfUse() {
  usePageTitle("Điều khoản sử dụng");

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-3xl space-y-6 px-4 py-6">
        <PageHeader
          icon={<IconScroll className="h-7 w-7" />}
          title="Điều khoản sử dụng"
          description={`Cập nhật ${UPDATED}. Áp dụng cho Dòng Họ Việt trên web và trong Zalo.`}
        />

        <Section title="Dịch vụ">
          <p>
            Dòng Họ Việt là công cụ lập và gìn giữ gia phả dòng họ: cây gia phả, hồ sơ người
            trong họ, ngày giỗ âm lịch, mộ phần, quỹ họ, bảng tin, di sản. Dùng được trên web
            và trong Zalo (Zalo Mini App) với cùng một tài khoản.
          </p>
          <p>
            Dùng dịch vụ là bạn đồng ý với điều khoản này và với{" "}
            <Link to="/chinh-sach-rieng-tu" className="underline">Chính sách riêng tư</Link>.
          </p>
        </Section>

        <Section title="Tài khoản">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Trên web: đăng ký bằng email. Trong Zalo: đăng nhập bằng tài khoản Zalo, và có thể
              liên kết với tài khoản email sẵn có để dùng chung dữ liệu.
            </li>
            <li>Bạn chịu trách nhiệm giữ an toàn tài khoản của mình.</li>
            <li>
              Bạn xoá được tài khoản bất cứ lúc nào ở trang (hoặc màn) Tài khoản.
            </li>
          </ul>
        </Section>

        <Section title="Dữ liệu gia phả và quyền trong dòng họ">
          <p>
            Gia phả thuộc về dòng họ đã nhập nó. Ai xem được, ai sửa được là do quản trị dòng
            họ đặt (vai trò xem, biên tập, quản trị) và chế độ riêng tư/công khai của họ.{" "}
            <b>Người còn sống luôn được ẩn</b> với người ngoài.
          </p>
          <p>
            Bạn chỉ nhập thông tin mà bạn có quyền chia sẻ, và tôn trọng mong muốn của người
            trong họ về thông tin của chính họ.
          </p>
        </Section>

        <Section title="Dữ liệu nhận từ Zalo">
          <p>Khi bạn dùng Dòng Họ Việt trong Zalo, chúng tôi nhận từ Zalo:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Mã định danh của bạn trong Mini App này</b> — để nhận ra bạn ở lần sau và nối với
              tài khoản của bạn.
            </li>
            <li>
              <b>Tên và ảnh đại diện Zalo</b> — để hiện tên bạn trong dòng họ (bạn đổi được tên
              hiển thị ở màn Tài khoản).
            </li>
          </ul>
          <p>
            Chúng tôi <b>không xin số điện thoại, danh bạ hay danh sách bạn bè Zalo</b>, không
            gửi tin nhắn thay bạn, và không chia sẻ dữ liệu này cho bên nào.
          </p>
        </Section>

        <Section title="Quyền trong Zalo — dùng vào việc gì">
          <p>Mini App chỉ dùng các quyền dưới đây, và chỉ khi bạn chủ động bấm vào chức năng tương ứng:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Mở tài liệu</b> — mở bản PDF bạn vừa tạo (Sổ gia phả, Báo cáo Quỹ họ) trong
              trình xem tài liệu của Zalo để xem hoặc lưu về máy.
            </li>
            <li>
              <b>Vị trí hiện tại</b> — chỉ khi bạn bấm “Lấy vị trí hiện tại” lúc ghi một nơi an
              nghỉ (mộ phần), để lưu toạ độ của ngôi mộ cho con cháu chỉ đường. Không theo dõi
              vị trí của bạn, không lấy vị trí ngầm.
            </li>
            <li>
              <b>Chọn ảnh / camera</b> — chỉ khi bạn bấm “Thêm ảnh” ở một nơi an nghỉ, để tải ảnh
              bia mộ, khu mộ lên. Chỉ lấy đúng ảnh bạn chọn; ảnh lưu riêng tư trong dòng họ.
            </li>
          </ul>
          <p>
            Bạn từ chối quyền nào thì chỉ chức năng đó không dùng được; phần còn lại của ứng
            dụng vẫn chạy bình thường.
          </p>
        </Section>

        <Section title="Rút lại sự đồng ý">
          <p>
            Bạn có thể rút lại sự đồng ý chia sẻ thông tin với Mini App trong phần cài đặt của
            Zalo. Khi đó Zalo báo cho chúng tôi và chúng tôi:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>xoá mối nối giữa tài khoản Zalo của bạn và tài khoản Dòng Họ Việt;</li>
            <li>xoá tài khoản tạo từ Zalo nếu nó chưa đứng tên dòng họ nào;</li>
            <li>
              nếu tài khoản đó đang đứng tên dòng họ (xoá sẽ mất dữ liệu của cả họ): giữ dữ liệu
              gia phả nhưng gỡ tên và ảnh đại diện lấy từ Zalo.
            </li>
          </ul>
          <p>
            Tài khoản email bạn đã liên kết không bị xoá — vẫn đăng nhập trên web như cũ. Muốn xoá
            hẳn thì dùng nút Xoá tài khoản.
          </p>
        </Section>

        <Section title="Những điều không được làm">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Đăng nội dung vi phạm pháp luật, xúc phạm, hoặc thông tin sai về người khác.</li>
            <li>Truy cập dòng họ, tài khoản mà bạn không được mời hoặc không có quyền.</li>
            <li>Làm quá tải, dò lỗi hoặc can thiệp vào hệ thống.</li>
          </ul>
          <p>Vi phạm thì tài khoản có thể bị tạm khoá.</p>
        </Section>

        <Section title="Trách nhiệm">
          <p>
            Thông tin gia phả do người dùng nhập; chúng tôi không bảo đảm tính chính xác của nó.
            Ngày âm lịch, ngày giỗ được tính tự động — với việc hệ trọng, hãy đối chiếu lại với
            lịch vạn niên hoặc người lớn trong họ.
          </p>
          <p>
            Chúng tôi cố gắng giữ dịch vụ chạy liên tục và sao lưu dữ liệu, nhưng không cam kết
            không bao giờ gián đoạn. Bạn xuất được Sổ gia phả (PDF) và tệp GEDCOM để tự lưu giữ.
          </p>
        </Section>

        <Section title="Liên hệ và thay đổi">
          <p>
            Hỏi đáp, khiếu nại: <Link to="/lien-he" className="underline">trang Liên hệ</Link> hoặc
            nhắn{" "}
            <a href="https://www.facebook.com/donghoviet2026" target="_blank" rel="noopener noreferrer" className="underline">
              Fanpage Dòng Họ Việt
            </a>
            .
          </p>
          <p>
            Đổi điều gì đáng kể — nhất là xin thêm quyền hay thêm loại dữ liệu — chúng tôi báo
            trong ứng dụng trước khi áp dụng.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_b]:text-foreground">
        {children}
      </div>
    </section>
  );
}
