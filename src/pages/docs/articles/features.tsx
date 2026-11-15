import { Link } from "react-router-dom";

import { Callout, Code, H2, Lead, LI, P, Steps, Strong, UL } from "../prose";

export function HomeCustomize() {
  return (
    <>
      <Lead>
        Trang <Strong>Tổng quan</Strong> là trang chủ của dòng họ. Bạn tự chọn
        những gì hiện ở đó — mục nào dùng nhiều thì để lên đầu, mục không dùng
        thì ẩn đi.
      </Lead>

      <H2>Trên trang Tổng quan có gì</H2>
      <UL>
        <LI>
          <Strong>Ô tìm người</Strong> ở đầu trang — gõ tên (không dấu cũng
          được) để mở ngay hồ sơ.
        </LI>
        <LI>
          <Strong>Thẻ Hôm nay</Strong> — ngày dương/âm lịch, giỗ và sinh nhật
          sắp tới; bấm mũi tên trái/phải để xem hôm trước, hôm sau.
        </LI>
        <LI>
          <Strong>Bước tiếp theo</Strong> — một gợi ý ngắn về việc nên làm kế
          tiếp (thêm ảnh, bổ sung ngày giỗ, thử một tính năng chưa dùng…). Bấm{" "}
          <Code>Để sau</Code> nếu chưa muốn thấy gợi ý đó.
        </LI>
        <LI>
          <Strong>Thao tác nhanh</Strong> — tối đa 12 ô lối tắt. Ô cuối luôn là{" "}
          <Strong>Tất cả tính năng</Strong>.
        </LI>
      </UL>

      <H2>Tuỳ chỉnh trang chủ</H2>
      <P>Mặc định app tự xếp các ô theo mức bạn hay bấm. Muốn tự quyết:</P>
      <Steps>
        <LI>
          Bấm biểu tượng <Strong>Tuỳ chỉnh trang chủ</Strong> (hình thanh trượt,
          cạnh ô tìm người) để mở ngăn kéo.
        </LI>
        <LI>
          Chọn ô muốn <Strong>ghim</Strong> và dùng nút <Code>Chuyển lên</Code>{" "}
          / <Code>Chuyển xuống</Code> để sắp thứ tự. Muốn app tự xếp lại thì bấm{" "}
          <Code>Quay về tự động</Code>.
        </LI>
        <LI>
          Ở mục <Strong>Hiển thị trên trang chủ</Strong>, bật/tắt từng thẻ: Lịch
          hôm nay, Podcast hôm nay, Số liệu dòng họ, Tiến độ hoàn thiện, Hoạt
          động gần đây, Hồ sơ của tôi, Ảnh gia đình…
        </LI>
      </Steps>

      <Callout kind="info" title="Lưu ở đâu?">
        Lựa chọn của bạn được lưu <Strong>trên thiết bị đang dùng</Strong>. Mở
        bằng điện thoại khác hoặc trình duyệt khác sẽ thấy bố cục mặc định, cần
        chọn lại.
      </Callout>

      <H2>Tất cả tính năng ở đâu</H2>
      <P>
        Menu trái chỉ giữ vài mục dùng hằng ngày (Tổng quan, Cây gia phả, Danh
        bạ, Tra cứu quan hệ, Sự kiện). Mọi tính năng còn lại nằm trong{" "}
        <Strong>Tất cả tính năng</Strong>, chia nhóm: Cộng đồng &amp; Di sản,
        Thành viên &amp; Cài đặt, Công cụ &amp; Quản trị.
      </P>
    </>
  );
}

export function Events() {
  return (
    <>
      <Lead>
        Trang <Strong>Sự kiện</Strong> gom giỗ, sinh nhật, lễ tết và họp họ vào
        một nơi, để cả họ cùng nhớ.
      </Lead>

      <H2>Các loại sự kiện</H2>
      <UL>
        <LI>
          <Strong>Giỗ</Strong> và <Strong>sinh nhật</Strong> — tự sinh từ ngày
          mất / ngày sinh của từng người, tính theo âm lịch với giỗ.
        </LI>
        <LI>
          <Strong>Lễ tết</Strong> — các ngày lễ truyền thống.
        </LI>
        <LI>
          <Strong>Họp họ, chạp họ, tảo mộ</Strong> — do bạn tự tạo, có thể lặp
          lại hằng năm.
        </LI>
      </UL>

      <H2>Lọc và xem chi tiết</H2>
      <P>
        Bấm biểu tượng bộ lọc để chọn loại sự kiện, khoảng thời gian hay chi.
        Bấm vào một sự kiện, chi tiết mở ra ở ngăn kéo bên cạnh nên bạn không
        mất chỗ đang xem.
      </P>

      <H2>Nhắc trước</H2>
      <P>
        Muốn được nhắc giỗ, bật thông báo (xem{" "}
        <Link to="/docs/web-push" className="underline">
          Thông báo đẩy
        </Link>
        ) hoặc đăng ký nhận email. Chi tiết cách tính giỗ ở bài{" "}
        <Link to="/docs/lich-am-duong" className="underline">
          Ngày sinh &amp; ngày mất theo dương lịch + âm lịch
        </Link>
        .
      </P>
    </>
  );
}

export function Graves() {
  return (
    <>
      <Lead>
        <Strong>Mộ phần &amp; tro cốt</Strong> lưu nơi an nghỉ của các cụ để con
        cháu — kể cả người ở xa — tìm về đúng chỗ.
      </Lead>

      <H2>Ghi được những gì</H2>
      <UL>
        <LI>
          <Strong>Mộ chôn cất</Strong>, và cả <Strong>tro cốt</Strong> gửi chùa,
          nhà lưu tro, tháp họ, hoặc rải tro.
        </LI>
        <LI>
          Một nơi an nghỉ có thể gắn <Strong>nhiều người</Strong> (mộ đôi vợ
          chồng, mộ chung, tháp họ).
        </LI>
        <LI>
          <Strong>Ảnh</Strong> và <Strong>vị trí GPS</Strong>; nút{" "}
          <Code>Chỉ đường</Code> mở bản đồ dẫn đến tận nơi.
        </LI>
        <LI>
          Nghĩa trang / nơi lưu tro có thể được quản lý riêng và gom các mộ
          trong cùng nơi.
        </LI>
      </UL>

      <H2>Thêm một nơi an nghỉ</H2>
      <Steps>
        <LI>
          Vào <Strong>Mộ phần &amp; tro cốt</Strong> (trong Cộng đồng &amp; Di
          sản) → <Code>Thêm</Code>.
        </LI>
        <LI>Chọn loại (mộ hay tro cốt), điền tên nơi chốn và địa chỉ.</LI>
        <LI>
          Đang đứng tại mộ thì bấm <Code>Lấy vị trí hiện tại</Code> để lưu toạ
          độ chính xác.
        </LI>
        <LI>Gắn những người an nghỉ ở đó và thêm ảnh.</LI>
      </Steps>
      <P>
        Trong hồ sơ mỗi người cũng hiện nơi an nghỉ của họ, bấm vào là sang
        trang mộ phần.
      </P>
    </>
  );
}

export function MapPage() {
  return (
    <>
      <Lead>
        <Strong>Bản đồ</Strong> cho thấy con cháu và mộ phần của dòng họ phân bố
        theo tỉnh/thành.
      </Lead>
      <UL>
        <LI>
          Dữ liệu lấy từ <Strong>nơi sinh, nơi ở</Strong> của từng người và vị
          trí các mộ phần — bổ sung càng đầy đủ, bản đồ càng đúng.
        </LI>
        <LI>Bấm vào một tỉnh/thành để xem những ai ở đó.</LI>
      </UL>
      <Callout kind="tip" title="Muốn bản đồ đầy hơn?">
        Mở <Strong>Việc cần làm</Strong> để app liệt kê những người còn thiếu
        nơi ở, rồi bổ sung dần.
      </Callout>
    </>
  );
}

export function MemoryRoom() {
  return (
    <>
      <Lead>
        Hai chỗ để cả họ cùng góp ảnh: <Strong>Phòng ký ức</Strong> (phòng trưng
        bày ảnh 3D) và <Strong>Ảnh ghép</Strong> (mỗi người một mảnh).
      </Lead>

      <H2>Phòng ký ức</H2>
      <UL>
        <LI>
          Ảnh của dòng họ được treo trong một phòng trưng bày 3D — kéo hoặc vuốt
          để đi quanh, bấm vào ảnh để xem to và đọc chú thích.
        </LI>
        <LI>
          Có thể tạo nhiều phòng theo chủ đề (đám cưới, quê nhà, ngày họp họ…).
        </LI>
      </UL>

      <H2>Ảnh ghép</H2>
      <UL>
        <LI>
          Một bức ảnh lớn được chia thành nhiều mảnh;{" "}
          <Strong>mỗi thành viên góp một mảnh</Strong> là ảnh của chính mình.
        </LI>
        <LI>
          Khi đủ mảnh, bức ghép hiện ra như một bức chân dung cả họ — rất hợp
          làm kỷ niệm dịp họp họ.
        </LI>
      </UL>
      <Callout kind="info" title="Máy yếu">
        Phòng 3D cần điện thoại/máy tính đủ khoẻ. Nếu bị chậm, hãy dùng danh
        sách ảnh thường.
      </Callout>
    </>
  );
}

export function Heritage() {
  return (
    <>
      <Lead>
        Ba mục giúp dòng họ lưu giữ những thứ không nằm trong cây gia phả:{" "}
        <Strong>Di sản</Strong>, <Strong>Quỹ họ</Strong> và{" "}
        <Strong>Bảng vàng công đức</Strong>.
      </Lead>

      <H2>Di sản dòng họ</H2>
      <P>
        Lưu từ đường, tục lệ, giai thoại, kỷ vật của dòng họ — mỗi mục có mô tả,
        ảnh và có thể gắn với những người liên quan. Đây là nơi giữ câu chuyện
        mà con số và tên tuổi không kể hết.
      </P>

      <H2>Quỹ họ</H2>
      <P>
        Sổ thu chi minh bạch của quỹ họ: ghi khoản thu, khoản chi, ai đóng góp,
        để cả họ cùng xem và tin tưởng. Người quản trị ghi sổ; thành viên xem
        được.
      </P>

      <H2>Bảng vàng công đức</H2>
      <P>
        Ghi nhận người có đóng góp cho dòng họ và những thành tích đáng tự hào
        (học hành, công trạng…), để con cháu biết và noi theo.
      </P>
      <Callout kind="info" title="Ai xem được?">
        Mỗi mục theo quyền xem của dòng họ. Chủ dòng họ chỉnh trong{" "}
        <Strong>Cài đặt dòng họ → Hiển thị &amp; quyền xem</Strong>.
      </Callout>
    </>
  );
}

export function Board() {
  return (
    <>
      <Lead>
        <Strong>Bảng tin</Strong> là nơi đăng tin tức, tin vui, thông báo chung
        của họ — như một bảng thông báo ở nhà thờ họ nhưng ai cũng đọc được từ
        xa.
      </Lead>
      <UL>
        <LI>Thành viên có quyền đăng viết bài, kèm ảnh.</LI>
        <LI>
          Người quản trị có thể <Strong>kiểm duyệt</Strong> bài trước khi hiện.
        </LI>
        <LI>Thông báo quan trọng có thể gửi tới cả họ qua thông báo đẩy.</LI>
      </UL>
    </>
  );
}

export function FamilyBook() {
  return (
    <>
      <Lead>
        <Strong>Sổ gia phả</Strong> gom toàn bộ gia phả thành một cuốn sổ để in
        hoặc lưu — xuất ra file PDF chỉ với một nút.
      </Lead>

      <H2>Cuốn sổ gồm những phần nào</H2>
      <UL>
        <LI>Bìa và trang giới thiệu dòng họ.</LI>
        <LI>
          <Strong>Lời nói đầu</Strong>, <Strong>phả ký</Strong>,{" "}
          <Strong>ngoại phả</Strong>, <Strong>phụ khảo</Strong> — các phần văn
          bản do bạn soạn (có mẫu sẵn để sửa).
        </LI>
        <LI>
          <Strong>Phả hệ</Strong>, <Strong>phả đồ</Strong>, danh sách ngày giỗ
          và cưới gả — tự dựng từ dữ liệu, không cần gõ lại.
        </LI>
      </UL>

      <H2>Cách xuất</H2>
      <Steps>
        <LI>
          Vào <Strong>Sổ gia phả</Strong> (Thông tin &amp; Sổ gia phả) rồi điền
          các phần văn bản (phần nào để trống thì không in).
        </LI>
        <LI>
          Bấm <Code>Xuất sổ gia phả PDF</Code> (trên thẻ Thao tác nhanh ở Tổng
          quan hoặc trong Cài đặt dòng họ), chờ file tạo xong rồi tải về hoặc
          in.
        </LI>
      </Steps>
      <P>
        Mẹo: nhập đủ ngày sinh, ngày mất và quan hệ trước khi xuất; phả hệ và
        phả đồ chỉ đúng khi dữ liệu đúng.
      </P>
    </>
  );
}

export function BulkImport() {
  return (
    <>
      <Lead>
        Đã có sẵn gia phả trong Excel, hay chỉ có vài dòng mô tả? Đừng gõ lại
        từng người — hãy nhập hàng loạt.
      </Lead>

      <H2>Nhập từ Excel</H2>
      <Steps>
        <LI>
          Vào <Strong>Công cụ &amp; Quản trị → Nhập từ Excel</Strong>, tải file
          mẫu.
        </LI>
        <LI>Điền dữ liệu vào đúng cột, rồi tải file lên.</LI>
        <LI>
          App <Strong>kiểm tra lỗi trước</Strong> (thiếu tên, ngày sai, quan hệ
          lạ) và cho bạn xem bản xem trước; chỉ khi bạn xác nhận mới ghi vào
          dòng họ.
        </LI>
      </Steps>

      <H2>Sinh bằng AI</H2>
      <P>
        Mô tả bằng lời (vd. “Ông A sinh 1950, vợ là bà B, có 3 con…”), AI dựng
        thành dữ liệu để bạn <Strong>duyệt</Strong> rồi mới nhập. AI có thể sai,
        hãy đọc lại trước khi xác nhận.
      </P>

      <Callout kind="warn" title="Trùng người">
        Nhập xong nếu thấy có người bị trùng, dùng{" "}
        <Link to="/docs/gop-trung" className="underline">
          Gộp người trùng
        </Link>
        .
      </Callout>
    </>
  );
}

export function Assistant() {
  return (
    <>
      <Lead>
        <Strong>Trợ lý AI</Strong> trả lời câu hỏi về gia phả của chính dòng họ
        bạn bằng lời thường: “Ông nội của An là ai?”, “Tháng này có giỗ ai?”.
      </Lead>
      <UL>
        <LI>
          Mở từ <Strong>Công cụ &amp; Quản trị → Trợ lý AI</Strong> (hiện khi
          tính năng được bật cho dòng họ).
        </LI>
        <LI>Trợ lý chỉ dựa trên dữ liệu trong dòng họ của bạn.</LI>
        <LI>
          Có hạn mức lượt dùng; xem phần còn lại ở{" "}
          <Strong>Tài khoản → Lượt dùng</Strong>.
        </LI>
      </UL>
      <Callout kind="warn" title="Luôn kiểm tra lại">
        AI có thể hiểu nhầm. Với thông tin quan trọng (ngày giỗ, quan hệ), hãy
        mở hồ sơ người đó để đối chiếu.
      </Callout>
    </>
  );
}

export function Calendar() {
  return (
    <>
      <Lead>
        <Strong>Lịch âm dương</Strong> hiển thị lịch tháng với ngày âm, ngày tốt
        xấu và lễ tết; bấm một ngày để xem chi tiết.
      </Lead>
      <UL>
        <LI>Mỗi ô ngày có ngày dương và ngày âm.</LI>
        <LI>
          Bấm vào ngày để xem Can Chi, ngày tốt/xấu, việc nên và không nên làm —
          hữu ích khi chọn ngày cưới hỏi, động thổ, họp họ.
        </LI>
        <LI>Giỗ và sự kiện của dòng họ cũng hiện trên lịch để dễ sắp xếp.</LI>
      </UL>
      <Callout kind="info" title="Chỉ để tham khảo">
        Thông tin ngày tốt xấu là tập quán dân gian, không phải khẳng định. Hãy
        tham khảo thêm người lớn tuổi trong họ.
      </Callout>
    </>
  );
}

export function Language() {
  return (
    <>
      <Lead>
        App dùng được bằng <Strong>tiếng Việt</Strong> và{" "}
        <Strong>tiếng Anh</Strong> — tiện cho con cháu ở nước ngoài.
      </Lead>
      <Steps>
        <LI>
          Vào <Strong>Tài khoản → Ngôn ngữ</Strong> (hoặc biểu tượng ngôn ngữ ở
          góc màn hình đăng nhập).
        </LI>
        <LI>Chọn ngôn ngữ giao diện; lựa chọn được ghi nhớ.</LI>
      </Steps>
      <P>
        Dữ liệu bạn nhập (tên người, ghi chú) không bị dịch. Một vài phần như
        lịch âm, file PDF vẫn bằng tiếng Việt.
      </P>
    </>
  );
}
