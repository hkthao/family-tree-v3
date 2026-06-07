import { Callout, Code, H2, H3, Lead, LI, P, Strong, UL } from "../prose";

export function Crud() {
  return (
    <>
      <Lead>
        Mọi thông tin trong dòng họ xoay quanh bảng "người". Form thêm/sửa
        thiết kế để khỏi bị trống quá nhiều — chỉ tên là bắt buộc.
      </Lead>

      <H2>Thêm người mới</H2>
      <P>
        <Code>Danh bạ</Code> → <Strong>Thêm người</Strong>. Form có nhiều
        trường, nhưng chỉ <Code>Họ và tên</Code> là phải điền. Mọi thứ còn
        lại bỏ trống thoải mái, bổ sung sau khi tìm được thông tin.
      </P>

      <H3>Trường hay dùng</H3>
      <UL>
        <LI>
          <Strong>Họ và tên</Strong> — viết đầy đủ. App tự sinh thêm bản không
          dấu để tìm kiếm.
        </LI>
        <LI>
          <Strong>Giới tính</Strong> — Nam / Nữ. Mặc định Nam.
        </LI>
        <LI>
          <Strong>Ngày sinh</Strong> — có thể bỏ trống ngày/tháng nếu chỉ
          biết năm.
        </LI>
        <LI>
          <Strong>Đã mất</Strong> — bật ô này nếu người đã qua đời. Tự bật khi
          điền Ngày mất.
        </LI>
        <LI>
          <Strong>Thuỷ tổ</Strong> — chỉ bật khi đây là gốc của dòng/chi. Đời
          sẽ tự = 1.
        </LI>
      </UL>

      <H3>Trường nâng cao</H3>
      <P>
        Tên tự, tên húy, tên thụy, nơi sinh, nơi an táng, tiểu sử — điền khi
        bạn có nguồn. Đọc thêm{" "}
        <a href="/docs/ten-tieng-viet" className="text-primary underline">
          Tên tiếng Việt
        </a>{" "}
        nếu chưa rõ 3 loại tên này khác nhau ở đâu.
      </P>

      <H2>Sửa</H2>
      <P>
        Vào trang chi tiết người, bấm <Strong>Sửa</Strong>. Đổi gì cũng được,
        lưu lại. Mỗi lần sửa app ghi vào Nhật ký — không bao giờ mất phiên
        bản cũ.
      </P>

      <H2>Xoá</H2>
      <P>
        Bấm <Strong>Xoá</Strong> ở trang chi tiết. App dùng{" "}
        <Strong>xoá mềm</Strong> — dữ liệu chỉ bị ẩn khỏi danh bạ, vẫn còn
        nguyên trong DB. Vào{" "}
        <Code>Nhật ký</Code> (Drawer) tìm dòng <Code>Xoá</Code>, bấm{" "}
        <Strong>Khôi phục</Strong> là trở lại.
      </P>
      <Callout kind="warn" title="Xoá không xoá quan hệ con">
        Xoá người là cha của ai đó thì các con vẫn còn — quan hệ cha-con bị
        cắt. Khôi phục lại sẽ nối lại quan hệ.
      </Callout>
    </>
  );
}

export function VnNames() {
  return (
    <>
      <Lead>
        Trong truyền thống, một người có thể có 3-4 tên khác nhau ở các thời
        kỳ khác nhau. App lưu riêng từng loại để gia phả khớp với cách gọi
        trong văn cúng và sổ giấy.
      </Lead>

      <H2>4 loại tên</H2>

      <H3>Họ và tên (bắt buộc)</H3>
      <P>
        Tên đầy đủ dùng đời thường. Đây là trường duy nhất bắt buộc. Dùng cho
        hiển thị mọi nơi (cây, danh bạ, link chia sẻ).
      </P>

      <H3>Tên tự</H3>
      <P>
        Tên đặt khi trưởng thành (thường tuổi 20 — lễ Quán). Dùng nơi trang
        trọng, văn thư, người ngoài xưng hô. Ví dụ: cụ Nguyễn Du có tên tự là{" "}
        <Code>Tố Như</Code>.
      </P>

      <H3>Tên húy</H3>
      <P>
        Tên khai sinh, do cha mẹ đặt. Sau khi người mất, con cháu kiêng gọi
        thẳng — chỉ dùng trong văn cúng để báo danh. Trên gia phả ghi để các
        đời sau biết tránh đặt tên trùng.
      </P>

      <H3>Tên thụy</H3>
      <P>
        Tên đặt sau khi mất — dùng trong văn cúng, khắc trên bia mộ. Thường
        do con cháu hoặc nhà chùa đặt. Có ý nghĩa khen ngợi đức tính.
      </P>

      <Callout kind="tip" title="Không biết thì bỏ trống">
        Hầu hết người trong họ chỉ có Họ và tên. 3 loại tên kia chỉ cụ nội /
        thượng cấp đời xưa mới có đầy đủ. Bỏ trống không sao, không hiển thị
        nếu không có.
      </Callout>
    </>
  );
}

export function Dates() {
  return (
    <>
      <Lead>
        Người Việt vừa dùng dương lịch (ngày sinh nhật) vừa dùng âm lịch
        (ngày giỗ). App lưu cả hai, tự quy đổi cho bạn.
      </Lead>

      <H2>Dương lịch</H2>
      <P>
        Trường <Code>Ngày sinh</Code> và <Code>Ngày mất</Code> nhận ngày
        dương. Có 3 mức chính xác:
      </P>
      <UL>
        <LI>
          <Strong>Đủ ngày tháng năm</Strong> (vd 15/06/1980) — chính xác nhất.
        </LI>
        <LI>
          <Strong>Chỉ tháng năm</Strong> (06/1980) — không biết ngày, vẫn nhập
          được. Để trống ô Ngày.
        </LI>
        <LI>
          <Strong>Chỉ năm</Strong> (1980) — phổ biến với người sinh trước
          1950. Để trống Ngày + Tháng.
        </LI>
      </UL>

      <H2>Âm lịch tự quy đổi</H2>
      <P>
        Nếu bạn nhập đủ ngày-tháng-năm dương lịch, app tự tính ra ngày âm
        tương ứng và hiển thị trên trang chi tiết người. Không cần nhập tay.
      </P>
      <P>
        Trường hợp gia phả cũ chỉ ghi ngày âm (đa số bia mộ trước 1950), bạn
        có thể nhập ngày âm trực tiếp ở trường <Code>birth_lunar_year/month/day</Code>{" "}
        + <Code>death_lunar_year/month/day</Code> qua nhập Excel hoặc API.
        UI hiện ưu tiên nhập dương.
      </P>

      <H2>Ngày giỗ và Can Chi</H2>
      <P>
        Nếu người đã mất, app tự suy ra <Strong>ngày giỗ</Strong> theo âm
        lịch và hiển thị mỗi năm trong tab <Code>Sự kiện</Code>. Kèm thông tin{" "}
        <Strong>Can Chi</Strong> (Giáp Tý, Ất Sửu…) — tiện cho con cháu chuẩn
        bị cúng giỗ.
      </P>

      <Callout kind="tip" title="Sinh nhật 29/02">
        Người sinh ngày nhuận: app lùi xuống 28/02 trong các năm không nhuận,
        ngày sinh thật vẫn lưu nguyên.
      </Callout>
    </>
  );
}

export function RootAndGeneration() {
  return (
    <>
      <Lead>
        Đời (generation) không cần nhập tay. Bật ô <Strong>Thuỷ tổ</Strong>{" "}
        cho cụ tổ là Đời 1, mọi con cháu sẽ tự đẩy đời theo quan hệ cha-con.
      </Lead>

      <H2>Quy tắc tính đời</H2>
      <UL>
        <LI>
          <Strong>Thuỷ tổ</Strong> = Đời 1. Bật ô trong form thêm/sửa người.
        </LI>
        <LI>
          Con của Đời N → Đời N+1. App tính qua quan hệ cha-con trong{" "}
          <Code>families</Code>, không quan tâm thứ tự nhập.
        </LI>
        <LI>
          Vợ/chồng kết hôn với người Đời N → bản thân vợ/chồng vẫn{" "}
          <Strong>không có đời</Strong> nếu họ không phải con cháu Thuỷ tổ.
          Đời chỉ áp cho dòng máu trực hệ.
        </LI>
      </UL>

      <Callout kind="tip" title="Nhiều Thuỷ tổ trong cùng dòng họ">
        Khi nhiều chi tách lập, mỗi chi có 1 Thuỷ tổ riêng. Cả họ vẫn dùng
        một dòng họ chung — chỉ là có nhiều cây con. App tự tính đời cho từng
        cây từ Thuỷ tổ gần nhất.
      </Callout>

      <H2>Khi nào đời tự cập nhật</H2>
      <P>
        Mọi thay đổi quan hệ cha/mẹ-con trong DB trigger tự tính lại đời cho
        cả nhánh con cháu. Bạn không cần làm gì — bấm Lưu là xong.
      </P>
      <UL>
        <LI>
          Đổi ô <Code>Thuỷ tổ</Code>: đời người này thành 1, mọi con cháu nhảy
          theo.
        </LI>
        <LI>
          Gán cha mới cho 1 người: đời người đó (và con cháu của họ) tự nhảy
          theo cha mới.
        </LI>
        <LI>
          Xoá mềm một mắt xích ở giữa: đời con cháu bên dưới bị reset thành{" "}
          <Code>null</Code> vì mất liên kết.
        </LI>
      </UL>

      <Callout kind="warn" title="Đời = null xuất hiện">
        Nếu thấy người ở danh bạ <Strong>không có đời</Strong> nhưng bạn nghĩ
        họ phải có, kiểm tra:
        <ul className="list-disc pl-5 mt-1">
          <li>Cha/mẹ đã được nhập chưa?</li>
          <li>Có Thuỷ tổ nào trong tổ tiên không?</li>
        </ul>
        Đời <Code>null</Code> nghĩa là chuỗi quan hệ về Thuỷ tổ bị đứt ở đâu
        đó.
      </Callout>
    </>
  );
}

export function Relationships() {
  return (
    <>
      <Lead>
        Quan hệ vợ-chồng và con cái lưu qua khái niệm <Strong>Family Unit</Strong>{" "}
        — 1 đơn vị hôn nhân gồm chồng + vợ + n con. Cách app nối hợp lý với
        người Việt: 1 người có nhiều vợ/chồng → có nhiều Family Unit.
      </Lead>

      <H2>Thêm vợ / chồng</H2>
      <P>
        Vào trang chi tiết người, mục <Strong>Quan hệ → Vợ / chồng</Strong>{" "}
        → bấm <Code>+ Thêm</Code>. Điền thông tin vợ/chồng, lưu. App tự tạo{" "}
        Family Unit nối 2 người.
      </P>
      <P>
        Người đã có 1 vợ rồi, lấy vợ kế: vẫn bấm <Code>+ Thêm</Code> lần nữa
        — Family Unit thứ 2 được tạo. Con của vợ thứ 2 thêm vào Family Unit
        đó, không lẫn với Family Unit đầu.
      </P>

      <H2>Thêm con</H2>
      <P>
        Cùng trang, mục <Strong>Quan hệ → Con cái</Strong> → <Code>+ Thêm</Code>.
        Nếu người có nhiều vợ/chồng, app sẽ hỏi con thuộc Family Unit nào.
      </P>
      <Callout kind="tip" title="Mẹo điền nhanh">
        Khi nhập Thuỷ tổ và đời thứ 2-3, thuận hơn là vào trang chi tiết{" "}
        <Strong>cha</Strong> rồi bấm "Thêm con" — đời tự kế thừa. Tránh
        thêm từng người rời rạc rồi mới nối quan hệ sau.
      </Callout>

      <H2>Sửa quan hệ</H2>
      <P>
        Hiện chỉ sửa qua: xoá mềm Family Unit cũ (nếu nhập sai) + tạo lại
        Family Unit đúng. Khôi phục được từ Nhật ký. Tính năng "đổi cha" 1
        click chưa có — sẽ thêm sau.
      </P>
    </>
  );
}

export function Merge() {
  return (
    <>
      <Lead>
        Nhập Excel hoặc nhiều người cùng nhập có thể tạo trùng — cùng 1 cụ
        nhưng ghi 2 lần. App có công cụ tự tìm và gộp.
      </Lead>

      <H2>Tự tìm cặp trùng</H2>
      <P>
        Vào <Code>Gộp người trùng</Code> (Drawer trái). App quét dòng họ, đưa
        ra danh sách cặp có khả năng trùng theo:
      </P>
      <UL>
        <LI>
          <Strong>Trùng tên + năm sinh</Strong> — gần chắc chắn là một người.
        </LI>
        <LI>
          <Strong>Trùng tên</Strong> (không có năm sinh) — có thể trùng, kiểm
          tra thủ công.
        </LI>
        <LI>
          <Strong>Tên gần giống</Strong> — cảnh báo cho cẩn thận (vd "Nguyễn
          Văn A" vs "Nguyên Văn A").
        </LI>
      </UL>

      <H2>Quy tắc khi gộp</H2>
      <UL>
        <LI>
          Chọn 1 người làm <Strong>Giữ lại</Strong> (bên trái), 1 làm{" "}
          <Strong>Gộp vào</Strong> (bên phải). Mọi quan hệ và sự kiện của
          người bên phải sẽ trỏ về người bên trái.
        </LI>
        <LI>
          Trường còn trống bên Giữ lại sẽ được lấp từ bên Gộp vào. Trường có
          giá trị ở cả hai → ưu tiên Giữ lại; sửa lại sau khi gộp nếu cần.
        </LI>
        <LI>
          Người Gộp vào bị <Strong>xoá mềm</Strong> — vẫn khôi phục được từ
          Nhật ký nếu lỡ tay.
        </LI>
      </UL>

      <Callout kind="warn" title="Chọn 'Giữ lại' đúng người">
        Nên giữ người có nhiều dữ liệu hơn (đã có ảnh, đã có tiểu sử, đã có
        nhiều con) làm <Strong>Giữ lại</Strong> để khỏi phải nhập lại nhiều
        sau khi gộp.
      </Callout>

      <H2>Kiểm tra trước khi gộp</H2>
      <P>
        Bảng <Strong>So sánh dữ liệu</Strong> hiện ra khi đã chọn cả 2 người
        — cho thấy trường nào sẽ được lấp (màu xanh), trường nào xung đột
        (đỏ). Đọc kỹ trước khi bấm <Code>Gộp</Code>.
      </P>
    </>
  );
}

// ─── Tra cứu xưng hô ─────────────────────────────────────────────

export function Kinship() {
  return (
    <>
      <Lead>
        Trang <Code>Tra cứu xưng hô</Code> trả lời câu hỏi "tôi gọi
        người đó là gì". Chọn hai người trong họ → app tính cách
        xưng hô theo phong tục Việt — anh/em ruột, chú/bác/cô/cậu/dì,
        anh em họ, ông bà nội/ngoại…
      </Lead>

      <H2>App dùng quy tắc gì</H2>
      <UL>
        <LI>
          <Strong>Trực hệ</Strong> — cha mẹ / con / ông bà nội ngoại /
          cháu / cụ / chắt. Bên <Strong>nội</Strong> nếu đi qua đường
          cha, bên <Strong>ngoại</Strong> nếu đi qua đường mẹ.
        </LI>
        <LI>
          <Strong>Anh chị em ruột</Strong> — cùng cha cùng mẹ. App
          phân biệt cả <Strong>cùng cha khác mẹ</Strong> /{" "}
          <Strong>cùng mẹ khác cha</Strong> nếu dữ liệu khớp.
        </LI>
        <LI>
          <Strong>Chú / bác / cô</Strong> (bên nội) — anh chị em ruột
          của bố. <Code>Bác</Code> = anh của bố, <Code>chú</Code> = em
          trai của bố, <Code>cô</Code> = chị/em gái của bố (gọi chung).
        </LI>
        <LI>
          <Strong>Cậu / dì</Strong> (bên ngoại) — anh chị em ruột của
          mẹ.
        </LI>
        <LI>
          <Strong>Anh em họ</Strong> — có cùng ông/bà (bên nội hoặc
          ngoại). Phân biệt anh / em theo năm sinh.
        </LI>
      </UL>

      <H2>Cần dữ liệu gì</H2>
      <P>
        App đọc bố/mẹ của mỗi người (từ trường <Code>birth_family</Code>)
        và năm sinh. Người chưa có cha/mẹ trong cây sẽ không tính
        được — vào trang <Code>Việc cần làm</Code> nhóm "Thiếu cha/mẹ"
        để bổ sung trước.
      </P>

      <Callout>
        MVP chưa hỗ trợ xưng hô qua hôn nhân (thím / mợ / dượng / dâu /
        rể) và xưng hô họ hàng xa (kỵ, sơ, anh em họ đời xa hơn). Khi
        không tính được, app trả "họ hàng xa" để không nói sai.
      </Callout>

      <H2>Mở nhanh từ trang chi tiết</H2>
      <P>
        Trên trang chi tiết một người, bấm nút <Strong>Xưng hô</Strong>{" "}
        ở góc → app mở Tra cứu xưng hô với người đó đã chọn sẵn ở ô
        thứ nhất. Chỉ cần chọn người thứ hai.
      </P>
    </>
  );
}
