# Landing page — donghoviet.thaohk.com

Trang giới thiệu tĩnh (1 file `index.html` + `assets/`), tái sử dụng design system
"Oxblood" của app gia phả. Không cần build — serve file tĩnh trực tiếp.

## Xem thử local
```bash
cd landing && python3 -m http.server 8080
# mở http://localhost:8080
```

## Deploy
1. Đẩy file lên host:
   ```bash
   rsync -az --delete --exclude='.DS_Store' landing/ <host>:<landing-dir>/
   ```
2. nginx container `genealogy-app-nginx-1` mount `/opt/landing:/usr/share/nginx/donghoviet:ro`
   và có server block `donghoviet.thaohk.com` (xem `deploy/` của stack genealogy-app).
3. Cấp cert Let's Encrypt qua certbot webroot (`/var/www/certbot`) sau khi DNS trỏ về host này.

CTA "Vào gia phả" trỏ `https://giapha.thaohk.com`. Dark-mode dùng chung localStorage key
`family-tree:theme` với app để lựa chọn sáng/tối được giữ khi sang app.
