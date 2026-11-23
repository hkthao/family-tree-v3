# Landing page — donghoviet.thaohk.com

Trang giới thiệu tĩnh (1 file `index.html` + `assets/`), tái sử dụng design system
"Oxblood" của app gia phả. Không cần build — serve file tĩnh trực tiếp.

## Xem thử local
```bash
cd landing && python3 -m http.server 8080
# mở http://localhost:8080
```

## Deploy

**Tự động qua CI.** Job `deploy` trong `.github/workflows/deploy-vps.yml` đẩy cả thư
mục này lên `/opt/landing` mỗi lần chạy `deploy-vps` — cùng lúc với app, dùng chung
`VPS_SSH_KEY`. Không cần rsync tay, không cần ai giữ khoá SSH trên máy cá nhân.

```bash
gh workflow run deploy-vps.yml --ref main
```

nginx trên host mount `/opt/landing` và có server block cho tên miền landing; cert
Let's Encrypt cấp qua DNS-01 (HTTP-01 bị chặn tới app host).

CTA trỏ `/xem/demo` và `/signup` của app kèm UTM theo từng vị trí — **không** trỏ root,
vì root redirect thẳng vào tường đăng nhập. Dark-mode dùng chung localStorage key
`family-tree:theme` với app để lựa chọn sáng/tối được giữ khi sang app.

## Thư viện hình ảnh
Mục `#hinh-anh` trong `index.html`. Thêm ảnh: bỏ file `.webp` vào `assets/` (nên rộng ≤ 1600px, dưới 150 KB; chuyển bằng `cwebp -q 82 anh.png -o anh.webp`),
rồi chép một dòng `<a class="gal-item" href="/assets/ten.webp" data-lightbox data-caption="Chú thích">…</a>` trong `.gal-grid`
(nhớ `width`/`height` thật và `alt`). Bấm ảnh mở xem toàn màn hình, có trước/sau, phóng to (nút, lăn chuột, nhấp đúp, chụm 2 ngón), kéo để di chuyển.
