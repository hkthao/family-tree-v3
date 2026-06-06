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

// ─── E. Liên kết thông gia ───────────────────────────────────────

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
