/**
 * Nội dung các bài hướng dẫn CÔNG KHAI trên landing (donghoviet.thaohk.com/huong-dan/*.html).
 *
 * Mục tiêu GEO/AEO: mỗi bài mở đầu bằng CÂU TRẢ LỜI TRỰC TIẾP (1–2 câu ngay dưới H1 và dưới mỗi H2), có danh sách /
 * bảng dễ trích dẫn, có FAQ thật, và nói thật về chỗ phong tục thay đổi theo vùng. Bài hữu ích độc lập với app; phần
 * giới thiệu Dòng Họ Việt chỉ là một đoạn ngắn ở cuối.
 *
 * Sửa nội dung ở đây rồi chạy `node scripts/build-landing-guides.mjs` (sinh lại HTML, sitemap, llms.txt).
 * `updated` là ngày chỉnh nội dung gần nhất (dùng cho dateModified / lastmod) — đổi khi sửa bài.
 */

export const SITE = "https://donghoviet.thaohk.com";
export const APP = "https://giapha.thaohk.com";

export const guides = [
  {
    slug: "cach-lap-gia-pha-dong-ho",
    title: "Cách lập gia phả dòng họ: hướng dẫn 7 bước cho người mới",
    short: "Cách lập gia phả dòng họ",
    description:
      "Hướng dẫn lập gia phả dòng họ từng bước: xác định thuỷ tổ, thu thập thông tin, đánh số đời, nối quan hệ, ghi ngày giỗ âm lịch, vẽ phả đồ và cập nhật cùng cả họ.",
    updated: "2026-11-15",
    minutes: 7,
    lead:
      "<strong>Để lập gia phả dòng họ, hãy bắt đầu từ những người còn sống nhớ được nhiều nhất, ghi ngược lên thuỷ tổ (vị tổ xa nhất còn biết), đánh số đời từ thuỷ tổ rồi nối từng nhánh.</strong> Làm theo 7 bước dưới đây, không cần giỏi chữ Hán hay phần mềm phức tạp; điều quan trọng là ghi đúng, ghi nguồn và cho cả họ cùng bổ sung.",
    sections: [
      {
        h2: "Bước 1. Xác định phạm vi và thuỷ tổ",
        html: `<p><strong>Thuỷ tổ là người xa nhất mà dòng họ còn biết rõ tên và con cháu, được tính là Đời 1.</strong> Hãy hỏi người cao tuổi trong họ, xem nhà thờ họ, bia mộ, sắc phong hay gia phả cũ để chốt thuỷ tổ. Nếu dòng họ lớn, nên bắt đầu từ <em>một chi</em> (nhánh) rồi nối dần, thay vì cố ghi cả họ ngay từ đầu.</p>
<p>Một dòng họ có thể có nhiều thuỷ tổ nếu nhiều chi tách lập từ lâu và chưa nối được với nhau; khi tìm thêm tư liệu thì nối lại sau.</p>`,
      },
      {
        h2: "Bước 2. Thu thập thông tin từ nhiều nguồn",
        html: `<p><strong>Nguồn tốt nhất là người sống, sổ sách cũ và hiện vật.</strong> Hãy làm theo thứ tự:</p>
<ul>
<li><strong>Ông bà, cha mẹ, cô dì chú bác:</strong> ghi âm hoặc ghi chép khi kể; hỏi về anh chị em, vợ chồng, con cái, nơi sinh, nơi an táng.</li>
<li><strong>Sổ gia phả, gia phả chép tay, tộc phả:</strong> chụp ảnh từng trang, nếu là chữ Hán thì nhờ người biết dịch.</li>
<li><strong>Bia mộ, nhà thờ họ, bài vị:</strong> ghi họ tên, năm sinh, năm mất, ngày giỗ (thường theo âm lịch).</li>
<li><strong>Giấy tờ:</strong> giấy khai sinh, giấy chứng tử, sổ hộ khẩu cũ để đối chiếu năm.</li>
</ul>`,
      },
      {
        h2: "Bước 3. Ghi thông tin mỗi người theo một khuôn mẫu",
        html: `<p><strong>Mỗi người nên có cùng một bộ thông tin tối thiểu</strong> để sau này dễ tìm và đối chiếu:</p>
<ul>
<li>Họ và tên (kèm tên thường gọi nếu khác), giới tính</li>
<li>Năm sinh và năm mất (ghi rõ là dương hay âm lịch); với người đã mất, nên có <strong>ngày giỗ theo âm lịch</strong></li>
<li>Cha, mẹ; vợ hoặc chồng (người có nhiều vợ chồng thì ghi thứ tự); các con</li>
<li>Nơi sinh, quê quán, nơi an táng</li>
<li>Ghi chú: nghề nghiệp, công trạng, tên tự, tên huý, tên thuỵ nếu có</li>
</ul>`,
      },
      {
        h2: "Bước 4. Đánh số đời",
        html: `<p><strong>Thuỷ tổ là Đời 1, con của thuỷ tổ là Đời 2, cứ thế xuống.</strong> Dâu và rể (người cưới vào dòng họ) không mang dòng máu của họ nên không tính đời riêng mà theo đời của người vợ hoặc chồng. Một số dòng họ quen coi thuỷ tổ là Đời 0; chỉ cần thống nhất một cách cho toàn bộ gia phả.</p>`,
      },
      {
        h2: "Bước 5. Nối quan hệ và kiểm tra chéo",
        html: `<p><strong>Gia phả đúng khi mỗi người nối đúng cha mẹ và các năm khớp nhau.</strong> Kiểm tra nhanh:</p>
<ul>
<li>Cha mẹ phải sinh trước con ít nhất khoảng 15–18 năm.</li>
<li>Người mất trước khi con sinh (trừ trường hợp con sinh sau khi cha mất) cần ghi chú.</li>
<li>Nếu hai nguồn lệch nhau về năm hay tên, <em>ghi cả hai</em> và ghi nguồn, đừng tự sửa theo ý mình.</li>
</ul>`,
      },
      {
        h2: "Bước 6. Trình bày: phả hệ, phả đồ và sổ gia phả",
        html: `<p><strong>Có ba cách trình bày phổ biến:</strong> <em>phả hệ</em> (danh sách theo đời), <em>phả đồ</em> (sơ đồ cây các đời) và <em>sổ gia phả</em> (cuốn sách có lời nói đầu, phả ký, phả hệ, phả đồ, ngoại phả). Xem thêm <a href="/huong-dan/mau-so-gia-pha.html">mẫu sổ gia phả</a> và <a href="/huong-dan/thuat-ngu-gia-pha.html">giải nghĩa thuật ngữ gia phả</a>.</p>`,
      },
      {
        h2: "Bước 7. Cập nhật định kỳ và mời cả họ cùng làm",
        html: `<p><strong>Gia phả là tài liệu sống: có người sinh ra, có người mất, có người cưới.</strong> Nên cử một hai người giữ gia phả, rồi mời từng gia đình tự bổ sung nhánh nhà mình. Mỗi dịp giỗ chạp, họp họ là lúc tốt nhất để cập nhật.</p>`,
      },
      {
        h2: "Lập gia phả bằng phần mềm thay vì chép tay",
        html: `<p>Chép tay hay dùng Excel đều được, nhưng khó vẽ cây nhiều đời, khó nhắc ngày giỗ âm lịch và khó cho cả họ cùng sửa. <strong>Dòng Họ Việt</strong> là phần mềm gia phả tiếng Việt: thêm người theo cha mẹ, tự đánh số đời, ghi ngày giỗ âm lịch và nhắc trước, vẽ cây, xuất sổ gia phả PDF, mời cả họ qua một đường link; bắt đầu miễn phí. Xem bài <a href="/huong-dan/phan-mem-gia-pha-tieng-viet.html">cách chọn phần mềm gia phả tiếng Việt</a>.</p>`,
      },
    ],
    faq: [
      {
        q: "Lập gia phả cần những thông tin gì?",
        a: "Tối thiểu cho mỗi người: họ tên, giới tính, năm sinh, năm mất (nếu đã mất), cha mẹ, vợ hoặc chồng, con. Nên ghi thêm ngày giỗ theo âm lịch, nơi sinh, nơi an táng và nguồn của thông tin.",
      },
      {
        q: "Nên ghi được bao nhiêu đời?",
        a: "Ghi được bao nhiêu thì ghi bấy nhiêu, miễn đúng. Nhiều dòng họ chỉ chắc chắn từ 4–6 đời; phần xa hơn nên ghi riêng là 'chưa xác minh' thay vì đoán.",
      },
      {
        q: "Ghi ngày giỗ theo âm lịch hay dương lịch?",
        a: "Ngày giỗ truyền thống tính theo âm lịch và lặp lại mỗi năm vào cùng ngày tháng âm. Nên ghi ngày mất theo âm lịch (kèm dương lịch nếu có) để nhớ giỗ đúng; xem bài hướng dẫn tính ngày giỗ.",
      },
      {
        q: "Người chưa rõ thông tin thì ghi thế nào?",
        a: "Vẫn tạo người đó với thông tin đang có và để trống phần chưa biết, ghi chú 'chưa rõ'. Khi có thêm tư liệu thì bổ sung sau; đừng bỏ người ra khỏi gia phả chỉ vì thiếu năm sinh.",
      },
      {
        q: "Có cần biết chữ Hán để lập gia phả không?",
        a: "Không bắt buộc. Nếu có gia phả cũ bằng chữ Hán thì nhờ người biết dịch rồi ghi bản dịch kèm nguồn; phần còn lại có thể làm hoàn toàn bằng tiếng Việt.",
      },
    ],
    related: ["cach-tinh-ngay-gio-am-lich", "thuat-ngu-gia-pha", "mau-so-gia-pha"],
  },

  {
    slug: "cach-tinh-ngay-gio-am-lich",
    title: "Cách tính ngày giỗ theo âm lịch: giỗ đầu, giỗ hết, tháng nhuận",
    short: "Cách tính ngày giỗ âm lịch",
    description:
      "Cách tính ngày giỗ theo âm lịch: giỗ đầu, giỗ hết, mãn tang, xử lý tháng nhuận và tháng thiếu ngày 30, đổi ngày mất dương lịch sang âm lịch và cách nhớ giỗ cho cả dòng họ.",
    updated: "2026-11-15",
    minutes: 6,
    lead:
      "<strong>Ngày giỗ là ngày mất theo âm lịch, lặp lại mỗi năm vào đúng ngày và tháng âm đó.</strong> Nếu chỉ biết ngày mất theo dương lịch, hãy đổi sang âm lịch một lần rồi dùng ngày âm ấy cho mọi năm sau. Giỗ đầu tính khi tròn một năm kể từ ngày mất, giỗ hết khi tròn hai năm; các mốc cụ thể có khác nhau đôi chút theo vùng và gia đình.",
    sections: [
      {
        h2: "Các mốc giỗ sau khi mất",
        html: `<p><strong>Theo cách gọi phổ biến, sau ngày mất có các mốc:</strong> cúng 49 ngày và 100 ngày, <em>giỗ đầu</em> (tiểu tường) khi tròn một năm, <em>giỗ hết</em> (đại tường) khi tròn hai năm, rồi lễ mãn tang (đạm tế). Sau đó mỗi năm giỗ vào đúng ngày mất âm lịch.</p>
<p>Nhiều gia đình tính các mốc này theo tháng (khoảng 13, 25 và 27 tháng) thay vì theo năm tròn. Cách làm khác nhau theo vùng, nên hãy hỏi người lớn tuổi trong họ và chọn một cách thống nhất cho cả dòng họ.</p>`,
      },
      {
        h2: "Đổi ngày mất dương lịch sang âm lịch",
        html: `<p><strong>Đổi một lần bằng lịch vạn niên hoặc công cụ đổi ngày, rồi ghi lại ngày tháng âm.</strong> Ví dụ: một người mất ngày 14 tháng 11 dương lịch năm 2026, ngày đó là mùng 6 tháng 10 âm lịch; vậy ngày giỗ hằng năm của người này là mùng 6 tháng 10 âm lịch, không phải ngày 14/11 dương. Ngày dương lịch của giỗ thay đổi mỗi năm vì âm lịch và dương lịch lệch nhau.</p>`,
      },
      {
        h2: "Khi tháng đó là tháng nhuận",
        html: `<p><strong>Thông lệ phổ biến là cúng giỗ ở tháng thường, không cúng thêm ở tháng nhuận.</strong> Nếu người mất vào tháng nhuận thì có nơi cúng ở tháng thường cùng số, có nơi cúng vào lần tháng nhuận khi nó xuất hiện lại; hãy theo tập quán của dòng họ và ghi rõ trong gia phả để các đời sau không lúng túng.</p>`,
      },
      {
        h2: "Khi ngày mất là ngày 30 mà năm sau tháng đó chỉ có 29 ngày",
        html: `<p><strong>Lịch âm có tháng đủ (30 ngày) và tháng thiếu (29 ngày).</strong> Nếu ngày mất là 30 mà năm nay tháng đó thiếu, thường cúng vào ngày 29 (ngày cuối tháng). Đây là điểm dễ nhầm nhất khi tự tra lịch, nên các phần mềm nhắc giỗ cần xử lý sẵn.</p>`,
      },
      {
        h2: "Chuẩn bị và thời điểm cúng",
        html: `<p><strong>Giỗ chính được cúng vào ngày mất âm lịch.</strong> Nhiều nơi làm lễ vào chiều hôm trước (thường gọi là cúng tiên thường) rồi lễ chính ngày giỗ; con cháu ở xa có thể về sớm hơn. Điều quan trọng là cả họ cùng biết đúng ngày, nên hãy ghi giỗ của từng người vào gia phả và đặt nhắc trước một tuần.</p>`,
      },
      {
        h2: "Nhớ giỗ cho cả dòng họ bằng phần mềm",
        html: `<p>Trong <strong>Dòng Họ Việt</strong>, bạn nhập ngày mất (dương hoặc âm lịch); app tự tính ngày giỗ hằng năm, xử lý tháng nhuận và tháng thiếu, rồi nhắc qua thông báo và email cho thành viên đã đăng ký, kể cả xuất lịch sang Google hoặc Apple Calendar. Xem thêm <a href="/huong-dan/cach-lap-gia-pha-dong-ho.html">cách lập gia phả dòng họ</a>.</p>`,
      },
    ],
    faq: [
      {
        q: "Giỗ đầu là sau bao lâu?",
        a: "Giỗ đầu (tiểu tường) thường tính khi tròn một năm kể từ ngày mất; một số nơi tính theo tháng (khoảng 13 tháng). Giỗ hết (đại tường) tròn hai năm hoặc khoảng 25 tháng. Hãy theo tập quán của dòng họ.",
      },
      {
        q: "Ngày giỗ tính theo dương lịch hay âm lịch?",
        a: "Theo âm lịch: ngày giỗ là ngày mất âm lịch lặp lại hằng năm. Ngày dương lịch tương ứng của giỗ thay đổi mỗi năm.",
      },
      {
        q: "Người mất vào tháng nhuận thì cúng giỗ khi nào?",
        a: "Phổ biến là cúng ở tháng thường cùng số tháng; một số gia đình cúng thêm khi tháng nhuận đó trở lại. Nên thống nhất trong dòng họ và ghi vào gia phả.",
      },
      {
        q: "Ngày mất là 30 âm lịch, năm sau tháng đó chỉ có 29 ngày thì cúng ngày nào?",
        a: "Thường cúng vào ngày 29, tức ngày cuối của tháng thiếu.",
      },
      {
        q: "Không biết ngày mất âm lịch thì làm sao?",
        a: "Nếu biết ngày mất dương lịch, hãy đổi sang âm lịch bằng lịch vạn niên rồi dùng ngày âm đó. Nếu chỉ nhớ năm mất, hãy hỏi người lớn tuổi hoặc xem bia mộ, bài vị để tìm ngày giỗ đang được cúng.",
      },
    ],
    related: ["cach-lap-gia-pha-dong-ho", "chap-ho-tao-mo-gio-to", "thuat-ngu-gia-pha"],
  },

  {
    slug: "cach-xung-ho-ho-hang",
    title: "Cách xưng hô họ hàng trong gia đình Việt: bác, chú, cô, cậu, dì",
    short: "Cách xưng hô họ hàng",
    description:
      "Bảng cách xưng hô họ hàng của người Việt: bác, chú, cô, cậu, dì, thím, mợ, dượng, anh chị em họ, và các đời trên dưới như ông bà, cụ, kỵ, cháu, chắt, chít; khác biệt giữa miền Bắc, Trung, Nam.",
    updated: "2026-11-15",
    minutes: 6,
    lead:
      "<strong>Xưng hô họ hàng người Việt phụ thuộc vào ba điều: bên nội hay bên ngoại, người đó hơn hay kém tuổi so với cha mẹ mình, và là nam hay nữ.</strong> Anh chị của cha là bác, em trai của cha là chú, em gái của cha là cô; anh trai hoặc em trai của mẹ là cậu, chị hoặc em gái của mẹ là dì. Cách gọi có khác nhau theo vùng, nhất là với anh chị của mẹ.",
    sections: [
      {
        h2: "Bảng xưng hô bên cha (bên nội)",
        html: `<table>
<thead><tr><th>Người đó là</th><th>Gọi là</th></tr></thead>
<tbody>
<tr><td>Cha của cha / mẹ của cha</td><td>Ông nội / bà nội</td></tr>
<tr><td>Anh trai hoặc chị gái của cha</td><td>Bác</td></tr>
<tr><td>Em trai của cha</td><td>Chú</td></tr>
<tr><td>Em gái của cha</td><td>Cô</td></tr>
<tr><td>Vợ của chú</td><td>Thím</td></tr>
<tr><td>Chồng của cô</td><td>Dượng (hoặc chú, tuỳ vùng)</td></tr>
<tr><td>Con của bác, chú, cô</td><td>Anh, chị, em họ</td></tr>
</tbody></table>`,
      },
      {
        h2: "Bảng xưng hô bên mẹ (bên ngoại)",
        html: `<table>
<thead><tr><th>Người đó là</th><th>Gọi là</th></tr></thead>
<tbody>
<tr><td>Cha của mẹ / mẹ của mẹ</td><td>Ông ngoại / bà ngoại</td></tr>
<tr><td>Anh trai hoặc em trai của mẹ</td><td>Cậu (ở nhiều nơi miền Bắc, anh trai của mẹ cũng gọi là bác)</td></tr>
<tr><td>Chị gái của mẹ</td><td>Dì (ở nhiều nơi miền Bắc gọi là bác)</td></tr>
<tr><td>Em gái của mẹ</td><td>Dì</td></tr>
<tr><td>Vợ của cậu</td><td>Mợ</td></tr>
<tr><td>Chồng của dì</td><td>Dượng (hoặc chú, tuỳ vùng)</td></tr>
<tr><td>Con của cậu, dì</td><td>Anh, chị, em họ</td></tr>
</tbody></table>
<p>Cách gọi các anh chị của mẹ <em>khác nhau giữa các miền và các gia đình</em>; hãy theo cách mà gia đình mình quen dùng và dùng nhất quán.</p>`,
      },
      {
        h2: "Các đời trên và dưới",
        html: `<p><strong>Tính từ mình lên trên: cha mẹ, ông bà, cụ, kỵ; tính xuống dưới: con, cháu, chắt, chít.</strong></p>
<ul>
<li>Ông bà của cha mẹ mình: <strong>cụ</strong> (cụ ông, cụ bà)</li>
<li>Cha mẹ của cụ: <strong>kỵ</strong></li>
<li>Con của con: <strong>cháu</strong>; con của cháu: <strong>chắt</strong>; con của chắt: <strong>chít</strong></li>
</ul>
<p>Các đời cao hơn nữa thường gọi chung là tiên tổ hoặc ghi rõ số đời trong gia phả.</p>`,
      },
      {
        h2: "Quy tắc nhớ nhanh",
        html: `<ul>
<li><strong>Bên cha</strong> (họ nội): anh chị của cha là bác; em trai là chú; em gái là cô.</li>
<li><strong>Bên mẹ</strong> (họ ngoại): đàn ông gọi là cậu; đàn bà gọi là dì (có nơi gọi anh chị của mẹ là bác).</li>
<li>Vợ của chú là thím; vợ của cậu là mợ; chồng của cô hoặc dì là dượng (hoặc chú).</li>
<li>Con của anh chị em cha mẹ là anh chị em họ; ai lớn tuổi hơn thì mình gọi là anh chị.</li>
</ul>`,
      },
      {
        h2: "Tra cứu xưng hô tự động",
        html: `<p>Với dòng họ nhiều đời, nhớ hết các cách gọi rất khó. Trong <strong>Dòng Họ Việt</strong>, bạn chọn hai người bất kỳ trong gia phả, app tính quan hệ và cách xưng hô (bác, chú, cô, cậu, dì, anh em họ…) và cho phép chọn cách gọi theo vùng. Xem thêm <a href="/huong-dan/thuat-ngu-gia-pha.html">thuật ngữ gia phả</a>.</p>`,
      },
    ],
    faq: [
      {
        q: "Anh trai của mẹ gọi là gì?",
        a: "Phổ biến nhất là cậu. Ở nhiều nơi miền Bắc, anh trai của mẹ (lớn hơn mẹ) có thể được gọi là bác. Nên theo cách quen dùng trong gia đình.",
      },
      {
        q: "Chị gái của mẹ gọi là dì hay bác?",
        a: "Thường gọi là dì; một số vùng ở miền Bắc gọi chị gái của mẹ là bác. Cách gọi thay đổi theo gia đình và vùng miền.",
      },
      {
        q: "Con của anh chị em họ gọi là gì?",
        a: "Con của anh chị em họ thuộc đời cháu so với mình nên thường gọi là cháu (cháu họ). Cách gọi cụ thể phụ thuộc đời và tuổi.",
      },
      {
        q: "Cụ và kỵ khác nhau thế nào?",
        a: "Cụ là ông bà của cha mẹ mình (cụ ông, cụ bà); kỵ là cha mẹ của cụ, tức cao hơn một đời nữa.",
      },
      {
        q: "Chồng của cô gọi là gì?",
        a: "Thường gọi là dượng; một số vùng gọi là chú. Chồng của dì cũng gọi tương tự.",
      },
    ],
    related: ["thuat-ngu-gia-pha", "cach-lap-gia-pha-dong-ho", "cach-tinh-ngay-gio-am-lich"],
  },

  {
    slug: "phan-mem-gia-pha-tieng-viet",
    title: "Phần mềm gia phả tiếng Việt: cách chọn và những tiêu chí quan trọng",
    short: "Chọn phần mềm gia phả tiếng Việt",
    description:
      "Cách chọn phần mềm gia phả tiếng Việt cho dòng họ: 8 tiêu chí (âm lịch và ngày giỗ, xưng hô, nhiều người cùng sửa, quyền riêng tư, dễ dùng cho người lớn tuổi, xuất sổ, nhập dữ liệu) và Dòng Họ Việt đáp ứng thế nào.",
    updated: "2026-11-15",
    minutes: 6,
    lead:
      "<strong>Phần mềm gia phả tốt cho dòng họ Việt phải hiểu cách tổ chức gia phả Việt (thuỷ tổ, đời, chi), tính được ngày giỗ âm lịch và nhắc giỗ, cho nhiều người cùng bổ sung, kiểm soát quyền riêng tư và dễ dùng với người lớn tuổi.</strong> Dưới đây là 8 tiêu chí để so sánh mọi phần mềm, kèm cách Dòng Họ Việt đáp ứng từng tiêu chí.",
    sections: [
      {
        h2: "8 tiêu chí chọn phần mềm gia phả",
        html: `<ol>
<li><strong>Tiếng Việt thuần và đúng thuật ngữ.</strong> Thuỷ tổ, đời, chi, phả hệ, phả đồ, tên tự, tên huý; không phải dịch máy từ phần mềm nước ngoài.</li>
<li><strong>Âm lịch và ngày giỗ.</strong> Tự đổi ngày, xử lý tháng nhuận và tháng thiếu, nhắc giỗ trước hạn. Đây là thứ phần mềm nước ngoài thường không có.</li>
<li><strong>Xưng hô họ hàng.</strong> Tính được bác, chú, cô, cậu, dì, anh em họ giữa hai người bất kỳ.</li>
<li><strong>Nhiều người cùng sửa.</strong> Mời cả họ qua đường link, mỗi người sửa nhánh nhà mình, có phân quyền xem, sửa, quản trị và có người duyệt đóng góp.</li>
<li><strong>Quyền riêng tư.</strong> Ẩn thông tin người còn sống khi chia sẻ; chủ dòng họ quyết định ai thấy gì; có thể xuất và xoá dữ liệu.</li>
<li><strong>Dễ dùng cho người lớn tuổi.</strong> Chữ to, ít bước, có video hướng dẫn, dùng được trên điện thoại.</li>
<li><strong>Nhập, xuất dữ liệu.</strong> Nhập từ Excel hoặc GEDCOM, xuất sổ gia phả PDF, không bị khoá dữ liệu.</li>
<li><strong>Chi phí minh bạch.</strong> Bắt đầu miễn phí; nếu có tính phí thì nói rõ phần nào.</li>
</ol>`,
      },
      {
        h2: "Dòng Họ Việt đáp ứng thế nào",
        html: `<p><strong>Dòng Họ Việt là phần mềm gia phả tiếng Việt chạy trên web và điện thoại, làm riêng cho dòng họ Việt.</strong> Theo từng tiêu chí ở trên:</p>
<ul>
<li>Thuỷ tổ và số đời, chi/nhánh, tên tự – huý – thuỵ, phả hệ, phả đồ, sổ gia phả có sẵn.</li>
<li>Ngày giỗ âm lịch (kể cả tháng nhuận), nhắc giỗ và sinh nhật qua thông báo và email, xuất lịch sang Google hoặc Apple Calendar.</li>
<li>Tra cứu quan hệ và xưng hô giữa hai người trong dòng họ.</li>
<li>Mời cả họ qua một đường link; vai trò xem, sửa, quản trị; đóng góp của thành viên được quản trị duyệt.</li>
<li>Thông tin người còn sống được ẩn khi chia sẻ công khai; bạn quyết định ai xem, ai sửa.</li>
<li>Giao diện chữ to, có video hướng dẫn; dùng được trên điện thoại.</li>
<li>Nhập từ Excel và GEDCOM, xuất sổ gia phả PDF.</li>
<li>Bắt đầu miễn phí; các nhu cầu nâng cao như in sách gia phả có thể có chi phí riêng.</li>
</ul>
<p>Bạn có thể <a href="${APP}/xem/demo">xem thử gia phả mẫu</a> không cần đăng nhập trước khi quyết định.</p>`,
      },
      {
        h2: "Những lưu ý trước khi chọn bất kỳ phần mềm nào",
        html: `<ul>
<li><strong>Thử với một chi nhỏ trước</strong> (vài chục người) để xem có hợp cách làm của dòng họ không.</li>
<li><strong>Hỏi về xuất dữ liệu.</strong> Công sức nhập nhiều năm không nên bị khoá trong một ứng dụng.</li>
<li><strong>Thống nhất người giữ gia phả</strong> trong họ, rồi mới mời đông người, để tránh sửa chồng chéo.</li>
</ul>`,
      },
    ],
    faq: [
      {
        q: "Phần mềm gia phả nào có ngày giỗ âm lịch?",
        a: "Nhiều phần mềm gia phả nước ngoài không có âm lịch. Dòng Họ Việt tính ngày giỗ theo âm lịch (kể cả tháng nhuận và tháng thiếu ngày 30) và nhắc giỗ cho cả dòng họ.",
      },
      {
        q: "Phần mềm gia phả có miễn phí không?",
        a: "Dòng Họ Việt bắt đầu hoàn toàn miễn phí. Các nhu cầu nâng cao như in sách gia phả hoặc phả đồ khổ lớn có thể có chi phí riêng và được báo trước.",
      },
      {
        q: "Người lớn tuổi có dùng được không?",
        a: "Được. Giao diện chữ to, ít thao tác, tiếng Việt thuần và có video hướng dẫn từng bước; cả họ có thể cùng làm, người trẻ nhập giúp người lớn tuổi.",
      },
      {
        q: "Dữ liệu gia phả của tôi có an toàn không?",
        a: "Dữ liệu được lưu và sao lưu định kỳ trên máy chủ riêng; thông tin người còn sống bị ẩn khi chia sẻ ra ngoài, và bạn quyết định ai xem, ai sửa. Bạn có thể xuất dữ liệu bất cứ lúc nào.",
      },
      {
        q: "Có nhập được gia phả đã làm trên Excel không?",
        a: "Có. Dòng Họ Việt nhập được từ file Excel hoặc CSV theo mẫu và từ GEDCOM, kiểm tra lỗi trước khi nhập để không bị sai dữ liệu.",
      },
    ],
    related: ["cach-lap-gia-pha-dong-ho", "cach-xung-ho-ho-hang", "mau-so-gia-pha"],
  },

  {
    slug: "thuat-ngu-gia-pha",
    title: "Thuật ngữ gia phả: phả hệ, phả đồ, phả ký, thuỷ tổ, đời, chi là gì?",
    short: "Thuật ngữ gia phả",
    description:
      "Giải nghĩa ngắn gọn các thuật ngữ gia phả Việt Nam: gia phả, phả hệ, phả đồ, phả ký, ngoại phả, thuỷ tổ, đời, chi, tộc trưởng, từ đường, tên tự, tên huý, tên thuỵ, chạp họ, tảo mộ.",
    updated: "2026-11-15",
    minutes: 5,
    lead:
      "<strong>Gia phả là sổ ghi chép nguồn gốc, các đời và quan hệ huyết thống của một dòng họ.</strong> Trong đó phả hệ là danh sách các đời, phả đồ là sơ đồ cây, phả ký là phần văn xuôi kể lịch sử dòng họ, ngoại phả ghi bên mẹ và các nhánh liên quan. Dưới đây là bảng giải nghĩa các thuật ngữ thường gặp.",
    sections: [
      {
        h2: "Các thành phần của gia phả",
        html: `<dl>
<dt>Gia phả (tộc phả)</dt><dd>Sổ ghi chép nguồn gốc, các đời và quan hệ trong một dòng họ hay gia đình.</dd>
<dt>Phả hệ</dt><dd>Danh sách các thành viên xếp theo đời, ghi cha mẹ, vợ chồng, con cái.</dd>
<dt>Phả đồ</dt><dd>Sơ đồ hình cây thể hiện các đời và quan hệ, giúp nhìn nhanh cấu trúc dòng họ.</dd>
<dt>Phả ký</dt><dd>Phần văn xuôi: lịch sử dòng họ, nguồn gốc, công trạng, truyền thống.</dd>
<dt>Ngoại phả</dt><dd>Phần ghi về bên ngoại: họ của mẹ, vợ, con rể và các nhánh liên quan.</dd>
<dt>Phụ khảo</dt><dd>Tư liệu bổ sung: địa chí quê hương, bài văn tế, di chúc, hình ảnh.</dd>
</dl>`,
      },
      {
        h2: "Thuỷ tổ, đời, chi",
        html: `<dl>
<dt>Thuỷ tổ (tổ khai cơ)</dt><dd>Vị tổ xa nhất mà dòng họ còn biết rõ; thường tính là Đời 1.</dd>
<dt>Đời (thế hệ)</dt><dd>Mỗi lớp cha, con, cháu là một đời; đánh số từ thuỷ tổ xuống.</dd>
<dt>Chi (nhánh)</dt><dd>Một nhánh con cháu của một người con của thuỷ tổ; dòng họ lớn thường chia thành nhiều chi (chi trưởng, chi thứ).</dd>
<dt>Tộc trưởng, trưởng họ</dt><dd>Người đứng đầu việc họ, thường là con cháu trưởng, lo giỗ tổ và họp họ.</dd>
<dt>Từ đường (nhà thờ họ)</dt><dd>Nơi thờ tổ tiên và tổ chức việc chung của dòng họ.</dd>
</dl>`,
      },
      {
        h2: "Tên và danh xưng",
        html: `<dl>
<dt>Tên thường gọi</dt><dd>Tên dùng hằng ngày, có thể khác tên khai sinh.</dd>
<dt>Tên tự</dt><dd>Tên đặt khi trưởng thành, dùng ở nơi trang trọng.</dd>
<dt>Tên huý</dt><dd>Tên khai sinh của người đã khuất, kiêng gọi thẳng sau khi mất.</dd>
<dt>Tên thuỵ</dt><dd>Tên đặt sau khi mất, dùng trong văn cúng.</dd>
</dl>`,
      },
      {
        h2: "Giỗ và lễ của dòng họ",
        html: `<dl>
<dt>Giỗ</dt><dd>Ngày mất theo âm lịch, con cháu cúng hằng năm. Xem <a href="/huong-dan/cach-tinh-ngay-gio-am-lich.html">cách tính ngày giỗ</a>.</dd>
<dt>Giỗ Tổ (của dòng họ)</dt><dd>Ngày giỗ chung của thuỷ tổ dòng họ; khác với Giỗ Tổ Hùng Vương mùng 10 tháng Ba âm lịch.</dd>
<dt>Chạp họ</dt><dd>Buổi họp mặt, tế lễ của cả dòng họ, thường vào cuối năm (tháng Chạp).</dd>
<dt>Tảo mộ</dt><dd>Dọn dẹp, thắp hương mộ phần tổ tiên; xem <a href="/huong-dan/chap-ho-tao-mo-gio-to.html">chạp họ, tảo mộ, giỗ Tổ</a>.</dd>
</dl>`,
      },
      {
        h2: "Dùng đúng thuật ngữ trong phần mềm",
        html: `<p>Dòng Họ Việt dùng các thuật ngữ trên một cách nhất quán: thuỷ tổ và số đời, chi, phả hệ, phả đồ, tên tự – huý – thuỵ, ngày giỗ âm lịch, mộ phần, từ đường. Xem <a href="/huong-dan/mau-so-gia-pha.html">mẫu sổ gia phả</a> để biết các phần đó nằm ở đâu trong cuốn sổ.</p>`,
      },
    ],
    faq: [
      {
        q: "Phả hệ và phả đồ khác nhau thế nào?",
        a: "Phả hệ là danh sách các đời, ghi từng người; phả đồ là sơ đồ hình cây thể hiện quan hệ các đời. Phả hệ chi tiết, phả đồ giúp nhìn tổng thể.",
      },
      {
        q: "Thuỷ tổ là đời thứ mấy?",
        a: "Thường tính là Đời 1; một số dòng họ coi là Đời 0. Quan trọng là thống nhất một cách cho toàn bộ gia phả.",
      },
      {
        q: "Chi và nhánh có giống nhau không?",
        a: "Gần giống: chi (nhánh) là một nhánh con cháu của một người con của thuỷ tổ. Dòng họ lớn chia nhiều chi, như chi trưởng và các chi thứ.",
      },
      {
        q: "Tên tự, tên huý, tên thuỵ là gì?",
        a: "Tên tự đặt khi trưởng thành; tên huý là tên khai sinh của người đã mất mà người sau kiêng gọi; tên thuỵ đặt sau khi mất, dùng trong văn cúng.",
      },
    ],
    related: ["cach-lap-gia-pha-dong-ho", "mau-so-gia-pha", "cach-xung-ho-ho-hang"],
  },

  {
    slug: "mau-so-gia-pha",
    title: "Mẫu sổ gia phả: cấu trúc và cách viết từng phần",
    short: "Mẫu sổ gia phả",
    description:
      "Mẫu sổ gia phả đầy đủ: bìa và trang đầu, lời nói đầu, phả ký, phả hệ, phả đồ, ngoại phả, phụ khảo; gợi ý cách viết từng phần và cách xuất sổ gia phả PDF.",
    updated: "2026-11-15",
    minutes: 6,
    lead:
      "<strong>Một cuốn sổ gia phả đầy đủ thường gồm: bìa và trang giới thiệu, lời nói đầu, phả ký, phả hệ, phả đồ, ngoại phả và phụ khảo.</strong> Phả hệ và phả đồ được dựng từ dữ liệu từng người; phần còn lại là văn bản do người giữ gia phả viết. Dưới đây là mục đích và cách viết gọn cho từng phần.",
    sections: [
      {
        h2: "Cấu trúc một cuốn sổ gia phả",
        html: `<ol>
<li><strong>Bìa và trang giới thiệu:</strong> tên dòng họ, nơi phát tích (nguyên quán), nhà thờ họ, năm biên soạn, người giữ gia phả, thông tin liên hệ.</li>
<li><strong>Lời nói đầu:</strong> vì sao làm gia phả, ai làm, làm thế nào, lời kêu gọi con cháu bổ sung, lời cảm ơn.</li>
<li><strong>Phả ký:</strong> lịch sử dòng họ: thuỷ tổ và tổ quán, các chi các đời, truyền thống, công trạng.</li>
<li><strong>Phả hệ:</strong> danh sách thành viên theo đời.</li>
<li><strong>Phả đồ:</strong> sơ đồ cây các đời.</li>
<li><strong>Ngoại phả:</strong> nhà thờ họ, các lễ cúng chính, ruộng hương hoả, bên ngoại và các nhánh liên quan.</li>
<li><strong>Phụ khảo:</strong> địa chí quê hương, ảnh, văn tế, tư liệu bổ sung.</li>
</ol>`,
      },
      {
        h2: "Cách viết lời nói đầu",
        html: `<p><strong>Lời nói đầu ngắn gọn trong 1–2 trang:</strong> mục đích làm gia phả, ai thực hiện và dựa trên nguồn nào, những chỗ còn thiếu và lời kêu gọi con cháu bổ sung. Giọng văn trang trọng nhưng dễ hiểu.</p>`,
      },
      {
        h2: "Cách viết phả ký",
        html: `<p><strong>Phả ký kể theo trình tự thời gian:</strong> nguồn gốc dòng họ, vị thuỷ tổ và nơi lập nghiệp, các chi các đời, truyền thống (học hành, nghề nghiệp, yêu nước), những nhân vật tiêu biểu. Ghi rõ nguồn và để riêng phần chưa xác minh.</p>`,
      },
      {
        h2: "Phả hệ và phả đồ: dựng từ dữ liệu",
        html: `<p><strong>Hai phần này không viết tay mà dựng tự động từ dữ liệu từng người</strong> (cha mẹ, vợ chồng, con). Vì vậy nhập dữ liệu chính xác là quan trọng nhất; xem <a href="/huong-dan/cach-lap-gia-pha-dong-ho.html">cách lập gia phả dòng họ</a>.</p>`,
      },
      {
        h2: "Xuất sổ gia phả bằng Dòng Họ Việt",
        html: `<p>Trong <strong>Dòng Họ Việt</strong>, bạn nhập thông tin dòng họ và viết các phần lời nói đầu, phả ký, ngoại phả, phụ khảo (có mẫu sẵn và gợi ý soạn theo mô tả); phả hệ, phả đồ, ngày giỗ và danh sách cưới gả được dựng tự động từ dữ liệu. Một nút xuất cả cuốn sổ gia phả thành file PDF để in hoặc lưu. Phần để trống thì không in.</p>`,
      },
    ],
    faq: [
      {
        q: "Sổ gia phả gồm những phần nào?",
        a: "Thường gồm bìa và trang giới thiệu, lời nói đầu, phả ký, phả hệ, phả đồ, ngoại phả và phụ khảo.",
      },
      {
        q: "Ai là người nên viết phả ký?",
        a: "Người giữ gia phả hoặc người hiểu lịch sử dòng họ, tham khảo ý kiến người lớn tuổi. Nên ghi rõ nguồn và những chỗ chưa chắc chắn.",
      },
      {
        q: "Có thể xuất sổ gia phả ra PDF không?",
        a: "Có. Dòng Họ Việt xuất cả cuốn sổ gia phả thành PDF, dựng phả hệ, phả đồ và danh sách ngày giỗ từ dữ liệu của dòng họ.",
      },
      {
        q: "Sổ gia phả nên dài bao nhiêu?",
        a: "Tuỳ số đời và số người. Quan trọng là đủ rõ ràng: lời nói đầu và phả ký gọn, phần phả hệ và phả đồ đầy đủ, phụ khảo thêm khi có tư liệu.",
      },
    ],
    related: ["thuat-ngu-gia-pha", "cach-lap-gia-pha-dong-ho", "phan-mem-gia-pha-tieng-viet"],
  },

  {
    slug: "chap-ho-tao-mo-gio-to",
    title: "Chạp họ, tảo mộ, giỗ Tổ dòng họ: ý nghĩa, thời điểm và cách tổ chức",
    short: "Chạp họ, tảo mộ, giỗ Tổ",
    description:
      "Chạp họ, tảo mộ và giỗ Tổ dòng họ là gì, thường tổ chức vào lúc nào, cần chuẩn bị gì và khác Giỗ Tổ Hùng Vương ra sao; gợi ý tổ chức để cả họ nhớ và cùng tham gia.",
    updated: "2026-11-15",
    minutes: 5,
    lead:
      "<strong>Chạp họ là buổi họp mặt, cúng lễ của cả dòng họ thường vào cuối năm (tháng Chạp); tảo mộ là dọn dẹp, thắp hương mộ phần tổ tiên; giỗ Tổ dòng họ là ngày giỗ chung của thuỷ tổ.</strong> Ngày cụ thể khác nhau theo từng dòng họ và vùng, nên điều quan trọng là thống nhất và ghi rõ trong gia phả để các đời sau tiếp tục.",
    sections: [
      {
        h2: "Chạp họ",
        html: `<p><strong>Chạp họ là dịp cả dòng họ họp mặt cuối năm</strong> (tháng Chạp âm lịch, trước Tết): cúng tổ tiên, báo cáo việc họ trong năm, ghi nhận người mới sinh, người mất, người cưới, bàn việc quỹ họ và việc chung. Nhiều họ tổ chức chạp họ ở từ đường (nhà thờ họ), tuỳ họ chọn một ngày cố định mỗi năm.</p>`,
      },
      {
        h2: "Tảo mộ",
        html: `<p><strong>Tảo mộ là việc dọn cỏ, sửa sang và thắp hương ở mộ phần tổ tiên.</strong> Thời điểm phổ biến là cuối năm (tháng Chạp, trước Tết) hoặc dịp Thanh minh (đầu tháng Ba âm lịch, khoảng đầu tháng Tư dương lịch); tuỳ vùng và dòng họ. Nên ghi lại vị trí các mộ (nghĩa trang, lô, hàng, số) và toạ độ để con cháu ở xa vẫn tìm được.</p>`,
      },
      {
        h2: "Giỗ Tổ của dòng họ và Giỗ Tổ Hùng Vương",
        html: `<p><strong>Giỗ Tổ dòng họ là ngày giỗ chung của thuỷ tổ, do dòng họ tự xác định;</strong> không phải Giỗ Tổ Hùng Vương, vốn là ngày mùng 10 tháng Ba âm lịch của cả dân tộc. Nhiều họ chọn một ngày cố định trong năm để cả họ về, nhất là khi con cháu ở xa.</p>`,
      },
      {
        h2: "Gợi ý tổ chức để cả họ nhớ và cùng tham gia",
        html: `<ul>
<li><strong>Chốt ngày từ đầu năm</strong> và báo cho cả họ qua nhóm Zalo hoặc Facebook, kèm nhắc lại một tuần và một ngày trước.</li>
<li><strong>Phân việc rõ:</strong> ai lo lễ vật, ai lo đón khách, ai ghi chép và cập nhật gia phả.</li>
<li><strong>Ghi biên bản ngắn:</strong> số người dự, quỹ họ thu chi, việc đã quyết.</li>
<li><strong>Cập nhật gia phả</strong> ngay trong buổi họp: người mới sinh, người mất, người cưới.</li>
</ul>`,
      },
      {
        h2: "Đặt lịch và nhắc bằng Dòng Họ Việt",
        html: `<p>Trong <strong>Dòng Họ Việt</strong>, bạn tạo sự kiện lặp hằng năm theo âm lịch (chạp họ, giỗ Tổ, tảo mộ); cả họ đã theo dõi sẽ được nhắc trước qua thông báo và email, và có thể xuất lịch sang Google hoặc Apple Calendar. Mộ phần ghi vị trí và chỉ đường. Xem thêm <a href="/huong-dan/cach-tinh-ngay-gio-am-lich.html">cách tính ngày giỗ âm lịch</a>.</p>`,
      },
    ],
    faq: [
      {
        q: "Chạp họ tổ chức vào ngày nào?",
        a: "Thường vào tháng Chạp âm lịch, trước Tết; ngày cụ thể do mỗi dòng họ tự chọn và giữ cố định hằng năm.",
      },
      {
        q: "Tảo mộ vào dịp nào là phổ biến?",
        a: "Cuối năm (tháng Chạp) hoặc dịp Thanh minh đầu tháng Ba âm lịch. Tuỳ vùng và dòng họ.",
      },
      {
        q: "Giỗ Tổ dòng họ có phải Giỗ Tổ Hùng Vương không?",
        a: "Không. Giỗ Tổ Hùng Vương là mùng 10 tháng Ba âm lịch của cả nước; giỗ Tổ của dòng họ là ngày giỗ thuỷ tổ riêng của họ.",
      },
      {
        q: "Làm sao để con cháu ở xa nhớ về dự?",
        a: "Chốt ngày từ đầu năm, báo qua nhóm chung, đặt nhắc tự động trước hạn và ghi sự kiện vào lịch của từng người; phần mềm gia phả có thể nhắc cả họ cùng lúc.",
      },
    ],
    related: ["cach-tinh-ngay-gio-am-lich", "thuat-ngu-gia-pha", "cach-lap-gia-pha-dong-ho"],
  },
];

/** Mô tả hub /huong-dan.html */
export const hub = {
  title: "Kiến thức gia phả: hướng dẫn lập gia phả, ngày giỗ, xưng hô họ hàng",
  description:
    "Hướng dẫn gia phả cho dòng họ Việt: cách lập gia phả, cách tính ngày giỗ âm lịch, xưng hô họ hàng, thuật ngữ gia phả, mẫu sổ gia phả, chạp họ – tảo mộ – giỗ Tổ và cách chọn phần mềm gia phả tiếng Việt.",
  lead:
    "Những bài hướng dẫn ngắn, trả lời thẳng vào câu hỏi thường gặp khi lập gia phả cho dòng họ Việt. Mỗi bài mở đầu bằng câu trả lời chính, sau đó là các bước, bảng và hỏi đáp.",
  updated: "2026-11-15",
};
