import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";

import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { PosterSvg } from "@/components/poster/PosterSvg";
import { SearchInput } from "@/components/SearchInput";
import { useToast } from "@/components/Toast";
import {
  IconDownload,
  IconPrinter,
  IconUser,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { effectiveRole, useClanContext } from "@/hooks/useClanContext";
import {
  buildPoster,
  DEFAULT_POSTER_CONFIG,
  type PosterConfig,
} from "@/lib/poster/buildPoster";
import { POSTER_SIZES, type PosterSize } from "@/lib/poster/frame";
import {
  BANNERS,
  BORDERS,
  COLUMNS,
  CORNERS,
  PALETTES,
} from "@/lib/poster/ornaments";
import { queryKeys } from "@/lib/queries/keys";
import { getTreeData } from "@/lib/queries/tree";
import { matchesName } from "@/lib/unaccent";

/**
 * "Bảng gia phả" — một tấm duy nhất, khổ lớn, để in treo ở nhà thờ họ.
 *
 * Khác hẳn "Xuất sổ" (sách A4 nhiều trang, để đọc): tấm này để NHÌN cả
 * dòng họ một lượt và để treo, nên hoa văn, băng tên, câu đối là phần
 * việc thật chứ không phải trang trí thêm.
 *
 * Hoa văn chia thành các phần rời — khung diềm, băng tên, hoạ tiết góc,
 * cột câu đối, bảng màu — chọn riêng từng phần nhưng dùng CHUNG một bố
 * cục (lib/poster/frame.ts), nên đổi mẫu không bao giờ làm cây đè lên
 * khung.
 */

/**
 * Trên ngưỡng này thì dựng tấm mất vài giây và trình duyệt sẽ đứng một
 * nhịp — hỏi trước thay vì tự nhiên treo máy người dùng.
 */
const AUTO_PREVIEW_LIMIT = 1200;

export default function Poster() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const toast = useToast();
  const base = `/clans/${clan.id}`;

  const treeSource =
    effectiveRole(clan) === null ? "persons_public_safe" : "persons";
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.treeData(clan.id, user?.id ?? "anon", treeSource),
    queryFn: () => getTreeData(clan.id, treeSource),
    enabled: !!user,
  });

  const [cfg, setCfg] = useState<PosterConfig>({
    ...DEFAULT_POSTER_CONFIG,
    title: clan.name,
  });
  const set = <K extends keyof PosterConfig>(k: K, v: PosterConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  const [search, setSearch] = useState("");
  const [forced, setForced] = useState(false);
  const [busy, setBusy] = useState(false);

  // Hoãn một nhịp: gõ câu đối mà dựng lại cả tấm sau từng chữ thì ô nhập
  // giật đến mức không gõ nổi.
  const deferred = useDeferredValue(cfg);

  const heavy = (data?.persons.length ?? 0) > AUTO_PREVIEW_LIMIT;
  const doc = useMemo(() => {
    if (!data) return null;
    if (heavy && !forced && !deferred.focalId) return null;
    return buildPoster(data.persons, data.families, deferred);
  }, [data, deferred, heavy, forced]);

  const focalName = cfg.focalId
    ? data?.persons.find((p) => p.id === cfg.focalId)?.full_name ?? null
    : null;

  const matches = useMemo(() => {
    if (!data || !search.trim()) return [];
    return data.persons
      .filter((p) => matchesName(p.full_name, search))
      .slice(0, 8);
  }, [data, search]);

  const download = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      const { downloadClanPosterPdf } = await import(
        "@/lib/pdf/exportClanPoster"
      );
      const { filename, bytes } = await downloadClanPosterPdf(
        clan.name,
        doc,
        cfg,
      );
      toast.success("Đã tải bảng gia phả", {
        description: `${filename} · ${(bytes / 1024 / 1024).toFixed(1)} MB`,
      });
    } catch (e) {
      toast.error("Không xuất được PDF", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: clan.name, to: base },
          { label: "Công cụ", to: `${base}/tools` },
          { label: "Bảng gia phả" },
        ]}
      />
      <PageHeader
        icon={<IconPrinter className="h-7 w-7" />}
        title="Bảng gia phả in khổ lớn"
        description="Một tấm duy nhất để in treo — chọn khổ giấy, hoa văn và phạm vi, rồi tải PDF mang ra tiệm in."
      />

      {isLoading && <p className="text-sm text-muted-foreground">Đang tải dữ liệu cây…</p>}

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        {/* ─── Bảng chọn ─────────────────────────────────────────── */}
        <div className="space-y-5">
          <Section title="Khổ giấy & màu">
            <Field label="Khổ giấy (in ngang)">
              <Select
                value={cfg.size}
                onChange={(e) => set("size", e.target.value as PosterSize)}
              >
                {Object.entries(POSTER_SIZES).map(([id, s]) => (
                  <option key={id} value={id}>
                    {s.label} — {s.cm}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bảng màu">
              <Select
                value={cfg.paletteId}
                onChange={(e) => set("paletteId", e.target.value)}
              >
                {PALETTES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </Section>

          <Section
            title="Hoa văn"
            hint="Bốn phần chọn riêng, dùng chung một bố cục nên không phần nào lấn chỗ phần nào."
          >
            <Field label="Khung diềm">
              <Select
                value={cfg.border}
                onChange={(e) =>
                  set("border", e.target.value as PosterConfig["border"])
                }
              >
                {BORDERS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Băng tên">
              <Select
                value={cfg.banner}
                onChange={(e) =>
                  set("banner", e.target.value as PosterConfig["banner"])
                }
              >
                {BANNERS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Hoạ tiết bốn góc">
              <Select
                value={cfg.corner}
                onChange={(e) =>
                  set("corner", e.target.value as PosterConfig["corner"])
                }
              >
                {CORNERS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cột câu đối hai bên">
              <Select
                value={cfg.column}
                onChange={(e) =>
                  set("column", e.target.value as PosterConfig["column"])
                }
              >
                {COLUMNS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </Field>
          </Section>

          <Section title="Chữ trên tấm">
            <Field label="Tên dòng họ">
              <Input
                value={cfg.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="HỌ NGUYỄN"
              />
            </Field>
            <Field label="Dòng phụ dưới tên">
              <Input
                value={cfg.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="PHẢ ĐỒ DÒNG HỌ"
              />
            </Field>
            {cfg.column !== "khong" && (
              <>
                <Field label="Câu đối bên trái">
                  <Input
                    value={cfg.coupletLeft}
                    onChange={(e) => set("coupletLeft", e.target.value)}
                  />
                </Field>
                <Field label="Câu đối bên phải">
                  <Input
                    value={cfg.coupletRight}
                    onChange={(e) => set("coupletRight", e.target.value)}
                  />
                </Field>
              </>
            )}
          </Section>

          <Section
            title="Phạm vi"
            hint="Cả dòng họ cho tấm tổng thể; chọn một người khi muốn in riêng một nhánh cho chữ to, dễ đọc."
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={cfg.focalId ? "outline" : "default"}
                size="sm"
                onClick={() => {
                  set("focalId", null);
                  set("generations", 0);
                }}
              >
                Cả dòng họ
              </Button>
              <Button
                type="button"
                variant={cfg.focalId ? "default" : "outline"}
                size="sm"
                onClick={() => set("generations", 5)}
              >
                Một nhánh
              </Button>
            </div>

            <div className="relative">
              <SearchInput
                label="Người làm gốc của tấm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={focalName ?? "Gõ tên để tìm…"}
              />
              {matches.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-card shadow-lg">
                  {matches.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          set("focalId", p.id);
                          setSearch("");
                        }}
                      >
                        <IconUser className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 truncate">{p.full_name}</span>
                        {p.generation != null && (
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            đời {p.generation}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {focalName && (
              <p className="text-sm">
                Đang in từ <span className="font-medium">{focalName}</span>{" "}
                xuống.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => set("focalId", null)}
                >
                  Bỏ chọn
                </button>
              </p>
            )}

            <Field label="Số đời in từ gốc xuống">
              <Select
                value={String(cfg.generations)}
                onChange={(e) => set("generations", Number(e.target.value))}
              >
                <option value="0">Hết cây</option>
                {[3, 4, 5, 6, 7, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} đời
                  </option>
                ))}
              </Select>
            </Field>
          </Section>

          <Section title="Hiện gì trong ô">
            <Toggle
              checked={cfg.showYears}
              onChange={(v) => set("showYears", v)}
              label="Năm sinh – năm mất"
            />
            <Toggle
              checked={cfg.showSpouses}
              onChange={(v) => set("showSpouses", v)}
              label="Vợ/chồng (dâu, rể) đứng cạnh"
            />
            <Toggle
              checked={cfg.showGenerationLabels}
              onChange={(v) => set("showGenerationLabels", v)}
              label='Nhãn "Đời 1, 2, 3…" bên trái'
            />
          </Section>
        </div>

        {/* ─── Xem trước ─────────────────────────────────────────── */}
        <div className="space-y-3">
          {doc ? (
            <>
              <div className="overflow-hidden rounded-xl border bg-muted/30 p-2">
                <PosterSvg doc={doc} className="h-auto w-full" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {doc.peopleCount} ô · {doc.rows} đời · chữ tên{" "}
                  {doc.namePt.toFixed(1)}pt trên khổ {cfg.size}
                </p>
                <Button type="button" onClick={download} disabled={busy}>
                  <IconDownload className="mr-1.5 h-4 w-4" />
                  {busy ? "Đang dựng PDF…" : "Tải PDF để in"}
                </Button>
              </div>
              {doc.warnings.map((w) => (
                <Alert key={w}>
                  <AlertDescription>{w}</AlertDescription>
                </Alert>
              ))}
            </>
          ) : (
            !isLoading && (
              <div className="rounded-xl border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Dòng họ này có {data?.persons.length ?? 0} người. Dựng cả tấm
                  một lượt sẽ mất vài giây và máy đứng một nhịp — nên chọn một
                  người làm gốc để in theo nhánh, hoặc bấm dựng thử bên dưới.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => setForced(true)}
                >
                  Vẫn dựng cả dòng họ
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
