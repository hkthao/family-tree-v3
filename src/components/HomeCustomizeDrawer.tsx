import { t } from "@lingui/core/macro";

import { FilterDrawer } from "@/components/FilterDrawer";
import { MAX_QUICK } from "@/components/QuickActionsCard";
import { IconChevronDown, IconChevronUp } from "@/components/icons";
import { useHomePrefs } from "@/hooks/useHomePrefs";
import { HOME_CARD_KEYS, type HomeCardKey } from "@/lib/homePrefs";
import type { QuickEntry } from "@/lib/quickCatalog";

function cardLabel(k: HomeCardKey): string {
  switch (k) {
    case "today":
      return t`Lịch hôm nay`;
    case "community":
      return t`Đóng góp mới`;
    case "nextstep":
      return t`Gợi ý bước tiếp theo`;
    case "stats":
      return t`Số liệu dòng họ`;
    case "map":
      return t`Bản đồ dòng họ`;
    case "timeline":
      return t`Dòng thời gian`;
    case "quick":
      return t`Thao tác nhanh`;
    case "profile":
      return t`Hồ sơ của tôi`;
    case "photos":
      return t`Ảnh gia đình`;
    case "completion":
      return t`Tiến độ hoàn thiện`;
    case "podcast":
      return t`Podcast hôm nay`;
    case "activity":
      return t`Hoạt động gần đây`;
  }
}

const ROW = "flex min-h-11 items-center gap-3 rounded-lg px-1";

/**
 * Ngăn kéo "Tuỳ chỉnh trang chủ": (1) ghim những ô mình hay dùng ra "Thao tác nhanh" và xếp thứ tự; (2) ẩn/hiện
 * từng thẻ ở Tổng quan. Mặc định app tự xếp theo mức dùng, nên người không đụng tới vẫn có trang chủ hợp lý;
 * "Quay về tự động" bỏ hết ghim. Lưu trên máy này.
 */
export function HomeCustomizeDrawer({
  open,
  onClose,
  catalog,
  shown,
  pinned,
}: {
  open: boolean;
  onClose: () => void;
  catalog: QuickEntry[];
  shown: QuickEntry[];
  /** Người dùng đã ghim (khác chế độ tự động). */
  pinned: boolean;
}) {
  const { show, setPins, toggleHidden, reset } = useHomePrefs();
  const max = MAX_QUICK - 1; // chừa ô "Tất cả tính năng"
  const keys = shown.map((e) => e.key);
  const rest = catalog.filter((e) => !keys.includes(e.key));

  const toggle = (key: string) => {
    if (keys.includes(key)) setPins(keys.filter((k) => k !== key));
    else if (keys.length < max) setPins([...keys, key]);
  };
  const move = (key: string, dir: -1 | 1) => {
    const i = keys.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return;
    const next = [...keys];
    [next[i], next[j]] = [next[j], next[i]];
    setPins(next);
  };

  return (
    <FilterDrawer
      open={open}
      onClose={onClose}
      title={t`Tuỳ chỉnh trang chủ`}
      onReset={reset}
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <div>
            <p className="text-base font-medium">{t`Thao tác nhanh`}</p>
            <p className="text-sm text-muted-foreground">
              {pinned
                ? t`Bạn đang tự chọn ô. Tối đa ${max} ô; ô cuối luôn là “Tất cả tính năng”.`
                : t`Đang tự động: app xếp những ô bạn hay bấm lên trước. Chọn ô để tự quyết định.`}
            </p>
          </div>

          <ul className="flex flex-col">
            {shown.map((e, i) => (
              <li key={e.key} className={ROW}>
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggle(e.key)}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                  <span className="shrink-0 text-primary [&>svg]:h-5 [&>svg]:w-5">
                    {e.icon}
                  </span>
                  <span className="truncate text-sm">{e.label}</span>
                </label>
                {pinned && (
                  <>
                    <button
                      type="button"
                      onClick={() => move(e.key, -1)}
                      disabled={i === 0}
                      aria-label={t`Chuyển lên`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <IconChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(e.key, 1)}
                      disabled={i === shown.length - 1}
                      aria-label={t`Chuyển xuống`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <IconChevronDown className="h-4 w-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
            {rest.map((e) => (
              <li key={e.key} className={ROW}>
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={keys.length >= max}
                    onChange={() => toggle(e.key)}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                  <span className="shrink-0 text-muted-foreground [&>svg]:h-5 [&>svg]:w-5">
                    {e.icon}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {e.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {pinned && (
            <button
              type="button"
              onClick={() => setPins(null)}
              className="self-start text-sm text-primary hover:underline"
            >
              {t`Quay về tự động`}
            </button>
          )}
        </section>

        <section className="flex flex-col gap-1">
          <p className="text-base font-medium">{t`Hiển thị trên trang chủ`}</p>
          <ul className="flex flex-col">
            {HOME_CARD_KEYS.map((k) => (
              <li key={k}>
                <label className={ROW}>
                  <input
                    type="checkbox"
                    checked={show(k)}
                    onChange={() => toggleHidden(k)}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                  <span className="text-sm">{cardLabel(k)}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </FilterDrawer>
  );
}
