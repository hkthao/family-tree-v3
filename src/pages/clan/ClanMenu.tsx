import { t } from "@lingui/core/macro";
import { useState } from "react";
import { Link } from "react-router-dom";

import { IconGrid, IconSearch, IconX } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useNavSections } from "@/hooks/useNavSections";
import { usePageTitle } from "@/hooks/usePageTitle";
import { sectionBadge } from "@/lib/navModel";
import { unaccent } from "@/lib/unaccent";

/**
 * "Tất cả tính năng" — trang hub của một dòng họ: MỌI mục menu ngoài sáu mục lõi (đã có ở menu trái và
 * thanh tab dưới), gom theo nhóm, mỗi ô một icon. Cùng kiểu với trang Quản trị nền tảng.
 *
 * Vì sao có trang này: menu trái dài ~25 mục, trên điện thoại phải cuộn dài mới thấy cuối, mục ít gặp thì
 * chẳng ai biết có. Ở đây thấy hết trong vài màn, có ô lọc (gõ không dấu cũng được), và badge việc chờ
 * của từng mục vẫn hiện.
 *
 * Thiết kế GIỐNG trang Quản trị nền tảng (AdminHub): tiêu đề nhóm + mô tả nhóm, ô có icon, nhãn đậm và một câu mô tả mờ.
 */
export default function ClanMenu() {
  const { sections } = useNavSections();
  const [q, setQ] = useState("");
  usePageTitle(t`Tất cả tính năng`);

  const needle = unaccent(q.trim());
  const groups = sections
    // Quản trị hệ thống ở menu trái, không lặp lại ở đây.
    .filter((s) => s.id !== "clan-core" && s.id !== "platform-admin")
    .map((s) => ({
      ...s,
      items: needle
        ? s.items.filter((i) => unaccent(i.label).includes(needle))
        : s.items,
    }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconGrid className="h-7 w-7" />}
        title={t`Tất cả tính năng`}
        description={t`Chọn một mục để mở.`}
      />

      <label className="relative block">
        <span className="sr-only">{t`Tìm tính năng`}</span>
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t`Tìm tính năng…`}
          className="h-11 w-full rounded-lg border bg-card pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label={t`Xoá từ khoá`}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </label>

      {groups.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t`Không có mục nào khớp.`}
        </p>
      )}

      {groups.map((s) => {
        const badge = sectionBadge(s);
        return (
          <section key={s.id} className="space-y-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                {s.label}
                {badge !== undefined && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 font-sans text-xs font-semibold text-primary-foreground">
                    {badge}
                  </span>
                )}
              </h2>
              {s.hint && (
                <p className="text-sm text-muted-foreground">{s.hint}</p>
              )}
            </div>
            {/* Giống lưới trang Quản trị nền tảng: 2 cột ở điện thoại (ô vẫn đủ to để nhắm), 3–4 ở màn rộng. */}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {s.items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="flex h-full min-h-[124px] flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
                  >
                    <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:h-6 [&_svg]:w-6">
                      {item.icon}
                      {item.badge !== undefined && (
                        <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                    </span>
                    <span className="font-medium leading-tight">{item.label}</span>
                    {item.hint && (
                      <span className="text-xs leading-snug text-muted-foreground">
                        {item.hint}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
