import { Link } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { IconLock } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAiProviderLabel } from "@/hooks/useAiProvider";

/**
 * Chính sách riêng tư.
 *
 * Viết vì trợ lý AI đã chạy thật: tên và năm sinh của người thật đang
 * được gửi sang một nhà cung cấp nước ngoài, và người dùng có quyền biết
 * trước — plan §Bảo mật mục 18.
 *
 * Hai nguyên tắc khi viết trang này:
 *
 *  1. **Chỉ nói những gì mã nguồn làm thật.** Mỗi câu ở đây soi được ra
 *     một chỗ trong code: PERSON_COLS quyết định trường nào gửi cho AI,
 *     `ai.chat_retention_days` quyết định giữ lịch sử bao lâu,
 *     `sanitizeUrl` quyết định analytics ghi gì. Chính sách hứa nhiều
 *     hơn code làm là chỗ tệ nhất để nói quá.
 *  2. **Tên nhà cung cấp AI suy từ cấu hình**, không viết cứng — admin
 *     đổi model là dòng chữ phải đổi theo.
 */

const UPDATED = "30/08/2026";

export default function PrivacyPolicy() {
  usePageTitle("Chính sách riêng tư");
  const provider = useAiProviderLabel();

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
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

        <Section title="Trợ lý AI — dữ liệu đi ra ngoài chỗ này">
          <p>
            Đây là chỗ duy nhất dữ liệu gia phả rời khỏi máy chủ của chúng tôi.
            Khi bạn hỏi trợ lý, câu hỏi của bạn được gửi tới{" "}
            <b>{provider ?? "một dịch vụ AI bên thứ ba"}</b> để xử lý, kèm{" "}
            <b>tên, giới tính, còn sống hay đã mất, đời thứ mấy, ngày
            sinh/mất/giỗ</b> của những người liên quan tới câu hỏi.
          </p>
          <p>
            <b>Không gửi đi:</b> ảnh, tiểu sử, nơi sinh, nơi an táng, thông tin
            liên hệ, email, hay bất cứ tài liệu nào bạn tải lên.
          </p>
          <p>
            Trợ lý <b>không tự ghi vào gia phả</b>. Khi nó hiểu là bạn muốn thêm
            người, nó chỉ đề xuất — bạn xem lại rồi bấm xác nhận thì mới lưu.
          </p>
          <p>
            Không muốn dùng thì quản trị dòng họ tắt tính năng này trong Cài đặt
            dòng họ; tắt rồi thì không có gì được gửi đi cả.
          </p>
        </Section>

        <Section title="Giữ trong bao lâu">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>Lịch sử trò chuyện với trợ lý: 90 ngày</b>, sau đó tự xoá. Mỗi
              người cũng chỉ giữ 40 tin gần nhất cho mỗi dòng họ, và bạn xoá tay
              được bất cứ lúc nào bằng nút trong khung chat.
            </li>
            <li>
              Gia phả và tài khoản: giữ cho tới khi bạn xoá. Xoá tài khoản trong
              trang Tài khoản là dữ liệu cá nhân, lịch sử trò chuyện và thông
              báo của bạn bị xoá theo.
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
    <section className="space-y-2 rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_b]:text-foreground">
        {children}
      </div>
    </section>
  );
}
