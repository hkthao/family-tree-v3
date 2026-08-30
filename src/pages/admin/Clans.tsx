import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconUser,
  IconSparkles,
  IconUsers,
} from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { RecordDates } from "@/components/RecordDates";
import { SearchInput } from "@/components/SearchInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUrlPatch } from "@/hooks/useUrlState";
import {
  listAllClans,
  updateClanLimits,
  type AdminClanRow,
} from "@/lib/queries/admin";
import { queryKeys } from "@/lib/queries/keys";
import { unaccent } from "@/lib/unaccent";
import { CollapsibleHint, RefreshIconButton } from "@/pages/admin/shared";

const PAGE_SIZE = 15;

export function ClansTab() {
  const [sp] = useSearchParams();
  const patch = useUrlPatch();
  const search = sp.get("q") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const setSearch = (v: string) => patch({ q: v || null, page: null });
  const setPage = (n: number) => patch({ page: n <= 1 ? null : String(n) });
  const qc = useQueryClient();

  const { data: clans, isLoading, refetch, isFetching } = useQuery({
    queryKey: queryKeys.adminClans(),
    queryFn: () => listAllClans(),
    // Xem ghi chú ở UsersTab: dữ liệu mới nhất + nút Tải lại cho PWA.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const filtered = useMemo(() => {
    if (!clans) return [];
    if (!search.trim()) return clans;
    const needle = unaccent(search);
    return clans.filter((c) => unaccent(c.name).includes(needle));
  }, [clans, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <CollapsibleHint>
          {clans?.length ?? 0} dòng họ. Chỉnh giới hạn số người / tài khoản
          tại đây.
        </CollapsibleHint>
        <RefreshIconButton onClick={() => refetch()} busy={isFetching} />
      </div>

      <SearchInput
        label="Tìm dòng họ theo tên"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm dòng họ theo tên — gõ không dấu cũng được"
      />

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}

      <ul className="space-y-2">
        {pageRows.map((c) => (
          <ClanRow
            key={c.id}
            clan={c}
            onChange={() =>
              qc.invalidateQueries({ queryKey: queryKeys.adminClans() })
            }
          />
        ))}
      </ul>

      {total > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

/** Số → ô nhập. `null` (chưa đặt) và `undefined` (dữ liệu cũ) đều thành rỗng. */

function asText(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

function ClanRow({
  clan,
  onChange,
}: {
  clan: AdminClanRow;
  onChange: () => void;
}) {
  const toast = useToast();
  const [maxPersons, setMaxPersons] = useState(String(clan.max_persons));
  const [maxUsers, setMaxUsers] = useState(String(clan.max_users));
  // Rỗng = dùng mức chung của nền tảng. Giữ dạng chuỗi để phân biệt được
  // "rỗng" với "0" — 0 là một mức thật ("khoá hẳn"), không phải bỏ trống.
  //
  // Phải dùng `?? ""` chứ KHÔNG phải so `=== null`: bản ghi cũ còn trong
  // cache của react-query (từ lần deploy trước, khi cột này chưa tồn
  // tại) mang giá trị `undefined`, mà `String(undefined)` ra chuỗi
  // "undefined" — trình duyệt ném đúng lỗi
  // «The specified value "undefined" cannot be parsed» cho input số.
  const [aiDaily, setAiDaily] = useState(asText(clan.ai_daily_limit));
  const [aiMonthly, setAiMonthly] = useState(asText(clan.ai_monthly_limit));
  const asLimit = (v: string) => (v.trim() === "" ? null : Number(v));

  const m = useMutation({
    mutationFn: () =>
      updateClanLimits(clan.id, {
        max_persons: Number(maxPersons),
        max_users: Number(maxUsers),
        ai_daily_limit: asLimit(aiDaily),
        ai_monthly_limit: asLimit(aiMonthly),
      }),
    onSuccess: () => {
      onChange();
      toast.success("Đã cập nhật giới hạn clan");
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  const changed =
    String(clan.max_persons) !== maxPersons ||
    String(clan.max_users) !== maxUsers ||
    asText(clan.ai_daily_limit) !== aiDaily ||
    asText(clan.ai_monthly_limit) !== aiMonthly;

  const isPublic = clan.visibility === "public";

  return (
    <li className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header: clan name + visibility pill on top row, description
          (if any) wraps below the name on its own line. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/clans/${clan.id}`}
            className="font-semibold hover:underline truncate block"
          >
            {clan.name}
          </Link>
          {clan.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {clan.description}
            </p>
          )}
          <RecordDates
            createdAt={clan.created_at}
            updatedAt={clan.updated_at}
            className="text-xs text-muted-foreground/80 mt-0.5 truncate"
          />
        </div>
        <span
          className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${
            isPublic
              ? "bg-accent/20 text-accent"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isPublic ? "Công khai" : "Riêng tư"}
        </span>
      </div>

      {/* Hạn mức. Bốn ô chia đều chiều ngang, KHÔNG chen nút vào hàng:
          nút nằm cạnh ô nhập thì ở màn hẹp nó bóp ô nhập còn vài ký tự,
          mà ô nhập mới là thứ cần nhìn. Nút xuống chân thẻ — xem
          docs/design-language.md §Đặt hành động ở đâu.

          Hai ô AI để trống = dùng mức chung của nền tảng (sửa ở Cài đặt ›
          Trợ lý AI); 0 = khoá hẳn. */}
      <div className="border-t pt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1 min-w-0">
          <Label htmlFor={`mp-${clan.id}`} className="text-xs">
            Giới hạn người
          </Label>
          <Input
            id={`mp-${clan.id}`}
            icon={<IconUsers />}
            type="number"
            min={1}
            value={maxPersons}
            onChange={(e) => setMaxPersons(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="space-y-1 min-w-0">
          <Label htmlFor={`mu-${clan.id}`} className="text-xs">
            Giới hạn tài khoản
          </Label>
          <Input
            id={`mu-${clan.id}`}
            icon={<IconUser />}
            type="number"
            min={1}
            value={maxUsers}
            onChange={(e) => setMaxUsers(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="space-y-1 min-w-0">
          <Label htmlFor={`ad-${clan.id}`} className="text-xs">
            Lượt AI / ngày
          </Label>
          <Input
            id={`ad-${clan.id}`}
            icon={<IconSparkles />}
            type="number"
            min={0}
            placeholder="mặc định"
            value={aiDaily}
            onChange={(e) => setAiDaily(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="space-y-1 min-w-0">
          <Label htmlFor={`am-${clan.id}`} className="text-xs">
            Lượt AI / tháng
          </Label>
          <Input
            id={`am-${clan.id}`}
            icon={<IconSparkles />}
            type="number"
            min={0}
            placeholder="mặc định"
            value={aiMonthly}
            onChange={(e) => setAiMonthly(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {/* Chân thẻ: meta bên trái, hành động ngoài cùng bên phải — gần
          ngón cái nhất trên điện thoại. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          {changed ? "Có thay đổi chưa lưu" : `${clan.person_count} người`}
        </span>
        <Button
          variant="outline"
          onClick={() => m.mutate()}
          disabled={m.isPending || !changed}
        >
          {m.isPending ? (
            "Đang lưu…"
          ) : (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              Lưu
            </>
          )}
        </Button>
      </div>

      {m.error && (
        <Alert variant="destructive">
          <AlertDescription>{(m.error as Error).message}</AlertDescription>
        </Alert>
      )}
    </li>
  );
}

/**
 * Help-text block that clamps to 1 line on mobile + offers a "Xem
 * thêm / Thu gọn" toggle. On sm+ it shows the full text — there's
 * enough vertical room there that hiding it is overkill.
 */
/**
 * Nút tải lại dùng chung cho các tab admin (Người dùng / Dòng họ).
 * PWA hay giữ cache cũ → cho admin chủ động fetch lại dữ liệu mới nhất.
 */
