import { msg } from "@lingui/core/macro";
import { lazyAs } from "@/lib/i18n/lazy";
/**
 * Mẫu văn bản cho Sổ gia phả, theo bố cục bộ gia phả hoàn chỉnh:
 * tựa (địa danh) → lời nói đầu → phả ký → ngoại phả → phụ khảo.
 * Phả hệ và phả đồ do sổ tự dựng từ dữ liệu nên không có mẫu.
 *
 * Mỗi mẫu là một bài viết trọn vẹn, đọc được ngay; người dùng chỉ thay phần
 * tên riêng, năm tháng, địa danh ghi trong `[…]` và sửa lại cho đúng với
 * dòng họ mình. `{họ}` được thay bằng tên dòng họ.
 */
export interface BookTemplate {
  id: string;
  name: string;
  hint: string;
  place_line: string;
  preface: string;
  phaky: string;
  ngoai_pha: string;
  phu_khao: string;
}

export const BOOK_TEMPLATES: BookTemplate[] = lazyAs<BookTemplate[]>([
  // ─── 1. Họ lớn, nhiều chi ───────────────────────────────────────
  {
    id: "trang-trong",
    name: msg`Họ lớn, nhiều chi – trang trọng`,
    hint: "Dòng họ đông người, chia nhiều chi phái, có nhà thờ họ.",
    place_line: "Thôn […], xã […], huyện […], tỉnh […]",
    preface: `Người xưa nói: "Nước có sử, nhà có phả". Sử chép việc nước thì phả ghi việc nhà; có phả thì con cháu biết mình từ đâu mà đến, biết ai là tổ, ai là tông, ai là bậc trên, ai là hàng dưới, để giữ lễ, giữ nghĩa, giữ tình ruột thịt qua muôn đời.

Họ {họ} chúng ta sinh cơ lập nghiệp ở đất này đã nhiều thế hệ. Cành lá ngày một sum suê, con cháu nay có người ở lại quê nhà, có người lập nghiệp khắp nơi trong nước và ở nước ngoài. Bởi vậy, việc ghi chép lại cội nguồn, thế thứ và hành trạng của các bậc tiền nhân càng trở nên cấp thiết, để cho đường về với tổ tiên không bao giờ bị đứt đoạn.

Xuất phát từ nguyện vọng chung của bà con trong họ, Hội đồng gia tộc đã quyết định biên soạn bộ gia phả này. Công việc bắt đầu từ năm […], do ông […] chủ trì cùng đại diện các chi, các phái. Ban biên soạn đã đến từng gia đình, thăm các khu mộ, đối chiếu bài vị, sổ sách, văn tự còn lưu và lắng nghe lời kể của các bậc cao niên để ghi chép cho trung thực.

Bộ gia phả gồm các phần: phả ký (lịch sử dòng họ), phả hệ (thế thứ các đời), phả đồ (sơ đồ phả hệ), ngoại phả (nhà thờ, lễ cúng, mộ phần, ngày giỗ, quan hệ cưới gả) và phụ khảo (địa chí quê hương). Do tư liệu còn hạn chế, người biên soạn khó tránh khỏi sai sót; chúng tôi trân trọng mong các thế hệ con cháu tiếp tục bổ sung, hiệu chỉnh để bộ phả ngày một đầy đủ hơn.

Về thể lệ ghi chép, cuốn phả này thống nhất như sau: số đời tính từ thuỷ tổ; năm sinh và năm mất ghi trong ngoặc theo dạng (sinh – mất); ngày giỗ ghi theo âm lịch; các con xếp theo thứ tự sinh, con của vợ cả ghi trước, con của vợ sau ghi sau, con ngoài giá thú ghi cuối kèm chú thích; người con gái được ghi đầy đủ, người con dâu, con rể được ghi kèm vợ chồng, còn con cái của con gái ghi theo dòng họ của cha các cháu. Ban biên soạn cố gắng ghi chép khách quan, trung thực, không tô vẽ, không phóng đại, những chỗ chưa rõ thì nói là chưa rõ.

Để con cháu ở xa cũng xem được, ngoài bản in, bộ phả còn được lưu bản điện tử và sẽ được cập nhật khi có thông tin mới. Xin chân thành cảm ơn các cụ cao niên, các trưởng chi, trưởng phái và toàn thể bà con đã đóng góp tư liệu, công sức và tấm lòng cho công việc chung này. Nguyện cho tổ tiên phù hộ, con cháu hiếu thảo, dòng họ trường tồn.

[…], ngày […] tháng […] năm […]
Thừa mệnh Hội đồng gia tộc họ {họ}
Trưởng họ: […]
Người biên soạn: […]`,
    phaky: `1. Ý nghĩa của gia phả

Gia phả là cuốn sử của một dòng họ. Có phả, con cháu biết rõ tổ tiên, nhớ đúng ngày giỗ, giữ đúng thứ bậc trong xưng hô, tránh việc kết hôn trong phạm vi họ hàng gần và có chỗ để tự hào, noi theo truyền thống cha ông. Với họ {họ}, bộ phả này là sợi dây nối các chi, các phái, nối người ở quê với người đi xa.

2. Tổ phụ và tổ quán

Theo lời truyền lại và các ghi chép còn giữ được, thuỷ tổ họ {họ} là cụ […] (thuỷ tổ khảo), sinh khoảng năm […], vốn người […]. Vào khoảng năm […], vì [loạn lạc / thiếu đất canh tác / theo việc quan], cụ cùng gia quyến đến vùng đất […] khai khẩn, lập ấp, dựng nhà, từ đó sinh con đẻ cháu nối dõi. Cụ bà (thuỷ tổ tỷ) là […], người […], tính tình hiền hậu, tảo tần, được con cháu đời đời kính nhớ. Về các đời trước thuỷ tổ, vì không có tài liệu xác thực nên phả không ghi, để tránh nhận nhầm tổ tiên và tránh kéo dài những chuyện xa xôi không liên quan đến quê hương hiện tại.

Vùng đất tổ tiên chọn làm nơi lập nghiệp nằm ở […], phía đông giáp […], phía tây giáp […], phía nam giáp […], phía bắc giáp […]. Nơi đây có sông […] chảy qua, đồng ruộng phì nhiêu, đường đi lại thuận tiện; có chợ […], đình […], chùa […]. Cùng sinh sống trên mảnh đất này còn có các dòng họ […], hai bên gắn bó, thông gia, giúp đỡ nhau qua nhiều thế hệ. Nhà thờ họ và khu mộ tổ nằm ở […]. (Có thể kèm bản đồ xóm ấp vẽ tay hoặc lấy từ bản đồ trực tuyến.)

3. Sự phát triển của dòng họ

Từ cụ thuỷ tổ, họ {họ} sinh ra các chi, các phái. Đến nay dòng họ đã trải qua […] đời, gồm […] chi: […]. Tổng số con cháu được ghi trong phả là […] người, trong đó nam […], nữ […]. Con cháu đã kết thông gia với nhiều dòng họ trong vùng và ngoài vùng, làm cho tình nghĩa xóm làng ngày thêm rộng.

4. Truyền thống của dòng họ

Về lao động, sản xuất: các đời trong họ chủ yếu làm nông, cần cù bám đất, giữ làng; một số người làm nghề thủ công, buôn bán nhỏ, rồi dần có người làm thầy giáo, thầy thuốc, cán bộ, công nhân, doanh nhân. Cuộc sống nhiều thời kỳ còn khó khăn nhưng anh em trong họ luôn đùm bọc, chia nhau từng bát gạo, từng mảnh ruộng.

Về văn hoá, tín ngưỡng: dòng họ giữ nếp thờ cúng tổ tiên, lo việc giỗ chạp, tu bổ nhà thờ và mồ mả theo tinh thần "uống nước nhớ nguồn". Con cháu được dạy cho biết kính trên nhường dưới, giữ gia phong, giữ chữ hiếu.

Về học tập: nhiều thế hệ coi trọng việc học, trong họ có […] người học đến đại học trở lên, […] người làm nghề dạy học.

Về truyền thống yêu nước: trong các cuộc kháng chiến, nhiều con cháu họ {họ} đã lên đường nhập ngũ, tham gia cách mạng; có […] người đã hy sinh, […] người được tặng thưởng huân, huy chương và danh hiệu cao quý; nhiều gia đình có mẹ được phong tặng danh hiệu Bà mẹ Việt Nam anh hùng […].

5. Gia đình và dòng họ trong đời sống

Gia đình, dòng họ là nơi sinh ra và nuôi dưỡng các thế hệ nối tiếp nhau. Về kinh tế, mỗi gia đình tự lo cuộc sống, anh em trong họ giúp nhau khi hoạn nạn. Về giáo dục, ông bà, cha mẹ dạy con cháu chủ yếu bằng chính tấm gương của mình: cách ăn ở, cách làm ăn, cách đối xử với người trên kẻ dưới. Về tinh thần, dòng họ là chỗ dựa tình cảm, nơi con cháu tìm thấy sự sẻ chia sau những nhọc nhằn lao động và mất mát chiến tranh, trong đó vai trò của người mẹ, người bà rất lớn.

6. Đặc điểm và phương hướng

Họ {họ} có đặc điểm là cần cù, thật thà, trọng nghĩa, biết đoàn kết trong khó khăn. Bên cạnh những mặt tốt đẹp ấy, dòng họ cũng còn những hạn chế như con cháu đi làm ăn xa chưa thường xuyên về thăm quê, việc liên lạc giữa các chi còn lỏng lẻo; chúng ta thẳng thắn nhìn nhận để cùng khắc phục.

Phương hướng sắp tới: tiếp tục xây dựng dòng họ văn hoá, gia đình hạnh phúc; giữ gìn và tu bổ nhà thờ, khu mộ tổ; duy trì quỹ khuyến học, khuyến tài; mỗi năm tổ chức họp họ, giỗ tổ để con cháu có dịp gặp gỡ; cập nhật gia phả thường xuyên để không ai bị bỏ sót.`,
    ngoai_pha: `1. Nhà thờ họ

Nhà thờ họ {họ} toạ lạc tại […], xây dựng năm […], được trùng tu vào các năm […]. Nhà thờ gồm […] gian, bên trong đặt bàn thờ thuỷ tổ, bài vị các cụ và các đồ thờ truyền lại. Việc hương khói do ông […] (trưởng họ) cùng ông […] (thủ từ) đảm nhiệm. Mọi người con trong họ khi về quê đều có bổn phận thắp hương nhà thờ trước khi về nhà.

2. Hội đồng gia tộc

Hội đồng gia tộc gồm trưởng họ, các trưởng chi, trưởng phái, đại diện thanh niên và phụ nữ, do toàn họ bầu theo nhiệm kỳ […] năm. Hội đồng chịu trách nhiệm điều hành việc họ, giữ quỹ, tổ chức giỗ tổ, giải quyết các việc chung và giữ gìn tài liệu gia phả. Danh sách Hội đồng hiện nay: […].

3. Các lễ cúng chính và văn khấn

Trong năm, họ có các kỳ lễ lớn: giỗ tổ vào ngày […] âm lịch; lễ Tết Nguyên đán; rằm tháng Giêng; tiết Thanh minh (tảo mộ); rằm tháng Bảy; Tết Trùng cửu. Các kỳ lễ đều do trưởng họ làm chủ lễ, con cháu các chi về dâng hương, đóng góp theo khả năng. Trước khi cúng, trưởng họ đọc văn khấn báo cáo với tổ tiên về việc họ trong năm, cầu mong tổ tiên phù hộ con cháu bình yên, làm ăn thuận lợi, học hành tiến bộ.

4. Ruộng hương hỏa và quỹ họ

Xưa, họ có […] sào ruộng hương hỏa giao cho […] canh tác, hoa lợi dùng vào việc cúng giỗ. Nay quỹ họ do con cháu đóng góp tự nguyện, giao thủ quỹ quản lý, công khai thu chi mỗi kỳ họp họ.

5. Mộ phần

Mộ thuỷ tổ và các cụ đời đầu đặt tại […]. Các chi có khu mộ riêng, ghi trong mục Mộ phần của sổ này. Mỗi dịp Thanh minh, con cháu cùng nhau phát quang, sửa sang mồ mả.

6. Người học vị và các quan hệ cưới gả

Danh sách người có học vị, người có công với quê hương đất nước và bảng quan hệ cưới gả với các dòng họ khác được tổng hợp ở các mục tiếp theo của sổ.

7. Tiểu sử nhân vật tiêu biểu

Những người có đóng góp nổi bật cho dòng họ và quê hương: cụ […] (đời […]), […, hành trạng tóm tắt]; ông […] (đời […]), […]; bà […] (đời […]), […]. Mỗi người ghi ngắn gọn họ tên, năm sinh – mất, quê quán, quá trình học tập, công tác và những việc đáng nhớ.`,
    phu_khao: `1. Địa chí quê hương

Quê hương họ {họ} là vùng […], thuộc […]. Xưa gọi là […], đến thời […] đổi thành […], nay thuộc xã […]. Đây là vùng đất bằng phẳng, có sông […] bồi đắp phù sa, khí hậu [nóng ẩm, bốn mùa rõ rệt], cư dân sống chủ yếu bằng nghề nông, cấy lúa nước, trồng màu, kết hợp chăn nuôi và nghề phụ.

2. Đình, chùa, miếu mạo

Đình làng thờ thành hoàng […], xây dựng từ thời […], hằng năm mở hội vào ngày […]. Chùa […] là nơi sinh hoạt tín ngưỡng của bà con, được trùng tu năm […]. Ngoài ra còn có miếu […] thờ […]. Con cháu trong họ từ xưa đã tham gia đóng góp, giữ gìn các công trình này.

3. Chợ, bến, đường làng

Chợ […] họp vào các ngày […]; bến đò […] nối làng với bên kia sông; con đường liên thôn […] là lối đi quen thuộc của nhiều thế hệ.

4. Nghề truyền thống và đặc sản

Ngoài nghề nông, làng còn có nghề […], sản vật nổi tiếng là […], được nhiều nơi biết đến. Các nghề này góp phần nuôi sống nhiều gia đình trong họ.

5. Bản đồ và tư liệu

Bản đồ xóm ấp (vẽ tay hoặc lấy từ bản đồ trực tuyến), bản đồ khu mộ tổ, ảnh nhà thờ họ, câu đối, bia ký và các tài liệu khác được lưu kèm để con cháu tra cứu.`,
  },

  // ─── 2. Gia đình / chi họ nhỏ ───────────────────────────────────
  {
    id: "gian-di",
    name: msg`Gia đình / chi họ nhỏ – giản dị`,
    hint: "Phả của một chi hoặc một gia đình, vài ba đời.",
    place_line: "[Xã/phường], [huyện/quận], [tỉnh/thành phố]",
    preface: `Cuốn gia phả này ra đời từ một ý nghĩ rất giản dị: con cháu họ {họ} chúng ta rồi sẽ đi xa, sẽ lớn lên ở những nơi khác nhau, và nếu không ghi lại thì vài chục năm nữa sẽ chẳng còn ai nhớ ông bà mình tên gì, quê ở đâu, đã sống và đã vất vả ra sao.

Tôi, […], đã cố gắng ghi lại những gì mình biết: lời kể của ông bà, cha mẹ, các cô chú bác, những tấm ảnh cũ, giấy tờ còn giữ được và những điều chính mình chứng kiến. Có những chỗ trí nhớ của mọi người không giống nhau, tôi đã hỏi lại nhiều lần để chọn cách ghi đúng nhất; chỗ nào chưa chắc, tôi để trống hoặc ghi chú rõ chứ không đoán bừa.

Cuốn phả chưa thể đầy đủ. Mong các anh chị em, con cháu đọc xong thấy thiếu gì, sai gì thì cứ nói để cùng bổ sung. Mong rằng mỗi lần mở ra, các cháu biết thêm về gốc gác của mình, nhớ ngày giỗ ông bà, thương yêu nhau và giữ gìn nề nếp gia đình.

[…], ngày […] tháng […] năm […]
[…]`,
    phaky: `Gia đình họ {họ} chúng ta bắt đầu được ghi nhận từ ông […] và bà […]. Ông sinh năm […], quê ở […]; bà sinh năm […], quê ở […]. Hai ông bà nên duyên vợ chồng vào khoảng năm […] và cùng nhau xây dựng gia đình ở […].

Cuộc sống của ông bà gắn với nghề […]. Những năm tháng ấy rất vất vả: [thiếu ăn, chiến tranh, phải dời nhà nhiều lần], nhưng ông bà vẫn nuôi dạy các con nên người. Ông bà sinh được […] người con: […]. Các con lần lượt lập gia đình, mỗi người một nơi nhưng vẫn luôn nhớ về nhau.

Những việc đáng nhớ của gia đình: […]. Điều ông bà thường dặn con cháu: "Ăn ở có nhân, có nghĩa; anh em hoà thuận; làm gì cũng phải thật thà". Chính những lời dặn giản dị ấy đã trở thành nếp nhà của chúng ta.

Đến nay gia đình đã có […] đời, tính cả con cháu và dâu rể là […] người, sống ở […]. Mỗi dịp giỗ chạp, Tết nhất, anh chị em và các cháu cố gắng sum họp đông đủ, đó là niềm vui lớn nhất của ông bà nơi suối vàng.

Mong muốn của chúng tôi là con cháu biết giữ gìn tình ruột thịt, chăm lo mộ phần và việc cúng giỗ ông bà, học hành chăm chỉ, sống tử tế để không hổ thẹn với tiền nhân.`,
    ngoai_pha: `Bàn thờ gia tiên được đặt ở nhà ông/bà […], là người con [trưởng / được giao hương khói]. Quanh năm, gia đình này lo việc thắp hương ngày mồng Một, ngày Rằm và các dịp lễ Tết.

Việc cúng giỗ ông bà do […] đảm nhiệm; con cháu các nhà khác về góp một mâm cỗ hoặc góp tiền theo khả năng. Ngày giỗ ông là […] âm lịch, ngày giỗ bà là […] âm lịch. Ngoài ra, cả nhà có thói quen quây quần vào đêm giao thừa và mồng Hai Tết để chúc nhau và thăm mộ ông bà.

Mộ ông bà đặt tại […]. Mỗi năm vào dịp Thanh minh hoặc cuối năm, các con cháu cùng nhau ra thăm, dọn cỏ, thắp hương. Mộ các cụ khác trong gia đình: […] (xem thêm mục Mộ phần). Ai đi xa không về được thì nhờ người nhà thắp hương thay và gọi điện báo cho cả nhà biết.

Quan hệ thông gia: các con, cháu của gia đình đã kết hôn với các gia đình […], được ghi trong bảng cưới gả của sổ này.`,
    phu_khao: `Gia đình qua các thời kỳ đã sống ở nhiều nơi: ban đầu ở […], sau chuyển về […] vào năm […]. Ngôi nhà ông bà đã ở lâu nhất là ngôi nhà […], nay [vẫn còn / đã được xây lại]. Quanh nhà có […] cây quen thuộc, nhiều con cháu còn nhớ mùi hương của [hoa, quả] và tiếng gọi cơm chiều của bà.

Những món ăn quen thuộc của nhà: […]. Những câu chuyện hay được kể trong các buổi sum họp: […]. Một số vật kỷ niệm còn giữ lại: […]. Chúng tôi ghi lại để các thế hệ sau hiểu cuộc sống của ông bà thuở trước.`,
  },

  // ─── 3. Khoa bảng ──────────────────────────────────────────────
  {
    id: "khoa-bang",
    name: msg`Dòng họ khoa bảng, hiếu học`,
    hint: "Họ có nhiều người đỗ đạt, làm quan hoặc theo nghiệp giáo dục.",
    place_line: "Thôn […], xã […], huyện […], tỉnh […]",
    preface: `Họ {họ} xưa nay lấy việc học làm gốc, coi chữ nghĩa là của để lại cho con cháu quý hơn ruộng vườn. Ông cha ta có câu: "Nhất sĩ nhì nông", "Phi thi bất thành nhân"; những lời ấy đã trở thành nếp nhà, thúc giục nhiều thế hệ dùi mài kinh sử, lấy học vấn làm đường tiến thân, lấy đạo lý làm gốc sống ở đời.

Gia phả này được biên soạn nhằm ghi lại thế thứ của dòng họ, đặc biệt là hành trạng của những bậc tiền nhân đỗ đạt, làm quan, dạy học, có công với quê hương đất nước, để con cháu noi gương mà học hành, tu dưỡng, không phụ công lao dày công vun đắp của tổ tiên.

Tư liệu được tập hợp từ sắc phong, bằng cấp, bia ký, văn tự, câu đối, sách vở còn giữ được tại nhà thờ họ và tại các gia đình, cùng lời kể của các bậc cao niên. Những chỗ chữ Hán, chữ Nôm khó đọc, ban biên soạn đã nhờ các nhà nghiên cứu phiên âm, dịch nghĩa. Dẫu vậy, vẫn không tránh khỏi thiếu sót; rất mong con cháu bổ sung những người đỗ đạt, thành danh đời sau để bảng vàng của họ ngày thêm dày.

[…], ngày […] tháng […] năm […]
Thừa mệnh Hội đồng gia tộc họ {họ}
Ban biên soạn`,
    phaky: `1. Phát tích và tổ quán

Họ {họ} định cư tại […] từ khoảng năm […]. Vị tổ khai khoa là cụ […], sinh năm […], thuở nhỏ nổi tiếng thông minh, chăm học. Năm […], cụ đỗ […] khoa […], sau được bổ làm […], nổi tiếng thanh liêm, gần dân. Lúc cáo quan về quê, cụ mở lớp dạy học, nhiều học trò trong vùng thành đạt. Cụ bà là […], nổi tiếng đảm đang, giữ vững nếp nhà để cụ yên tâm theo đuổi việc học và việc nước.

2. Truyền thống khoa bảng

Từ cụ tổ khai khoa, qua các đời, họ {họ} có […] vị đỗ đại khoa, […] vị đỗ cử nhân, […] vị đỗ tú tài; thời hiện đại có […] người đạt học vị tiến sĩ, […] thạc sĩ, […] nhà giáo, nhà nghiên cứu, bác sĩ, kỹ sư. Nhiều người giữ trọng trách trong bộ máy nhà nước và các cơ quan khoa học, giáo dục. Danh sách chi tiết ghi ở phần ngoại phả và Bảng vàng.

3. Gia phong

Gia phong họ {họ} có mấy điều cốt lõi: trọng chữ nghĩa, trọng đạo làm người; học để làm người trước, làm quan sau; làm quan phải thanh liêm, làm dân phải thật thà; con cháu hơn người thì không kiêu, kém người thì không nản. Mỗi gia đình trong họ đều cố gắng cho con em học hành đến nơi đến chốn, dù hoàn cảnh khó khăn đến đâu.

4. Quỹ khuyến học

Để nối tiếp truyền thống, họ lập quỹ khuyến học từ năm […], do con cháu thành đạt đóng góp, dùng để thưởng các cháu đạt thành tích học tập giỏi, hỗ trợ các cháu có hoàn cảnh khó khăn. Mỗi dịp giỗ tổ, họ tổ chức tuyên dương và trao thưởng cho các cháu.

5. Đặc điểm và phương hướng

Dòng họ có đặc điểm nổi bật là hiếu học và biết đùm bọc nhau để cùng đi lên; đồng thời cũng cần tránh tâm lý chỉ coi trọng bằng cấp mà xem nhẹ việc rèn đức. Phương hướng sắp tới: duy trì và mở rộng quỹ khuyến học, lưu giữ sắc phong, hiện vật của tiền nhân, tuyên dương con cháu đỗ đạt hằng năm, xây dựng dòng họ văn hoá, hiếu học.`,
    ngoai_pha: `1. Nhà thờ họ

Nhà thờ họ {họ} toạ lạc tại […], nơi lưu giữ các sắc phong, bằng khen, câu đối và bài vị các bậc tiền nhân đỗ đạt. Các hiện vật quan trọng gồm: […]. Việc trông coi, hương khói do ông […] đảm nhiệm.

2. Các lễ cúng chính và văn khấn

Hằng năm, họ tổ chức giỗ tổ vào ngày […] âm lịch, kết hợp tuyên dương con cháu đỗ đạt và khen thưởng học sinh giỏi. Lễ cúng gồm dâng hương, đọc văn khấn do trưởng họ đảm nhiệm, báo cáo với tổ tiên các việc trong năm và cầu mong con cháu học hành tấn tới. Ngoài ra còn các dịp Tết, Thanh minh, rằm tháng Bảy.

3. Danh sách người có học vị

Người đỗ đạt, có học vị và thành tích học tập nổi bật của dòng họ được ghi trong Bảng vàng của sổ này, gồm họ tên, học vị, năm đạt được và nơi công tác. Con cháu đạt học vị mới xin báo cho trưởng họ để được ghi bổ sung.

4. Mộ phần

Mộ các bậc đỗ đạt đặt tại […], đã được tu bổ năm […]; nhiều bia còn khắc rõ chức tước và hành trạng. Mộ các chi khác ghi trong mục Mộ phần.

5. Quan hệ cưới gả

Dòng họ có nhiều đời kết thông gia với các gia đình hiếu học trong vùng như […]. Các quan hệ này được tổng hợp trong bảng cưới gả.`,
    phu_khao: `Quê hương họ {họ} từ lâu được biết đến là vùng đất hiếu học. Ở đây có văn chỉ thờ […], xây dựng năm […], nơi các bậc khoa bảng trong làng, trong tổng làm lễ vào các dịp xuân thu nhị kỳ. Trường học xưa của làng do cụ […] mở, nhiều học trò sau này đỗ đạt, làm quan.

Các dòng họ khoa bảng cùng địa phương gồm: […]. Nhiều gia đình có truyền thống thông gia, trao đổi sách vở, cùng lập quỹ khuyến học chung. Những địa danh gắn với việc học: giếng […], cánh đồng […], bến […], nơi các nho sinh ngày xưa thường ngồi đọc sách.

Địa chí, đình, chùa, chợ búa và nghề truyền thống của làng được ghi tóm tắt: […].`,
  },

  // ─── 4. Làng nghề ──────────────────────────────────────────────
  {
    id: "lang-nghe",
    name: msg`Dòng họ làng nghề / nghề truyền thống`,
    hint: "Họ gắn với một nghề gia truyền (gốm, dệt, rèn, đúc…).",
    place_line: "Làng […], xã […], huyện […], tỉnh […]",
    preface: `Họ {họ} sống bằng nghề […] từ nhiều đời nay. Cha truyền con nối, tay nghề được trao lại từ đôi tay già nua sang đôi tay trẻ, như một dòng chảy không đứt đoạn. Nghề không chỉ nuôi sống con cháu mà còn là niềm tự hào, là linh hồn của dòng họ và của cả làng.

Cuốn gia phả này vì vậy ghi hai điều song song: thế thứ của dòng họ và câu chuyện của nghề. Chúng tôi muốn con cháu biết ông tổ nghề là ai, nghề ra đời thế nào, những người thợ giỏi qua từng đời đã để lại điều gì, để nghề không bị mai một giữa thời đổi thay.

Ban biên soạn đã đến thăm các cơ sở làm nghề, ghi chép lời kể của các nghệ nhân cao tuổi, sưu tầm dụng cụ, mẫu sản phẩm và tư liệu cũ. Còn nhiều điều chưa ghi hết, rất mong con cháu đồng lòng bổ sung.

[…], ngày […] tháng […] năm […]
Ban biên soạn gia phả họ {họ}`,
    phaky: `1. Tổ họ và nguồn gốc nghề

Tổ họ {họ} là cụ […], đến làng […] vào khoảng năm […]. Theo truyền khẩu, cụ vốn là thợ giỏi nghề […], được học từ […], về sau mang nghề về quê hương và truyền dạy cho con cháu. Từ đó nghề trở thành nghề gia truyền của dòng họ, rồi lan ra cả làng. Cụ được con cháu và dân làng suy tôn là [tổ nghề / thành hoàng làng].

2. Quá trình phát triển của nghề

Thuở đầu, nghề chỉ làm theo hộ gia đình, sản phẩm dùng trong làng và bán ở chợ […]. Qua các thời kỳ, nghề lúc thịnh lúc suy: thời […] sản phẩm được nhiều nơi tìm mua; thời kỳ chiến tranh, nghề bị gián đoạn, nhiều gia đình phải đổi nghề; từ khi đổi mới, nghề dần hồi sinh, có thêm máy móc và thị trường. Hiện nay họ có […] hộ còn làm nghề, trong đó […] cơ sở sản xuất lớn.

3. Những người thợ giỏi

Các đời trong họ có nhiều người thợ nổi tiếng: cụ […] (đời […]) nổi danh với […]; ông […] (đời […]) cải tiến […] giúp sản phẩm bền đẹp hơn; bà […] giữ bí quyết […] và truyền cho con dâu, con gái. Một số người được công nhận là nghệ nhân, thợ giỏi: […].

4. Gia phong của người làm nghề

Thợ họ {họ} giữ mấy điều răn: làm nghề phải chính trực, không gian dối chất lượng; giữ chữ tín với khách hàng; học nghề phải chịu khó, không giấu nghề với con cháu nhưng không truyền cho kẻ bất nhân; sản phẩm đã làm ra phải có tên, có dấu của người làm ra nó.

5. Phương hướng

Dòng họ mong muốn giữ gìn nghề cha ông, đào tạo lớp trẻ kế tục, lưu giữ dụng cụ và sản phẩm tiêu biểu, ghi lại bí quyết nghề thành tài liệu, đồng thời mở rộng thị trường, xây dựng thương hiệu chung của làng nghề, vừa giữ cốt cách truyền thống vừa phù hợp thời đại.`,
    ngoai_pha: `1. Nhà thờ họ và đền thờ tổ nghề

Nhà thờ họ {họ} toạ lạc tại […]. Ngoài việc thờ tổ tiên, dòng họ còn thờ tổ nghề tại […], nơi lưu giữ những dụng cụ cổ, mẫu sản phẩm đầu tiên và bài vị các bậc thợ giỏi.

2. Lễ cúng tổ nghề

Hằng năm vào ngày […] âm lịch, họ tổ chức lễ cúng tổ nghề. Trước lễ, các hộ làm nghề dọn dẹp lò, xưởng, gác tạm việc sản xuất; ngày lễ có dâng hương, đọc văn khấn cầu mong nghề nghiệp phát đạt, thợ thầy bình an, sản phẩm tốt đẹp. Sau lễ, mọi người cùng ăn cỗ, chia sẻ kinh nghiệm, trao đổi về việc làm ăn.

3. Hội đồng gia tộc

Hội đồng gia tộc gồm trưởng họ và đại diện các chi, có thêm tổ trưởng nghề chịu trách nhiệm giữ gìn bí quyết, hướng dẫn thợ mới và giải quyết việc chung về nghề. Danh sách: […].

4. Mộ phần và ngày giỗ

Mộ tổ và các cụ thợ cả đặt tại […]. Ngày giỗ các cụ được ghi trong danh sách ngày giỗ ở các trang sau.

5. Quan hệ cưới gả

Dòng họ có nhiều đời thông gia với các gia đình làm nghề cùng làng, tạo nên mối liên kết bền chặt về cả nghề lẫn tình. Chi tiết xem bảng cưới gả.`,
    phu_khao: `1. Nghề truyền thống

Nghề […] của làng gồm các công đoạn chính: […]. Dụng cụ chủ yếu: […]. Nguyên liệu lấy từ […]. Sản phẩm tiêu biểu: […], có đặc điểm […] khiến người mua dễ nhận ra. Một số bí quyết được giữ trong dòng họ: […].

2. Địa chí làng nghề

Làng […] nằm ở […], xưa thuộc […], có sông […] chảy qua thuận lợi cho việc chuyên chở. Dân cư chủ yếu làm nghề, ngoài ra còn trồng trọt, chăn nuôi nhỏ.

3. Đình, miếu và chợ

Đình làng thờ […], miếu thờ tổ nghề […]. Chợ […] họp vào ngày […], là nơi tiêu thụ sản phẩm của làng từ xưa. Hội làng vào ngày […] có trình diễn nghề, thi tay nghề và rước tổ nghề.`,
  },

  // ─── 5. Có gia phả cổ ──────────────────────────────────────────
  {
    id: "dich-pha-co",
    name: msg`Có gia phả cổ (dịch từ chữ Hán)`,
    hint: "Họ còn gia phả gốc chữ Hán/Nôm, cần dịch và nối tiếp các đời sau.",
    place_line: "Thôn […], xã […], huyện […], tỉnh […]",
    preface: `Họ {họ} may mắn còn giữ được bản gia phả cổ viết bằng chữ Hán, soạn từ năm […] dưới triều […]. Bản phả ấy là di sản vô giá của dòng họ, ghi lại cội nguồn, thế thứ và công đức của các bậc tiền nhân. Tuy nhiên, nay phần lớn con cháu không còn đọc được chữ Hán, nên việc phiên âm và dịch sang quốc ngữ là điều không thể trì hoãn.

Ban biên soạn đã cùng […] phiên âm, dịch nghĩa toàn bộ bản gốc, đối chiếu với […] và hỏi ý kiến các bậc cao niên hiểu biết chữ Nho. Những chỗ chữ mờ, sai lệch hoặc nhiều cách hiểu, chúng tôi ghi chú rõ trong phần chú thích. Phần nối tiếp từ đời […] đến nay được biên soạn dựa trên lời kể, mồ mả và giấy tờ còn lưu.

Bản dịch này không thay thế bản gốc. Bản gốc xin được giữ gìn trang trọng tại […]; bản dịch chỉ nhằm giúp con cháu hiểu và gìn giữ. Mong quý vị chỉ giáo những điểm chưa chính xác. Các chỗ nghi vấn giữa bản gốc và bản dịch, chúng tôi sẵn sàng đối chiếu lại khi có thêm tư liệu.

[…], ngày […] tháng […] năm […]
Thừa mệnh Hội đồng gia tộc họ {họ}
Ban biên soạn`,
    phaky: `PHẦN MỘT – GIA PHẢ CỔ (BẢN DỊCH)

Gia phả cổ do cụ […] soạn năm […], gồm […] tờ, viết bằng chữ Hán trên giấy dó, hiện lưu tại […]. Nội dung bản gốc có thể tóm lược như sau: mở đầu là lời tựa của người soạn, nói về ý nghĩa của việc lập phả, sau đó ghi lai lịch của thuỷ tổ, nơi định cư ban đầu, rồi thế thứ các đời, chức tước, ngày sinh, ngày mất, nơi chôn cất của từng người, cuối cùng là lời dặn dò con cháu.

[Dán bản dịch nguyên văn lời tựa và phần tiểu sử các cụ đời đầu ở đây.]

Khi đối chiếu bản gốc với thực tế, ban biên soạn nhận thấy một số điểm cần lưu ý: tên một số địa danh trong phả đã thay đổi so với hiện nay (ví dụ làng […] nay là […]); một số năm tháng ghi theo niên hiệu cũ, đã được quy đổi sang dương lịch và ghi chú trong ngoặc; có vài trang bị mối mọt, đã được bổ sung theo lời kể của các cụ.

PHẦN HAI – NỐI TIẾP CÁC ĐỜI SAU

Từ đời […] trở đi, thế thứ được ghi theo lời kể của các bậc cao niên, hệ thống mồ mả, bài vị và giấy tờ còn lại. Dòng họ hiện có […] đời, chia thành các chi […]. Các chi ngày càng mở rộng, con cháu sinh sống ở nhiều nơi.

Truyền thống của dòng họ vẫn được giữ gìn: kính trọng tổ tiên, lo việc thờ cúng, chăm lo mồ mả, chú trọng học hành, sống hoà thuận với xóm giềng. Nhiều người trong họ đã trưởng thành trong lao động, học tập, chiến đấu, đóng góp cho quê hương đất nước.

Phương hướng: bảo quản bản gốc bằng cách số hoá, bổ sung đầy đủ các đời sau, đưa lên sổ gia phả điện tử để con cháu ở xa cũng xem được.`,
    ngoai_pha: `1. Bản gia phả gốc và các tài liệu cổ

Bản gia phả cổ viết chữ Hán hiện được cất giữ tại […], do ông […] chịu trách nhiệm bảo quản. Ngoài ra, dòng họ còn giữ: sắc phong […], văn bia […], địa bạ […]. Các tài liệu này đã được chụp ảnh, số hoá và lưu bản sao tại […].

2. Nhà thờ họ

Nhà thờ họ toạ lạc tại […], xây dựng từ […] và được trùng tu năm […]. Bên trong có bàn thờ thuỷ tổ, hoành phi, câu đối ghi công đức tổ tiên. Nội dung các hoành phi, câu đối đã được dịch nghĩa: […].

3. Lễ cúng và văn khấn

Hằng năm, họ giỗ tổ vào ngày […] âm lịch và cúng các dịp Tết, Thanh minh, rằm tháng Bảy. Văn khấn do trưởng họ đọc, theo bản truyền lại từ đời trước và đã được chuyển sang tiếng Việt để con cháu hiểu: […].

4. Mộ phần

Mộ thuỷ tổ và các cụ đời đầu đặt tại […]; một số ngôi mộ đã di dời hoặc thất lạc, ban biên soạn đã cố gắng tìm lại, kết quả ghi trong mục Mộ phần.

5. Quan hệ cưới gả và người học vị

Các quan hệ thông gia với các dòng họ trong vùng và danh sách người có học vị, chức tước từ gia phả cổ đến nay được tổng hợp ở các bảng tiếp theo.`,
    phu_khao: `Địa chí và địa danh

Gia phả cổ ghi nơi định cư của tổ tiên là […]. Đối chiếu với địa danh hiện nay: […] nay thuộc […]. Qua các thời kỳ, đơn vị hành chính đã đổi tên nhiều lần: thời […] gọi là […], thời […] gọi là […], từ năm […] là […].

Đình, chùa, miếu mạo

Làng có đình thờ […], chùa […], miếu […]. Theo gia phả cổ, các cụ trong họ đã có công tạo dựng và đóng góp tu bổ, được ghi trên bia: […].

Nghề truyền thống và đời sống

Dân làng chủ yếu làm nông, kết hợp nghề phụ […]. Phong tục của làng: […].`,
  },

  // ─── 6. Lập phả lần đầu ────────────────────────────────────────
  {
    id: "lap-lan-dau",
    name: msg`Lập phả lần đầu (từ ký ức, điền dã)`,
    hint: "Chưa có gia phả cổ; dựng từ lời kể, mồ mả, giấy tờ.",
    place_line: "[Thôn/xã], [huyện], [tỉnh]",
    preface: `Dòng họ {họ} chưa từng có gia phả. Qua chiến tranh, đói kém và những lần dời chuyển, giấy tờ của các cụ đã thất lạc gần hết, chỉ còn lại ký ức và lời kể truyền miệng. Nhiều đời nay, việc nhớ tổ tiên, nhớ ngày giỗ, nhớ ai là anh em họ hàng đều dựa vào trí nhớ của các cụ và lời kể truyền miệng. Năm tháng trôi qua, các cụ lần lượt ra đi, nhiều điều theo đó mà mai một. Chúng tôi nhận ra rằng nếu không ghi lại ngay bây giờ thì thế hệ sau sẽ không còn biết mình thuộc về đâu.

Từ năm […], theo sáng kiến của ông […], một nhóm anh em trong họ đã bắt tay vào việc dựng gia phả lần đầu. Chúng tôi lần lượt đến từng gia đình, ghi chép lời kể của các cụ cao niên, thăm hỏi các khu mộ, chép lại bia mộ và bài vị, thu thập giấy tờ ruộng đất, sổ hộ tịch, giấy khen và ảnh cũ. Có những cuộc phỏng vấn phải đi lại nhiều lần mới đủ thông tin.

Vì làm lần đầu, bộ phả không tránh khỏi thiếu sót. Những chỗ lời kể của mọi người khác nhau, chúng tôi đã đối chiếu và chọn cách ghi hợp lý nhất, đồng thời ghi chú rõ; những chỗ chưa biết, chúng tôi ghi là "chưa rõ" chứ không đoán. Rất mong con cháu bốn phương nếu biết thêm thông tin thì báo cho người giữ phả để cùng hoàn thiện.

Xin cảm ơn tất cả những người đã kể chuyện, chỉ mộ, cho mượn ảnh và giúp công giúp sức cho bộ phả này.

Cuốn phả ghi số đời tính từ thuỷ tổ, năm sinh – mất trong ngoặc, ngày giỗ theo âm lịch, các con xếp theo thứ tự sinh. Ngoài bản in, phả còn có bản điện tử để bà con ở xa cùng xem và góp ý.

[…], ngày […] tháng […] năm […]
Thừa mệnh bà con trong họ
Người chủ trì: […]`,
    phaky: `1. Nguồn tư liệu

Do dòng họ chưa có gia phả gốc nên bộ phả này được dựng từ các nguồn: lời kể của các cụ […] (sinh năm […]), […] và […]; hệ thống mồ mả tại […]; bài vị trên bàn thờ các gia đình; văn tự mua bán, chia ruộng đất; sổ hộ tịch và giấy tờ tuỳ thân; các tấm ảnh cũ và giấy khen, bằng khen còn giữ được.

2. Gốc gác của dòng họ

Theo lời kể truyền miệng, tổ tiên họ {họ} xưa ở […], vào khoảng năm […] thì dời đến […] sinh sống. Người xa nhất mà con cháu còn nhớ được là cụ […] và cụ bà […]. Do thiếu tài liệu, chưa thể biết rõ hơn về các đời trước đó; nếu sau này tìm thấy thêm thông tin, xin bổ sung vào bản phả.

Những chỗ lời kể chưa thống nhất: về nơi sinh của cụ […] có người nói ở […], người nói ở […]; chúng tôi ghi theo […] vì […]. Về năm mất của cụ […], ghi theo bia mộ là […], còn lời kể là […].

3. Cuộc sống qua các đời

Các đời đầu chủ yếu làm nông, sống nhờ ruộng vườn, nhiều khi thiếu đói vì thiên tai, chiến tranh. Sang đời […], một số người làm nghề […], một số đi bộ đội, đi làm xa. Từ đời […], con cháu học hành nhiều hơn, có người làm giáo viên, bác sĩ, kỹ sư, cán bộ, có người đi làm ăn xa ở […].

4. Truyền thống

Dòng họ giữ nếp thờ cúng tổ tiên, giỗ chạp đầy đủ, anh em hoà thuận, xóm giềng hoà mục. Trong các cuộc kháng chiến, có […] người con của họ tham gia, […] người đã hy sinh. Con cháu luôn nhắc nhau sống tử tế, chăm chỉ làm ăn, thương yêu đùm bọc.

5. Phương hướng

Bộ phả mới chỉ là bước đầu. Chúng tôi mong tiếp tục tìm kiếm và kết nối các nhánh còn thất lạc, bổ sung thông tin cho các đời, ghi lại ảnh và câu chuyện của từng người, và duy trì việc cập nhật gia phả hằng năm vào dịp giỗ tổ.`,
    ngoai_pha: `1. Việc thờ cúng

Dòng họ chưa có nhà thờ chung nên việc thờ cúng đặt tại nhà ông […] (trưởng chi). Ngày giỗ tổ chung do bà con thống nhất là […] âm lịch, tổ chức luân phiên tại nhà các chi. Mỗi năm có các dịp lễ chính: Tết Nguyên đán, Thanh minh, rằm tháng Bảy và giỗ tổ. Dự định của dòng họ là góp quỹ xây nhà thờ họ khi điều kiện cho phép.

2. Quỹ họ

Quỹ họ do con cháu đóng góp tự nguyện, giao ông/bà […] giữ, thu chi công khai và báo cáo trong mỗi kỳ giỗ tổ.

3. Mộ phần

Các khu mộ đã tìm thấy: […] (ghi rõ vị trí và tên người trên bia). Những ngôi mộ chưa tìm được: […]. Các ngôi mộ đã di dời hoặc cải táng: […]. Dòng họ mong bà con ai biết nơi chôn cất của các cụ thì báo lại để ghi vào sổ.

4. Danh sách ngày giỗ

Ngày giỗ của các cụ và những người đã khuất được lập thành danh sách ở các trang sau, để con cháu biết mà thắp hương, về dự đầy đủ.

5. Quan hệ cưới gả

Các mối quan hệ thông gia của dòng họ được ghi trong bảng cưới gả. Nhờ đó, con cháu biết mình có họ hàng bên ngoại với những dòng họ nào, để giữ tình thân và tránh kết hôn trong phạm vi ba đời.`,
    phu_khao: `Địa chí xóm ấp

Nơi dòng họ sinh sống hiện nay là […], thuộc xã […], huyện […]. Theo lời các cụ, vùng này xưa gọi là […], có […] hộ dân, phần lớn làm nông. Phía đông giáp […], phía tây giáp […]; có con sông/ngòi […] chảy qua, là nguồn nước tưới tiêu và đường đi lại.

Đình, miếu, chợ, bến đò

Làng có đình thờ […], miếu thờ […]. Chợ […] họp vào các buổi sáng, bến đò […] là nơi qua lại của bà con. Ngày hội làng vào […], con cháu họ {họ} thường tham gia rước kiệu và đóng góp công sức.

Các dòng họ cùng cư trú và nghề truyền thống

Cùng sinh sống ở đây còn có các họ […]. Dân làng có nghề […], là nguồn thu nhập thêm của nhiều gia đình trong họ.`,
  },
]);

export function fillTemplate(t: BookTemplate, clanName: string) {
  const ho = clanName.replace(/\s*\([^)]*\)\s*$/, "").trim() || clanName;
  const sub = (s: string) => s.split("{họ}").join(ho);
  return {
    place_line: sub(t.place_line),
    preface: sub(t.preface),
    phaky: sub(t.phaky),
    ngoai_pha: sub(t.ngoai_pha),
    phu_khao: sub(t.phu_khao),
  };
}
