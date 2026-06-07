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

// ─── A. Hôm nay & nhắc giỗ ───────────────────────────────────────

export function Today() {
  return (
    <>
      <Lead>
        Trang <Code>Hôm nay</Code> tóm tắt mọi giỗ + sinh nhật sắp đến — mở app
        buổi sáng là biết hôm nay/tuần này phải nhớ ngày nào.
      </Lead>

      <H2>3 nhóm thời gian</H2>
      <UL>
        <LI>
          <Strong>Hôm nay</Strong> — sự kiện đúng ngày hiện tại. Tile lớn, viền
          accent.
        </LI>
        <LI>
          <Strong>7 ngày tới</Strong> — sự kiện trong tuần.
        </LI>
        <LI>
          <Strong>30 ngày tới</Strong> — nhìn xa hơn một chút.
        </LI>
      </UL>

      <H2>Nguồn dữ liệu</H2>
      <P>
        App ghép 3 nguồn vào một danh sách: <Strong>sinh nhật</Strong> (người
        còn sống, có ngày sinh dương lịch), <Strong>ngày giỗ</Strong> (người đã
        mất, có ngày giỗ âm lịch — app tự quy đổi sang dương trong năm hiện tại),
        và <Strong>sự kiện tuỳ chỉnh</Strong> (họp họ, lễ kỷ niệm — bạn nhập ở
        trang <Code>Sự kiện</Code>).
      </P>

      <H2>Nhắc qua email</H2>
      <P>
        Vào trang <Code>Sự kiện</Code> hoặc trang của từng người, bấm{" "}
        <Strong>Theo dõi</Strong> để bật nhắc. App chạy cron mỗi sáng — đúng
        ngày (hoặc trước N ngày bạn chọn) sẽ có email vào hộp thư.
      </P>
      <Callout>
        Email gửi từ địa chỉ dòng họ đã cấu hình. Không cần đăng nhập app vẫn
        nhận được nhắc.
      </Callout>

      <H2>Xuất ra lịch điện thoại (.ics)</H2>
      <P>
        Trên trang <Code>Sự kiện</Code> có nút <Strong>Xuất lịch</Strong> — tải
        về một file <Code>.ics</Code> chứa toàn bộ giỗ + sinh nhật của họ.
        Nhập file này vào Google Calendar (web → Settings → Import) hoặc Apple
        Calendar (kéo thả vào Calendar.app) → ngày giỗ tự hiện trên lịch quen
        thuộc, kèm nhắc 9h sáng. Giỗ âm lịch được tính sẵn 10 năm tới và
        đính kèm dạng nhiều ngày riêng (RDATE) thay vì RRULE năm, để tránh
        sai lệch dương/âm theo năm nhuận.
      </P>

      <H2>Nhắc thắp hương mùng 1 / rằm âm lịch</H2>
      <P>
        Vào trang <Code>Tài khoản</Code>, bật tuỳ chọn{" "}
        <Strong>Nhắc mùng 1 và rằm âm lịch</Strong>. Cron mỗi sáng kiểm tra
        ngày âm lịch — nếu là mùng 1 hoặc 15 sẽ gửi email nhắc thắp hương.
        Lựa chọn này độc lập với <Code>Theo dõi</Code> ở từng sự kiện vì nó
        không gắn với người cụ thể trong họ.
      </P>
    </>
  );
}

// ─── B. QR cá nhân ───────────────────────────────────────────────

export function PersonalQr() {
  return (
    <>
      <Lead>
        Mỗi người trong cây có thể tạo một <Strong>mã QR riêng</Strong> — quét
        bằng điện thoại sẽ mở trang cá nhân không cần đăng nhập. Dùng để in lên
        bia mộ, sổ gia phả, danh thiếp.
      </Lead>

      <H2>Tạo QR cho một người</H2>
      <Steps>
        <LI>Mở trang chi tiết của người đó.</LI>
        <LI>
          Bấm <Strong>QR cá nhân</Strong> (admin clan mới thấy nút này).
        </LI>
        <LI>
          Modal hiện QR — bấm <Strong>Lưu ảnh QR</Strong> để tải PNG, hoặc{" "}
          <Strong>Tải PDF danh thiếp</Strong> để tải PDF A6 đẹp để in.
        </LI>
      </Steps>

      <H2>Xuất hàng loạt</H2>
      <P>
        Để in QR cho cả họ một lúc, vào <Code>Xuất QR cá nhân</Code> trong
        drawer. Lọc theo chi / đời / chỉ-người-đã-mất, chọn nhiều người, bấm{" "}
        <Strong>Xuất PDF</Strong>. App tạo file A4 với 2×3 thẻ A6 mỗi trang (6
        người/tờ) — cắt theo viền là dán được lên sổ.
      </P>

      <H2>Quét QR thấy gì</H2>
      <P>
        Mở camera điện thoại, hướng vào QR. Link mở trang <Code>/share/...</Code>{" "}
        chứa thông tin người đó <Strong>+ cha mẹ + vợ/chồng + con</Strong>.
        Người còn sống vẫn được ẩn ngày sinh và tiểu sử như chế độ chia sẻ cây
        thường — chỉ tên + giới tính + ảnh hiển thị.
      </P>

      <Callout>
        Link QR mặc định có hạn 365 ngày. Bạn có thể thu hồi từ trang{" "}
        <Code>Cài đặt dòng họ</Code> → mục <Strong>Link chia sẻ</Strong> nếu cần.
      </Callout>
    </>
  );
}

// ─── C. Đường trực hệ ────────────────────────────────────────────

export function Lineage() {
  return (
    <>
      <Lead>
        Trang <Code>Đường trực hệ</Code> trả lời câu hỏi "Tôi là đời thứ mấy?" —
        vẽ đường liên tục từ bạn lên đến thuỷ tổ, mỗi tầng một thẻ.
      </Lead>

      <H2>Bước 1 — Chọn bạn là ai trong gia phả</H2>
      <P>
        Lần đầu mở trang, app hỏi <Strong>"Bạn là ai trong gia phả này?"</Strong>{" "}
        — gõ tên mình rồi chọn. App ghi nhận, gửi admin xác nhận trước khi
        hiển thị công khai cho người khác.
      </P>

      <H2>Bước 2 — Xem cây trực hệ</H2>
      <P>
        Sau khi chọn, app vẽ đường thẳng từ bạn lên thuỷ tổ — mặc định đi theo{" "}
        <Strong>bên nội</Strong> (cha → ông nội → cụ nội…). Đến điểm có cả cha
        lẫn mẹ trong gia phả, app cho phép bạn đổi sang <Strong>bên ngoại</Strong>{" "}
        cho riêng tầng đó.
      </P>

      <H3>Toolbar đổi dòng</H3>
      <P>
        Trên cây hiện danh sách điểm rẽ. Mỗi điểm rẽ có 2 nút:{" "}
        <Strong>Bên nội</Strong> (qua cha) và <Strong>Bên ngoại</Strong> (qua
        mẹ). Bấm để rewalk cây realtime.
      </P>

      <H2>Bước 3 — Admin xác nhận</H2>
      <P>
        Trong{" "}
        <Code>Thành viên</Code>, admin thấy dòng "Tự xưng: …" dưới mỗi member
        và bấm <Strong>Xác nhận</Strong>. Trước khi xác nhận, lineage vẫn hiển
        thị cho chính người đó (xem riêng), chỉ chưa public.
      </P>

      <Callout>
        Đổi người tự xưng = reset xác nhận. Admin phải approve lại.
      </Callout>
    </>
  );
}

// ─── D. Đóng góp có duyệt ────────────────────────────────────────

export function Contributions() {
  return (
    <>
      <Lead>
        Người trong họ ai cũng biết thêm điều gì đó — ai mất năm bao nhiêu,
        cụ nào làm hương trưởng. <Strong>Đóng góp có duyệt</Strong> cho phép họ
        gửi đề xuất, admin xem rồi quyết định.
      </Lead>

      <H2>3 loại đề xuất</H2>
      <UL>
        <LI>
          <Strong>Sửa thông tin</Strong> — đổi tên, ngày, nơi sinh, nơi an táng.
        </LI>
        <LI>
          <Strong>Bổ sung tiểu sử</Strong> — nối thêm đoạn văn vào tiểu sử
          (không ghi đè).
        </LI>
        <LI>
          <Strong>Thêm vợ/chồng/con</Strong> — đề xuất thêm người mới kèm quan
          hệ với người đang xem.
        </LI>
      </UL>

      <H2>Ai gửi được</H2>
      <UL>
        <LI>
          <Strong>Thành viên trong dòng họ</Strong> (mọi vai trò, kể cả Viewer)
          — bấm <Strong>Đề xuất sửa</Strong> trên trang người.
        </LI>
        <LI>
          <Strong>Khách qua QR cá nhân</Strong> — quét QR ra trang chia sẻ,
          bấm <Strong>Đề xuất sửa</Strong> trên header. Cần ghi tên + email/sđt
          liên hệ + quan hệ với người đó.
        </LI>
      </UL>

      <H2>Admin duyệt</H2>
      <Steps>
        <LI>
          Drawer hiện badge <Strong>Đóng góp (N)</Strong> — N là số pending.
        </LI>
        <LI>
          Bấm vào → trang danh sách. Lọc theo trạng thái Chờ duyệt / Đã duyệt /
          Đã từ chối / Cần thêm.
        </LI>
        <LI>
          Bấm 1 đề xuất → xem diff side-by-side. Bấm{" "}
          <Strong>Duyệt + áp dụng</Strong> để ghi vào gia phả, hoặc{" "}
          <Strong>Từ chối</Strong> / <Strong>Cần thêm thông tin</Strong> (có ô
          ghi chú gửi lại cho người đóng góp).
        </LI>
      </Steps>

      <H2>Email tự động</H2>
      <UL>
        <LI>
          <Strong>Có đề xuất mới</Strong> → email cho mọi admin của clan.
        </LI>
        <LI>
          <Strong>Được duyệt / từ chối / cần thêm</Strong> → email cho người gửi
          (nếu có liên hệ).
        </LI>
      </UL>

      <Callout>
        Duyệt = mutate dữ liệu thật. App vẫn ghi nhật ký nên có thể khôi phục
        nếu lỡ duyệt nhầm — vào <Code>Nhật ký</Code> tìm sự kiện
        <Code>approved_contribution</Code> rồi bấm <Strong>Khôi phục</Strong>.
      </Callout>
    </>
  );
}

// ─── E. Việc cần làm (Todo) ──────────────────────────────────────

export function Todo() {
  return (
    <>
      <Lead>
        Sổ gia phả nào cũng còn chỗ trống — thiếu năm sinh, thiếu bố
        mẹ, có ông cụ chắc còn con cháu chưa ghi vào. Trang{" "}
        <Code>Việc cần làm</Code> tự dò các chỗ trống này và liệt kê
        ra để cả họ cùng bổ sung dần.
      </Lead>

      <H2>4 nhóm việc app tự dò</H2>
      <UL>
        <LI>
          <Strong>Thiếu cha/mẹ</Strong> — người chưa có bố/mẹ trong
          cây và không phải tổ. Đây là chỗ trống quan trọng nhất vì
          không gắn được vào đúng đời, đúng nhánh.
        </LI>
        <LI>
          <Strong>Thiếu năm sinh/mất</Strong> — không có cả ngày
          dương lẫn âm; hoặc đã mất nhưng chưa biết năm mất, chưa
          biết ngày giỗ.
        </LI>
        <LI>
          <Strong>Nhánh nghi sót</Strong> — đã có vợ/chồng, đủ tuổi
          30+, nhưng chưa ghi con nào. Khả năng cao là quên ghi —
          app gợi ý để kiểm tra lại.
        </LI>
        <LI>
          <Strong>Thiếu ảnh / âm lịch</Strong> — chưa có ảnh đại
          diện, hoặc đã có ngày dương mà chưa quy đổi âm lịch. Nhẹ
          ký nhất, ai cũng có thể đóng góp.
        </LI>
      </UL>

      <H2>Ai thấy được trang này</H2>
      <P>
        Mọi thành viên của dòng họ đều thấy. Sidebar có badge số
        việc cần xử lý (cap 99+) để nhắc — chỉ đếm 3 nhóm{" "}
        <Strong>quan trọng</Strong> (cha/mẹ, ngày, nhánh nghi sót).
        Nhóm <Code>thiếu ảnh/âm lịch</Code> không tính vào badge để
        khỏi nhiễu.
      </P>

      <H2>Bấm vào 1 mục thì sao?</H2>
      <UL>
        <LI>
          <Strong>Admin / Editor</Strong> → mở thẳng trang{" "}
          <Code>Sửa</Code> của người đó, sửa rồi lưu.
        </LI>
        <LI>
          <Strong>Member chỉ xem</Strong> → mở trang chi tiết, bấm
          nút <Strong>Đề xuất bổ sung</Strong> ở góc → app gửi đề
          xuất qua <Code>Đóng góp có duyệt</Code>. Admin duyệt thì
          dữ liệu được cập nhật.
        </LI>
      </UL>

      <Callout>
        Số liệu ở từng tab cập nhật theo thời gian thực sau khi sửa
        — chỉ cần đóng/mở lại trang. Đây là động lực để cả họ cùng
        đầy đầy số liệu, thấy số việc cần làm giảm dần là vui.
      </Callout>
    </>
  );
}

// ─── F. Liên kết thông gia ───────────────────────────────────────

export function Inlaws() {
  return (
    <>
      <Lead>
        Em gái lấy chồng họ Nguyễn — cô ấy có 1 record trong sổ Họ Huỳnh
        (như con gái), 1 record trong sổ Họ Nguyễn (như dâu). Hai bản
        ghi là cùng một người, nhưng app chưa biết. <Strong>Liên kết
        thông gia</Strong> nói cho app biết, để bấm 1 cái nhảy qua xem
        sổ bên kia.
      </Lead>

      <H2>Nguyên tắc cốt lõi</H2>
      <UL>
        <LI>
          Mỗi clan vẫn <Strong>tự chứa</Strong> dâu/rể của mình — không
          phá quyền sở hữu dữ liệu.
        </LI>
        <LI>
          Link là <Strong>chú thích</Strong>, không phải merge. Gỡ link
          → cả hai cây vẫn nguyên vẹn.
        </LI>
        <LI>
          Phải có <Strong>cả hai admin đồng ý</Strong> mới hiệu lực
          (mô hình proposal → confirm).
        </LI>
        <LI>
          Chỉ <Strong>hé tối thiểu</Strong> dữ liệu bên kia: tên + dòng
          họ + giới tính + năm sinh/mất. Không lộ ảnh, tiểu sử, nơi
          sinh.
        </LI>
      </UL>

      <H2>Khi nào dùng</H2>
      <P>
        Chỉ khi <Strong>cả hai dòng họ đều đang ở trên platform</Strong>.
        Nếu nhà thông gia chưa dùng app → cứ ghi dâu/rể vào sổ bên này
        như bình thường, không cần làm gì thêm.
      </P>

      <H2>Bên A đề nghị nối (admin)</H2>
      <Steps>
        <LI>
          Sidebar trái → <Strong>Quản trị</Strong> →{" "}
          <Strong>Liên kết thông gia</Strong>. Bấm{" "}
          <Strong>+ Đề nghị mới</Strong>.
        </LI>
        <LI>
          <Strong>Bước 1</Strong>: gõ tên dâu/rể trong dòng họ này
          (vd "Huỳnh Thị Lan"), chọn từ kết quả.
        </LI>
        <LI>
          <Strong>Bước 2</Strong>: viết gợi ý người bên kia (vd "Hiện
          là dâu họ Nguyễn, sinh 1985, ở Hà Nội") + ghi chú tuỳ chọn.
          Bấm <Strong>Tạo mã mời</Strong>.
        </LI>
        <LI>
          App sinh <Strong>link mời</Strong>. Bấm icon copy → gửi qua
          Zalo / SMS / email cho admin bên kia.
        </LI>
      </Steps>

      <H2>Bên B xác nhận (admin)</H2>
      <Steps>
        <LI>Mở link → đăng nhập (nếu chưa).</LI>
        <LI>
          Xem preview "Họ X đề nghị nối: ..." → chọn dòng họ của bạn →
          tìm + chọn đúng người trong sổ.
        </LI>
        <LI>
          Bấm <Strong>Xác nhận liên kết</Strong>. Mã mời tự huỷ ngay
          sau khi confirm — link chỉ dùng 1 lần.
        </LI>
      </Steps>

      <H2>Sau khi link confirmed</H2>
      <UL>
        <LI>
          Trang chi tiết người (cả hai bên) hiện card{" "}
          <Strong>Liên kết thông gia</Strong> với tên + clan + lifespan
          + nút <Strong>Xem</Strong> → mở trang bên kia.
        </LI>
        <LI>
          Trang <Code>/inlaws</Code> tab <Strong>Đã liên kết</Strong>{" "}
          liệt kê mọi liên kết của dòng họ.
        </LI>
        <LI>
          Admin một trong hai bên có thể <Strong>Thu hồi</Strong> bất
          cứ lúc nào — link biến mất ở cả hai bên, dữ liệu gia phả mỗi
          bên không đổi.
        </LI>
      </UL>

      <H2>Riêng tư người sống</H2>
      <Callout>
        Nếu clan bên kia bật <Code>hide_living_for_nonmembers</Code>{" "}
        (mặc định), bạn (không phải member bên kia) sẽ chỉ thấy{" "}
        <Strong>"Người còn sống — họ X chưa công khai"</Strong>, không
        lộ tên. Member của clan bên kia thì thấy đầy đủ.
      </Callout>
    </>
  );
}

// ─── F. Web Push ─────────────────────────────────────────────────

export function WebPush() {
  return (
    <>
      <Lead>
        Thông báo đẩy (Web Push) là <Strong>lớp nhắc bổ sung</Strong> —
        chạy ngay cả khi app đang đóng. App vẫn hữu ích nếu bạn không
        bật: trang <Code>Hôm nay</Code>, email nhắc, và xuất lịch{" "}
        <Code>.ics</Code> vẫn chạy.
      </Lead>

      <H2>Bật ở đâu</H2>
      <Steps>
        <LI>
          Vào trang <Code>Tài khoản</Code> → mục <Strong>Thông báo đẩy
          (Web Push)</Strong>.
        </LI>
        <LI>
          Bấm vào ô check để bật. App hiện một dòng giải thích trước —
          bấm <Strong>Cho phép thông báo</Strong> để mở prompt hệ thống.
        </LI>
        <LI>
          Trình duyệt hỏi quyền → chọn <Strong>Allow</Strong>. Nếu lỡ
          bấm <Strong>Block</Strong>, vào Cài đặt trình duyệt → Quyền →
          Thông báo → bỏ chặn cho app này rồi quay lại.
        </LI>
        <LI>
          Sau khi bật, bấm <Strong>Gửi thông báo test</Strong> để kiểm
          tra ngay — thông báo "Test thông báo Gia phả" sẽ hiện trên
          điện thoại trong vài giây.
        </LI>
      </Steps>

      <H2>Khi nào sẽ nhận thông báo</H2>
      <UL>
        <LI>
          <Strong>Giỗ và sinh nhật</Strong> — đúng ngày (07:05 sáng VN)
          hoặc trước N ngày tuỳ cấu hình <Code>Theo dõi</Code> ở trang
          Sự kiện.
        </LI>
        <LI>
          <Strong>Mùng 1 / rằm âm lịch</Strong> — nếu bật toggle "Nhắc
          mùng 1 và rằm" cùng trang Tài khoản.
        </LI>
        <LI>
          <Strong>Đóng góp mới</Strong> (chỉ admin) — khi có người gửi
          đề xuất sửa cây, push tới mọi admin của dòng họ.
        </LI>
        <LI>
          <Strong>Kết quả đóng góp</Strong> (cho người gửi) — khi admin
          duyệt/từ chối đề xuất của bạn.
        </LI>
      </UL>

      <H2>iOS — quan trọng phải cài app vào màn hình chính</H2>
      <P>
        iOS chỉ hỗ trợ Web Push <Strong>từ phiên bản 16.4 trở lên</Strong>{" "}
        VÀ <Strong>bắt buộc app phải được thêm vào màn hình chính</Strong>{" "}
        (Add to Home Screen). Mở app bằng Safari thường thì <Strong>không
        push được</Strong>.
      </P>
      <Steps>
        <LI>Trên iOS, mở app bằng Safari.</LI>
        <LI>
          Bấm nút Share (mũi tên đi lên trong khung) →{" "}
          <Strong>Add to Home Screen</Strong>.
        </LI>
        <LI>
          Mở app từ icon vừa cài (không phải Safari) → vào{" "}
          <Code>Tài khoản</Code> → bật push như bước thông thường.
        </LI>
      </Steps>
      <Callout>
        Nếu iOS dưới 16.4 hoặc không cài được PWA → dùng phương án{" "}
        <Code>Xuất lịch .ics</Code> ở trang Sự kiện thay thế. Lịch
        điện thoại quen thuộc sẽ nhắc giỗ/sinh nhật.
      </Callout>

      <H2>Tắt push</H2>
      <P>
        Vào lại <Code>Tài khoản</Code>, bỏ tích ô. App sẽ huỷ
        subscription trên thiết bị này. Bật/tắt độc lập theo từng
        thiết bị — bật trên điện thoại không tự động bật trên máy
        tính.
      </P>

      <H2>Vì sao push không tới?</H2>
      <UL>
        <LI>
          <Strong>iOS chưa cài PWA</Strong> — xem mục trên.
        </LI>
        <LI>
          <Strong>Quyền bị Block</Strong> trong trình duyệt → bỏ chặn
          ở Cài đặt → Quyền → Thông báo cho app này.
        </LI>
        <LI>
          <Strong>Chế độ tiết kiệm pin</Strong> trên Android có thể trì
          hoãn / gộp push. Đây là giới hạn của hệ điều hành.
        </LI>
        <LI>
          <Strong>Không có sự kiện hôm nay</Strong> — push chỉ chạy khi
          có giỗ/sinh nhật/đóng góp/rằm. Test push để kiểm tra đường
          gửi đang ok.
        </LI>
      </UL>

      <H2>Quyền riêng tư</H2>
      <Callout>
        Payload thông báo đẩy bị giới hạn 4KB và được mã hoá đầu-cuối.
        App chỉ gửi tối thiểu (tiêu đề + 1 dòng + link mở), không nhét
        dữ liệu nhạy cảm. Người sống được áp đúng quy tắc ẩn
        <Code>hide_living_for_nonmembers</Code> — nội dung push không
        lộ thông tin mà bạn không được phép thấy trong app.
      </Callout>
    </>
  );
}
