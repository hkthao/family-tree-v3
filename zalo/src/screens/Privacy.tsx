import type { ReactNode } from "react";

import { providerLabelForModel } from "@/lib/aiModels";
import { getPlatformSetting } from "@/lib/queries/platformSettings";

import { useAsync } from "../useAsync";

/**
 * Chính sách riêng tư — CÙNG NỘI DUNG với trang `/chinh-sach-rieng-tu` của
 * web (`src/pages/PrivacyPolicy.tsx`), chỉ đổi chỉ dẫn cho đúng chỗ trong
 * Mini App ("màn Tài khoản" thay cho đường dẫn). Sửa bên này thì sửa cả
 * bên kia, kể cả ngày cập nhật.
 *
 * Viết thẳng trong Mini App chứ không mở trang web: tiêu chí duyệt của Zalo
 * không cho mời người dùng sang trang ngoài, mà người duyệt vẫn cần thấy
 * app nói rõ nó giữ thông tin gì của người trong họ.
 */
const UPDATED = "25/10/2026";

export function PrivacyScreen() {
  // Tên nhà cung cấp AI suy từ cấu hình như web — admin đổi model thì câu
  // chữ đổi theo. Chưa tải xong hay model lạ thì nói chung chung.
  const model = useAsync(() => getPlatformSetting("ai.model.qa"), []);
  const provider = providerLabelForModel(model.data ?? null);

  return (
    <div className="page">
      <p className="note" style={{ margin: "4px 6px 0" }}>
        Cập nhật {UPDATED}. Nói rõ chúng tôi giữ gì, gửi đi đâu, và giữ trong bao lâu.
      </p>

      <Section title="Gia phả là của dòng họ bạn">
        <p>
          Dữ liệu gia phả — tên, ngày tháng, quan hệ, ảnh, tiểu sử — thuộc về dòng họ đã nhập
          nó. Chúng tôi không bán, không cho thuê, không dùng để quảng cáo, và không đưa cho
          dòng họ khác xem.
        </p>
        <p>
          Ai xem được cây của bạn là do <b>chính quản trị dòng họ đặt</b>: để riêng tư thì chỉ
          thành viên được mời mới vào được; để công khai thì người ngoài xem được phần được cho
          phép, và <b>người còn sống luôn được ẩn</b> với khách.
        </p>
      </Section>

      <Section title="Đăng nhập bằng Zalo">
        <p>
          Khi bạn mở Dòng Họ Việt trong Zalo, chúng tôi chỉ nhận từ Zalo{" "}
          <b>mã định danh của bạn trong ứng dụng này, tên và ảnh đại diện</b> — để tạo tài
          khoản và hiện đúng tên bạn. Chúng tôi{" "}
          <b>không xin số điện thoại hay danh bạ Zalo</b> của bạn.
        </p>
        <p>
          Hai quyền thiết bị chỉ dùng khi bạn tự bấm, ở màn Mộ phần: <b>vị trí</b> (nút “Lấy
          vị trí hiện tại” — lưu toạ độ của ngôi mộ, không theo dõi bạn) và{" "}
          <b>chọn ảnh/camera</b> (nút “Thêm ảnh”). Mở bản PDF dùng trình xem tài liệu của Zalo.
        </p>
        <p>
          Gia phả bạn xem và sửa trong Zalo nằm trên máy chủ của chúng tôi, không gửi sang
          Zalo. Bỏ liên kết hoặc xoá tài khoản ở màn Tài khoản là mối nối với Zalo bị xoá
          theo. Rút lại sự đồng ý trong cài đặt của Zalo cũng vậy: mối nối bị xoá, tài khoản
          tạo từ Zalo bị xoá nếu chưa đứng tên dòng họ nào, còn không thì gỡ tên và ảnh lấy
          từ Zalo.
        </p>
      </Section>

      <Section title="Chúng tôi lưu những gì">
        <ul>
          <li>Tài khoản: email (nếu bạn thêm) và tên hiển thị.</li>
          <li>Gia phả bạn nhập: người, quan hệ, sự kiện, ảnh, tài liệu.</li>
          <li>
            Nhật ký thao tác trong dòng họ (ai sửa gì, khi nào) — để dòng họ tự giám sát và
            khôi phục khi cần.
          </li>
          <li>
            Lịch sử trò chuyện với trợ lý AI (trên bản web), <b>chỉ chính bạn đọc được</b>.
          </li>
        </ul>
      </Section>

      <Section title="Trợ lý AI — dữ liệu đi ra ngoài chỗ này">
        <p>
          Đây là chỗ duy nhất dữ liệu gia phả rời khỏi máy chủ của chúng tôi. Khi ai đó hỏi
          trợ lý trên bản web, câu hỏi được gửi tới{" "}
          <b>{provider ?? "một dịch vụ AI bên thứ ba"}</b> để xử lý, kèm{" "}
          <b>tên, giới tính, còn sống hay đã mất, đời thứ mấy, ngày sinh/mất/giỗ</b> của những
          người liên quan tới câu hỏi.
        </p>
        <p>
          <b>Không gửi đi:</b> ảnh, tiểu sử, nơi sinh, nơi an táng, thông tin liên hệ, email,
          hay bất cứ tài liệu nào bạn tải lên.
        </p>
        <p>
          Trợ lý <b>không tự ghi vào gia phả</b>, và quản trị dòng họ tắt được tính năng này;
          tắt rồi thì không có gì được gửi đi cả.
        </p>
      </Section>

      <Section title="Giữ trong bao lâu">
        <ul>
          <li>
            <b>Lịch sử trò chuyện với trợ lý: 90 ngày</b>, sau đó tự xoá.
          </li>
          <li>
            Gia phả và tài khoản: giữ cho tới khi bạn xoá. Xoá tài khoản ở màn Tài khoản là dữ
            liệu cá nhân, lịch sử trò chuyện và thông báo của bạn bị xoá theo.
          </li>
        </ul>
      </Section>

      <Section title="Đo lường sử dụng">
        <p>
          Bản web dùng công cụ thống kê tự chạy trên máy chủ của chúng tôi (Umami),{" "}
          <b>không dùng cookie, không lần dấu vân tay thiết bị</b>, và không chia sẻ số liệu
          với bên nào.
        </p>
      </Section>

      <Section title="Email">
        <p>
          Email nhắc giỗ, thông báo đóng góp và bản tin tuần được gửi thẳng từ máy chủ của
          chúng tôi, không qua dịch vụ tiếp thị nào, và chỉ gửi khi tài khoản có email thật.
          Tắt từng loại ở màn Tài khoản.
        </p>
      </Section>

      <Section title="Quyền của bạn">
        <ul>
          <li>Xem và sửa dữ liệu của mình bất cứ lúc nào trong app.</li>
          <li>Xoá tài khoản: màn Tài khoản → Vùng nguy hiểm.</li>
          <li>Hỏi hoặc khiếu nại: nhắn Fanpage “Dòng Họ Việt” trên Facebook.</li>
        </ul>
      </Section>

      <Section title="Khi chính sách này đổi">
        <p>
          Đổi điều gì đáng kể — nhất là thêm một nơi dữ liệu được gửi tới — chúng tôi sẽ báo
          trong app trước khi áp dụng, chứ không sửa lặng lẽ rồi đổi ngày cập nhật.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 className="grouptitle">{title}</h3>
      <div className="card policy">{children}</div>
    </>
  );
}
