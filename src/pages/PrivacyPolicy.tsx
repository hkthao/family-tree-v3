import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { IconLock } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";

/**
 * Chính sách riêng tư.
 *
 * Nguyên tắc: **chỉ nói những gì mã nguồn làm thật.** Mỗi câu ở đây soi được ra
 * một chỗ trong code (vd `sanitizeUrl` quyết định analytics ghi gì). Chính sách hứa
 * nhiều hơn code làm là chỗ tệ nhất để nói quá.
 */

const UPDATED = "25/10/2026";

export default function PrivacyPolicy() {
  usePageTitle("Chính sách riêng tư");

  return (
    <div className="min-h-dvh bg-background pb-[env(safe-area-inset-bottom)] lg:pl-72">
      <AppHeader />
      <main className="container max-w-3xl space-y-6 px-4 py-6">
        <PageHeader
          icon={<IconLock className="h-7 w-7" />}
          title="Chính sách riêng tư"
          description={`Cập nhật ${UPDATED}. Nói rõ chúng tôi giữ gì, gửi đi đâu, và giữ trong bao lâu.`}
        />

        <Section title="Gia phả là của dòng họ bạn">
          <p>
            Dữ liệu gia phả — tên, ngày tháng, quan hệ, ảnh, tiểu sử — thuộc về
            dòng họ đã nhập nó. Chúng tôi không bán, không cho thuê, không dùng
            để quảng cáo, và không đưa cho dòng họ khác xem.
          </p>
          <p>
            Ai xem được cây của bạn là do <b>chính bạn đặt</b> trong Cài đặt
            dòng họ: để riêng tư thì chỉ thành viên bạn mời mới vào được; để
            công khai thì người ngoài xem được phần bạn cho phép, và{" "}
            <b>người còn sống luôn được ẩn</b> với khách.
          </p>
        </Section>

        <Section title="Chúng tôi lưu những gì">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Tài khoản: email và tên hiển thị.</li>
            <li>Gia phả bạn nhập: người, quan hệ, sự kiện, ảnh, tài liệu.</li>
            <li>
              Nhật ký thao tác trong dòng họ (ai sửa gì, khi nào) — để dòng họ
              tự giám sát và khôi phục khi cần.
            </li>
            <li>
              Lịch sử trò chuyện với trợ lý, <b>chỉ chính bạn đọc được</b>.
            </li>
          </ul>
        </Section>

        <Section title="Đăng nhập bằng Zalo">
          <p>
            Khi bạn mở Dòng Họ Việt trong Zalo, chúng tôi chỉ nhận từ Zalo{" "}
            <b>mã định danh của bạn trong ứng dụng này, tên và ảnh đại diện</b>{" "}
            — để tạo tài khoản và hiện đúng tên bạn. Chúng tôi{" "}
            <b>không xin số điện thoại hay danh bạ Zalo</b> của bạn.
          </p>
          <p>
            Hai quyền thiết bị chỉ dùng khi bạn tự bấm, ở màn Mộ phần:{" "}
            <b>vị trí</b> (nút “Lấy vị trí hiện tại” — lưu toạ độ của ngôi mộ,
            không theo dõi bạn) và <b>chọn ảnh/camera</b> (nút “Thêm ảnh”). Chi
            tiết ở{" "}
            <Link to="/dieu-khoan-su-dung" className="underline">Điều khoản sử dụng</Link>.
          </p>
          <p>
            Gia phả bạn xem và sửa trong Zalo nằm trên máy chủ của chúng tôi như
            bản web, không gửi sang Zalo. Bỏ liên kết hoặc xoá tài khoản trong
            trang Tài khoản là mối nối với Zalo bị xoá theo. Rút lại sự đồng ý
            trong cài đặt của Zalo cũng vậy: mối nối bị xoá, tài khoản tạo từ
            Zalo bị xoá nếu chưa đứng tên dòng họ nào, còn không thì gỡ tên và
            ảnh lấy từ Zalo.
          </p>
        </Section>

        <Section title="Kết nối AI bên ngoài — dữ liệu đi ra ngoài chỗ này">
          <p>
            Ứng dụng <b>không tự gửi</b> dữ liệu gia phả cho dịch vụ AI nào. Chỉ khi
            quản trị dòng họ hoặc quản trị hệ thống chủ động tạo một <b>token kết nối AI</b>{" "}
            và dán vào công cụ AI của họ (Claude, ChatGPT…), công cụ đó mới đọc được
            dữ liệu dòng họ, với <b>đúng quyền của người tạo token</b>. Dữ liệu AI đọc
            được thì do nhà cung cấp công cụ AI đó xử lý theo chính sách của họ.
          </p>
          <p>
            Token có hạn, thu hồi được bất cứ lúc nào, và có ba mức: chỉ đọc, đề xuất
            (chờ admin duyệt) hoặc ghi trực tiếp. Mọi thay đổi AI ghi vào gia phả đều
            có trong nhật ký thao tác dưới tên người tạo token.
          </p>
        </Section>

        <Section title="Giữ trong bao lâu">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Gia phả và tài khoản: giữ cho tới khi bạn xoá. Xoá tài khoản trong
              trang Tài khoản là dữ liệu cá nhân và thông báo của bạn bị xoá theo.
            </li>
          </ul>
        </Section>

        <Section title="Đo lường sử dụng">
          <p>
            Chúng tôi tự chạy công cụ thống kê trên máy chủ của mình (Umami),{" "}
            <b>không dùng cookie, không lần dấu vân tay thiết bị</b>, và không
            chia sẻ số liệu với bên nào. Đường dẫn được làm sạch trước khi ghi:
            mã chia sẻ và mã đăng nhập bị cắt bỏ, nên chúng không nằm trong số
            liệu.
          </p>
        </Section>

        <Section title="Email">
          <p>
            Email nhắc giỗ, thông báo đóng góp và bản tin tuần được gửi thẳng từ
            máy chủ của chúng tôi, không qua dịch vụ tiếp thị nào. Tắt từng loại
            trong trang Tài khoản hoặc trong trang Sự kiện của dòng họ.
          </p>
        </Section>

        <Section title="Quyền của bạn">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Xem và sửa dữ liệu của mình bất cứ lúc nào trong app.</li>
            <li>
              Xoá tài khoản: <Link to="/account" className="underline">trang Tài khoản</Link>.
            </li>
            <li>Xoá lịch sử trò chuyện với trợ lý: nút trong khung chat.</li>
            <li>
              Hỏi hoặc khiếu nại:{" "}
              <Link to="/lien-he" className="underline">gửi qua trang Liên hệ</Link>{" "}
              hoặc nhắn{" "}
              <a
                href="https://www.facebook.com/donghoviet2026"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Fanpage Dòng Họ Việt
              </a>
              .
            </li>
          </ul>
        </Section>

        <Section title="Khi chính sách này đổi">
          <p>
            Đổi điều gì đáng kể — nhất là thêm một nơi dữ liệu được gửi tới —
            chúng tôi sẽ báo trong app trước khi áp dụng, chứ không sửa lặng lẽ
            rồi đổi ngày cập nhật.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border bg-card shadow-sm p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_b]:text-foreground">
        {children}
      </div>
    </section>
  );
}
