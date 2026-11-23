import { IconCheck, IconSearch } from "@/components/icons";
import { PersonAvatar } from "@/components/PersonAvatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KinshipPerson } from "@/lib/kinship";

import { t } from "@lingui/core/macro";

/**
 * Chọn một người ĐÃ CÓ trong dòng họ để gắn quan hệ (làm con / cha mẹ / vợ chồng) thay vì
 * tạo mới — dùng chung cho Thêm con, Thêm cha/mẹ, Thêm vợ/chồng. Lọc theo tên không cần dấu
 * do màn gọi làm (truyền `candidates` đã lọc); component chỉ lo hiển thị và chọn.
 */
export function ExistingPersonPicker({
  intro,
  label = t`Tìm người đã có trong dòng họ`,
  outro,
  filter,
  onFilterChange,
  candidates,
  totalMatched,
  cap,
  loaded,
  emptyLabel = t`Không có người nào khớp.`,
  selectedId,
  onSelect,
  rowNote,
}: {
  /** Dòng giải thích ngay dưới đầu card. */
  intro: React.ReactNode;
  label?: React.ReactNode;
  /** Chú thích cuối danh sách (hậu quả của việc gắn). */
  outro: React.ReactNode;
  filter: string;
  onFilterChange: (v: string) => void;
  candidates: KinshipPerson[];
  totalMatched: number;
  /** Số dòng hiện tối đa. */
  cap: number;
  /** Đã tải xong chỉ mục dòng họ (chưa thì hiện "Đang tải…"). */
  loaded: boolean;
  emptyLabel?: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Ghi chú dưới tên từng người (vd. cảnh báo sẽ ghi đè). */
  rowNote?: (p: KinshipPerson) => string | null;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{intro}</p>
      <Label>{label}</Label>
      <Input
        icon={<IconSearch />}
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder={t`Gõ tên để lọc (không cần dấu)`}
      />
      {loaded && totalMatched > 0 && (
        <p className="text-xs text-muted-foreground">
          {totalMatched > cap
            ? t`Hiện ${cap} / ${totalMatched} kết quả — gõ thêm để thu hẹp.`
            : t`Hiện ${totalMatched} kết quả.`}
        </p>
      )}
      <ul className="max-h-80 divide-y overflow-y-auto rounded-md border bg-card text-sm">
        {candidates.length === 0 && (
          <li className="px-3 py-2 italic text-muted-foreground">
            {loaded ? emptyLabel : t`Đang tải…`}
          </li>
        )}
        {candidates.map((p) => {
          const active = p.id === selectedId;
          const note = rowNote?.(p) ?? null;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50 ${
                  active ? "bg-primary/10" : ""
                }`}
              >
                <PersonAvatar gender={p.gender} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`truncate ${active ? "font-semibold text-primary" : "font-medium"}`}
                    >
                      {p.full_name}
                    </span>
                    {p.birth_year && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.birth_year}
                      </span>
                    )}
                  </div>
                  {note && (
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                      {note}
                    </p>
                  )}
                </div>
                {active && (
                  <IconCheck className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{outro}</p>
    </div>
  );
}
