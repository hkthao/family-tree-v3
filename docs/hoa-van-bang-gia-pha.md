# Hoa văn cho bảng gia phả in — tìm ở đâu, tạo bằng AI được không

Ghi lại sau khi mổ xẻ 4 mẫu phả đồ thương mại (mẫu của Phạm Quyết). Mục đích:
biết cần ĐÚNG những mảnh hình nào, gọi tên chúng ra sao để tìm, và chỗ nào AI
làm được / chỗ nào không.

## 1. Tấm phả đồ gồm những mảnh nào

Nhìn kỹ thì mọi mẫu đều ghép từ 8 mảnh rời, không phải một bức vẽ liền:

| Mảnh | Tên gọi đúng để tìm | Ghi chú |
|---|---|---|
| Rồng chầu hai bên | **rồng vàng 3D**, **long chầu**, rồng thời Nguyễn | Luôn là MỘT con, lật gương thành đôi |
| Phượng hoàng | **phượng hoàng vàng**, loan phượng | Mẫu "long — phượng" hay đặt rồng trái, phượng phải |
| Băng tên trên đỉnh | **cuốn thư**, **hoành phi cuốn thư**, cuốn thư câu đối | Hai đầu có "đèn nến" là bộ **bát bửu / lỗ bộ** |
| Hai cột chữ dọc | **câu đối**, liễn đối, thư pháp câu đối | Chữ do mình đánh, không nằm trong ảnh |
| Viền quanh mép | **khung viền hoa văn cổ**, hoa văn hồi văn, khung Á Đông | Phải là mảnh LẶP được (tile), không phải khung cứng |
| Nền mờ giữa tấm | **hoa văn trống đồng**, mặt trống đồng Đông Sơn | Đặt mờ 5–10%, không ai được đọc ra nó |
| Chân tấm | **hoa sen**, **chim hạc**, tre trúc, mai đào | Dải ngang chạy hết bề ngang |
| Ô tên người | **thẻ bài**, **cuộn thư đỏ**, khung tên cổ | Mẫu Vũ Văn dùng ô hình cuộn giấy |

## 2. Từ khoá tìm ảnh

**Tiếng Việt** (ra nhiều file CDR/AI của dân in ấn — hợp nhất):
```
rồng vàng vector png    phượng hoàng vector    cuốn thư vector
hoa văn trống đồng vector    khung viền hoa văn cổ    bát bửu vector
hoa sen vector png    chim hạc vector    liễn đối vector
phông nền phả đồ dòng họ    background gia phả
```

**Tiếng Anh** (kho quốc tế, chất lượng đều hơn):
```
chinese dragon gold ornament png    phoenix bird gold vector
asian scroll banner frame    oriental border pattern seamless
lotus flower vector silhouette    crane bird asian ornament
chinese cloud pattern vector    vintage certificate border
```

Mẹo: thêm `png nền trong` / `transparent background` / `isolated` để khỏi phải
tự tách nền.

## 3. Tìm ở đâu

- [tailieustore.com — cuốn thư vector](https://tailieustore.com/cuon-thu-vector/), [downloadtailieu.com — rồng vector](https://downloadtailieu.com/rong-vector/), [trống đồng vector](https://downloadtailieu.com/trong-dong-vector/), [inbienquangcao.vn](https://inbienquangcao.vn/hoa-van-trong-dong-vector.html) — kho của dân in ấn Việt, file CDR/AI, đúng gu phả đồ nhất
- [Pikbest](https://vn.pikbest.com/so/vector-r%E1%BB%93ng-v%C3%A0-ph%C6%B0%E1%BB%A3ng-ho%C3%A0ng.html) — nhiều, có bản miễn phí
- Freepik / Vecteezy / Pngtree — chất lượng đều, **đọc kỹ giấy phép**
- Noun Project — hoạ tiết nét đơn, hợp làm viền

⚠️ **Bốn mẫu tham khảo là sản phẩm thương mại có đóng dấu tên tác giả.** Lấy ý
tưởng bố cục thì được; copy lại hình của họ thì không. Hoa văn cổ truyền không
ai giữ bản quyền, nhưng BẢN VẼ CỤ THỂ của một hoạ sĩ thì có.

## 4. AI tạo được không

**Được — nhưng chỉ cho phần hình, không cho phần chữ.**

| Việc | AI làm được? |
|---|---|
| Rồng, phượng, sen, hạc, mây | ✅ Tốt |
| Hoạ tiết góc, hoa văn nền | ✅ Tốt |
| Viền lặp đều quanh mép | ⚠️ Kém — AI không lặp khít, mối nối lộ ngay |
| Chữ Việt có dấu trong ảnh | ❌ Hỏng hẳn — sai dấu, sai chữ |
| Thư pháp câu đối | ❌ Đừng thử |

Nên: **AI vẽ hình, app vẽ chữ.** Đúng cách bảng gia phả đang làm — hoa văn là
đường nét, còn tên người, câu đối, nhãn đời đều do app đánh chữ thật.

### Mẫu câu lệnh cho AI

Rồng chầu:
```
Vietnamese imperial golden dragon, side profile facing right, flowing
mane and flame motifs, ornate gold leaf texture, symmetrical decorative
element, isolated on pure white background, no text, high detail,
centered, full body visible
```

Phượng hoàng:
```
Golden phoenix bird with long flowing tail feathers, traditional
Vietnamese temple art style, gold gradient, facing left, isolated on
pure white background, no text, decorative ornament
```

Hoạ tiết góc / mây:
```
Traditional Vietnamese cloud and wave ornament, corner decoration,
red and gold, flat vector style, isolated on white, no text, symmetrical
```

Luôn thêm: `isolated on pure white background`, `no text`, `no watermark`.
Nền trắng để tách nền bằng một cú bấm.

### Sau khi AI vẽ xong

1. Tách nền (remove.bg, hoặc Photoshop "Select Subject")
2. **Chuyển sang vector** nếu muốn in A0: vectorizer.ai, Illustrator Image Trace,
   hoặc `potrace`. Bảng gia phả của app nhận SVG — xem
   `scripts/convert-poster-creature.mjs`.
3. Nếu giữ ảnh raster: ít nhất **3000px** bề ngang cho một con rồng in khổ A0.
   (Ảnh nền cả tấm thì đừng dùng raster — A0 ở 300dpi là ~14.000px, file nặng vô lý.)

## 5. Việc còn thiếu ở app

Bảng gia phả hiện đã có: khung diềm, băng tên, hoạ tiết góc, cột câu đối, và 4
linh vật (2 rồng, 2 phượng) do chủ dòng họ cung cấp. So với 4 mẫu tham khảo thì
còn thiếu:

- Dải hoa sen / chim hạc chạy chân tấm
- Hoa văn trống đồng làm nền mờ
- Bộ bát bửu (đèn, nến) hai đầu băng tên
- Ô tên kiểu cuộn thư đỏ (hiện đang là ô chữ nhật bo góc)

Mỗi mảnh thêm vào chỉ cần một file SVG nền trong, chạy qua
`scripts/convert-poster-creature.mjs` là dùng được.
