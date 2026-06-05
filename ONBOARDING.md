# family-tree-v3 — Onboarding (đến 2026-06-05)

Quick context cho Claude session mới (đặc biệt mobile) để tiếp tục công
việc trên dự án này.

## Tổng quan dự án

Web app SaaS đa-dòng-họ (multi-tenant) để quản lý gia phả ≤ 7000 người
mỗi dòng họ. Stack:

- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui,
  PWA. Cây gia phả dùng `family-chart` (d3-based).
- **Backend**: Supabase (Postgres + Auth + Storage + RLS) + 6 Edge
  Functions. Email transactional qua Resend (domain `thaohk.com` đã
  verify, sender `Gia phả <noreply@thaohk.com>`).
- **Prod**: `https://giapha.thaohk.com` — Docker container trên VPS
  riêng, deploy qua GitHub Actions (`.github/workflows/deploy-vps.yml`),
  SSH key auth.
- **Supabase prod project**: `rgnqwjvtyzekoiqejsqf`.
- **i18n**: tiếng Việt, mobile-first, ưu tiên người lớn tuổi (chữ to,
  nút lớn).

## 5 tính năng lớn — trạng thái

| # | Tên | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Trang "Hôm nay" + nhắc giỗ | ✅ ship | `/clans/:id/today` — 3 bucket Hôm nay / 7 ngày / 30 ngày. Cron `notify-events` đã chạy. |
| 2 | Máy tính xưng hô họ hàng | ⏳ chưa làm | Là task lớn cuối cùng. Cần LCA algorithm + bảng rules VN (bác/chú/cô/dì…) + bên nội / ngoại. |
| 3 | Đóng góp có duyệt (crowdsource) | ✅ ship (Phase 1-4) | Schema + UI + email đầy đủ. Vừa fix bug `verify_jwt`. |
| 4 | QR cá nhân | ✅ ship | `/clans/:id/people/:id` có nút "QR cá nhân"; bulk export A4 6 thẻ/trang ở `/qr-export`. |
| 5 | Đường trực hệ "Từ tôi về thuỷ tổ" | ✅ ship | `/clans/:id/my-lineage` — family-chart dọc, toggle Bên nội / Bên ngoại từng đời. |

## Edge Functions (6 cái, prod)

| Tên | `verify_jwt` | Mục đích |
|---|---|---|
| `share-view` | false | Anon viewer cho tree + single_person card |
| `admin-action` | true | Platform admin actions (suspend / delete user) |
| `notify-events` | false | Cron giỗ / sinh nhật email |
| `auth-qr` | true | QR sign-in flow |
| `submit-contribution` | false | Guest đề xuất qua share link |
| `notify-contribution` | false | Email khi có pending / đã duyệt / từ chối |

## Migrations đáng nhớ (sau base schema)

- `20260605120000_lineage_self_link.sql` — clan_members.self_person_id
  + RPC `set_my_self_person`
- `20260605130000_lineage_platform_admin.sql` — patch RPC để platform
  admin claim được trên clan không là member
- `20260605140000_contributions.sql` — bảng + RLS + RPC
  `apply_contribution` / `reject_contribution`

## Bug vừa fix (6/6/2026 22:00 GMT+7)

`submit-contribution` + `notify-contribution` deployed without
`verify_jwt = false` → gateway reject guest calls.

**Fix**: Thêm 2 entry vào `supabase/config.toml` + redeploy với
`--no-verify-jwt`. Smoke test pass:
- Guest POST submit → 200 OK với contribution id
- Manual trigger notify → email gửi qua Resend (id confirmed)

Chưa commit (đang trong session, sẽ commit config.toml change).

## Next tasks (theo thứ tự ưu tiên đề xuất)

1. **#2 Máy tính xưng hô họ hàng** — tính năng cuối từ plan ban đầu.
   - `src/lib/kinship/buildGraph.ts` + `lca.ts` + `terms.ts` (bảng
     rules VN, 30-50 test case)
   - `src/pages/clan/Kinship.tsx` — 2 person picker + kết quả
   - Hook vào trang person ("Quan hệ với tôi" widget khi user đã
     link self_person)
   - Ước lượng ~4-5 ngày
2. Test contribution flow đầy đủ trên prod UI (verify approve email,
   diff view edit_person variant)
3. Web Push notification cho PWA (Phase 2 của #1)

## Files quan trọng

- Plan tổng: `plan.md` § 26.12 — log tính năng mới
- User docs: `src/pages/docs/articles/community.tsx` — 4 article cho
  feature mới (Hôm nay, QR cá nhân, Lineage, Đóng góp)
- Contribution flow:
  - DB: `supabase/migrations/20260605140000_contributions.sql`
  - Client query: `src/lib/queries/contributions.ts`
  - UI submit: `src/components/ContributeDialog.tsx`
  - UI review: `src/pages/clan/Contributions.tsx` +
    `ContributionDetail.tsx` + `components/ContributionDiffView.tsx`
- Lineage:
  - Logic pure: `src/lib/lineage.ts` (cycle guard, per-fork override)
  - Page: `src/pages/clan/MyLineage.tsx`

## Credentials (chỉ tên — value ở Supabase secrets)

- **Resend**: API key set trong Supabase secret `RESEND_API_KEY`,
  from-address `RESEND_FROM = "Gia phả <noreply@thaohk.com>"`.
- **App base URL**: `APP_BASE_URL = https://giapha.thaohk.com` (cho
  link trong email).
- **VPS deploy**: SSH key trong GitHub secret `VPS_SSH_KEY`. Đã bỏ
  password auth, dùng ed25519 key dedicated cho CI.
- **VPS security**: fail2ban running, ufw allow 22/80/443 only,
  iptables DOCKER-USER block Redis 6379 + RabbitMQ 5672/15672 + storage
  3001 từ external.

## Lệnh hay dùng

```bash
# Test
npm test                              # 256 tests
npm run dev                           # localhost:5173

# Deploy
git push                              # tự deploy via CI test.yml
gh workflow run deploy-vps.yml --ref main   # deploy VPS thủ công

# Supabase
npm run db:reset                      # reset local
npm run seed                          # seed 50 clan / 800 person

# Secrets
supabase secrets set KEY="value" --project-ref "$SUPABASE_PROJECT_REF"
supabase functions deploy <name> --project-ref "$SUPABASE_PROJECT_REF" --no-verify-jwt
```

## Quy ước commit

Lowercase scope prefix theo Conventional Commits:
- `feat(qr): ...`, `fix(pwa): ...`, `ui(nav): ...`, `ci(deploy-vps): ...`
- Body 1-3 đoạn ngắn giải thích "why"
- Trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Không amend, luôn tạo commit mới.

## Decisions đã chốt (đừng đổi nếu không có lý do mới)

- **Đường trực hệ**: thuỷ tổ trên, "tôi" dưới (theo gia phả VN truyền
  thống); mặc định bên nội; tab "Sửa thông tin" bỏ field tiểu sử
  (dùng tab "Bổ sung tiểu sử" thay).
- **QR cá nhân**: scope `single_person`, share_links reuse nếu chưa
  revoke, default 365 ngày (in lên bia cần lâu).
- **Contribution apply**: SECURITY DEFINER RPC, atomic mutate
  persons/families + đổi status; admin có thể khôi phục qua audit_log.
- **UI consistency**: top-level pages dùng `max-w-4xl py-6 px-4
  space-y-6`. Button default size + icon `h-4 w-4 mr-1.5`. Logo "Gia
  phả" chỉ hiện mobile (lg:hidden) vì drawer đã có.
- **Email pattern**: inline HTML strings trong edge function (giống
  notify-events), KHÔNG dùng React Email.
