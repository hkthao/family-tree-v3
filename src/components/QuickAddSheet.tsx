import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { BirthOrderPicker } from "@/components/BirthOrderPicker";
import { CalendarDateInput } from "@/components/CalendarDateInput";
import {
  IconCheck,
  IconChevronUp,
  IconPlus,
  IconUser,
  IconUsers,
  IconUserPlus,
  IconX,
} from "@/components/icons";
import { RelationSheet } from "@/components/RelationSheet";
import { useToast } from "@/components/Toast";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import {
  addChildToFamily,
  addChildrenToFamily,
  findOrCreateFamily,
  getPersonRelationships,
} from "@/lib/queries/families";
import { queryKeys } from "@/lib/queries/keys";
import { createPerson, getPerson, updatePerson } from "@/lib/queries/persons";
import { inferGenderFromName } from "@/lib/nameGender";
import {
  buildDeathAnniversary,
  buildPersonDateColumns,
  EMPTY_CALENDAR_DATE,
  EMPTY_LUNAR_CALENDAR_DATE,
  type CalendarDateValue,
} from "@/lib/personDates";

type Relation = "child" | "spouse" | "parent";

/**
 * Năm (dương) → cột birth/death của persons. Dùng cho ô năm nhanh ở chế
 * độ "Nhiều người" (mỗi dòng chỉ 1 ô năm cho gọn). Trả null nếu trống.
 */
function yearToCols(yearStr: string) {
  const y = yearStr.trim();
  if (!y) return null;
  const v: CalendarDateValue = {
    mode: "solar",
    parts: { year: y, month: "", day: "" },
    isLeap: false,
  };
  const c = buildPersonDateColumns(v);
  return { date: c.solar_date, precision: c.solar_precision };
}

/**
 * Dựng đầy đủ các cột ngày sinh/mất (dương + âm + giỗ) từ form state —
 * giống màn Thêm/Sửa người. Trải vào addChildToFamily / createPerson.
 */
function birthDeathPayload(
  birth: CalendarDateValue,
  death: CalendarDateValue,
  isLiving: boolean,
) {
  const b = buildPersonDateColumns(birth);
  const d = buildPersonDateColumns(death);
  const anniv = buildDeathAnniversary(death);
  return {
    birth_date: b.solar_date,
    birth_date_precision: b.solar_precision,
    birth_lunar_year: b.lunar_year,
    birth_lunar_month: b.lunar_month,
    birth_lunar_day: b.lunar_day,
    birth_lunar_is_leap: b.lunar_is_leap,
    is_living: isLiving,
    death_date: d.solar_date,
    death_date_precision: d.solar_precision,
    death_lunar_year: d.lunar_year,
    death_lunar_month: d.lunar_month,
    death_lunar_day: d.lunar_day,
    death_lunar_is_leap: d.lunar_is_leap,
    death_anniv_lunar_month: anniv.death_anniv_lunar_month,
    death_anniv_lunar_day: anniv.death_anniv_lunar_day,
    death_anniv_lunar_is_leap: anniv.death_anniv_lunar_is_leap,
  };
}

/**
 * Ô ngày sinh + "Đã mất" + ngày mất đầy đủ (âm/dương) — giống màn
 * Thêm/Sửa người. Dùng cho form thêm nhanh 1 người.
 */
function DateFields({
  idPrefix,
  birth,
  death,
  isLiving,
  onBirth,
  onDeath,
  onLiving,
}: {
  idPrefix: string;
  birth: CalendarDateValue;
  death: CalendarDateValue;
  isLiving: boolean;
  onBirth: (v: CalendarDateValue) => void;
  onDeath: (v: CalendarDateValue) => void;
  onLiving: (v: boolean) => void;
}) {
  return (
    <>
      <CalendarDateInput
        label="Ngày sinh (tuỳ chọn)"
        idPrefix={`${idPrefix}-birth`}
        helperText="Chỉ nhớ năm cũng được. Bấm 'Nhập theo lịch Âm' nếu tài liệu ghi ngày âm."
        value={birth}
        onChange={onBirth}
      />
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={!isLiving}
          onChange={(e) => {
            const deceased = e.target.checked;
            onLiving(!deceased);
            if (!deceased) onDeath(EMPTY_LUNAR_CALENDAR_DATE);
          }}
          className="h-5 w-5 accent-primary shrink-0"
        />
        <span>Đã mất</span>
      </label>
      {!isLiving && (
        <CalendarDateInput
          label="Ngày mất (nếu đã mất)"
          idPrefix={`${idPrefix}-death`}
          value={death}
          onChange={(next) => {
            onDeath(next);
            if (next.parts.year || next.parts.month || next.parts.day)
              onLiving(false);
          }}
          helperText="Ưu tiên ghi ngày âm. Chỉ cần ngày giỗ (tháng/ngày), bỏ trống năm cũng được."
        />
      )}
    </>
  );
}

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  clanId: string;
  personId: string;
  /**
   * Skip the relation picker and jump straight into a specific mini-
   * form. Used by /todo when we already know which gap is being
   * fixed (e.g. clicking a `missing_parents` row pre-selects
   * "parent"). When set, the "Đổi quan hệ" back link is hidden so
   * the user can't drift away from the fix.
   */
  defaultRelation?: Relation;
}

/**
 * Quick-add popup on the tree: pick a relation, type a name (+ 1-2
 * essentials), save. The full forms at /add-child etc. are still
 * available for ngày sinh / gắn người đã có — reached via the Edit
 * icon → PersonDetail.
 */
export function QuickAddSheet({
  open,
  onClose,
  clanId,
  personId,
  defaultRelation,
}: QuickAddSheetProps) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [relation, setRelation] = useState<Relation | null>(
    defaultRelation ?? null,
  );

  useEffect(() => {
    if (open) setRelation(defaultRelation ?? null);
  }, [open, defaultRelation]);

  const { data: focal } = useQuery({
    queryKey: queryKeys.person(personId, userId),
    queryFn: () => getPerson(personId),
    enabled: open && !!personId,
  });

  const titleByRelation: Record<Relation, string> = {
    child: "Thêm con",
    spouse: "Thêm vợ/chồng",
    parent: "Thêm cha/mẹ",
  };
  const title = relation ? titleByRelation[relation] : "Thêm người";
  const subtitle = focal ? `Cho ${focal.full_name}` : undefined;

  return (
    <RelationSheet
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
    >
      {relation === null && <RelationPicker onPick={setRelation} />}
      {relation === "child" && (
        <QuickAddChild
          clanId={clanId}
          personId={personId}
          onBack={defaultRelation ? null : () => setRelation(null)}
          onDone={onClose}
        />
      )}
      {relation === "spouse" && (
        <QuickAddSpouse
          clanId={clanId}
          personId={personId}
          onBack={defaultRelation ? null : () => setRelation(null)}
          onDone={onClose}
        />
      )}
      {relation === "parent" && (
        <QuickAddParent
          clanId={clanId}
          personId={personId}
          onBack={defaultRelation ? null : () => setRelation(null)}
          onDone={onClose}
        />
      )}
    </RelationSheet>
  );
}

// ─── Name-prefix heuristic ────────────────────────────────────────
//
// In Vietnamese clans, a generation typically shares a surname (họ)
// and often a middle "đệm" word too — boys "Văn", girls "Thị", or a
// generational character from family poetry. We pre-fill the input
// with the longest word-prefix shared by existing same-gender
// siblings; fall back to all-siblings prefix; fall back to focal's
// surname. The user types only the personal name. Always drops the
// last word — that's the given (personal) name and must not be
// auto-completed.

function commonWordPrefix(names: string[]): string[] {
  const words = names
    .map((n) => n.trim().split(/\s+/).filter(Boolean))
    .filter((ws) => ws.length > 0);
  if (words.length === 0) return [];
  const shortest = Math.min(...words.map((w) => w.length));
  const cap = Math.max(0, shortest - 1);
  const out: string[] = [];
  for (let i = 0; i < cap; i++) {
    const head = words[0][i];
    if (words.every((ws) => ws[i] === head)) out.push(head);
    else break;
  }
  return out;
}

function deriveNamePrefix(
  focal: { full_name: string } | null | undefined,
  children: { full_name: string; gender: "M" | "F" }[],
  gender: "M" | "F",
): string {
  if (!focal) return "";
  const sameGender = children.filter((c) => c.gender === gender);
  let prefix = commonWordPrefix(sameGender.map((c) => c.full_name));
  if (prefix.length === 0 && children.length > 0) {
    prefix = commonWordPrefix(children.map((c) => c.full_name));
  }
  if (prefix.length === 0) {
    const w = focal.full_name.trim().split(/\s+/).filter(Boolean);
    if (w.length > 0) prefix = [w[0]];
  }
  return prefix.length > 0 ? prefix.join(" ") + " " : "";
}

function focusAtEnd(el: HTMLInputElement | null) {
  if (!el) return;
  el.focus();
  const len = el.value.length;
  try {
    el.setSelectionRange(len, len);
  } catch {
    /* not all input types support setSelectionRange */
  }
}

// ─── Phase A: relation picker ─────────────────────────────────────

function RelationPicker({
  onPick,
}: {
  onPick: (r: Relation) => void;
}) {
  return (
    <div className="space-y-3 pb-6">
      <p className="text-sm text-muted-foreground">
        Chọn quan hệ với người này:
      </p>
      <RelationCard
        label="Con"
        hint="Thêm một hoặc nhiều con"
        icon={<IconUsers className="h-5 w-5" />}
        onClick={() => onPick("child")}
      />
      <RelationCard
        label="Vợ / chồng"
        hint="Gắn bạn đời cho người này"
        icon={<IconUserPlus className="h-5 w-5" />}
        onClick={() => onPick("spouse")}
      />
      <RelationCard
        label="Cha / mẹ"
        hint="Thêm đời trên"
        icon={<IconPlus className="h-5 w-5" />}
        onClick={() => onPick("parent")}
      />
    </div>
  );
}

function RelationCard({
  label,
  hint,
  icon,
  onClick,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left hover:bg-muted/40 transition-colors"
    >
      <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{hint}</div>
      </div>
    </button>
  );
}

// ─── Shared mini-bits ─────────────────────────────────────────────

function GenderToggle({
  value,
  onChange,
}: {
  value: "M" | "F";
  onChange: (g: "M" | "F") => void;
}) {
  return (
    <SegmentedControl ariaLabel="Giới tính">
      <SegmentedButton active={value === "M"} onClick={() => onChange("M")}>
        Nam
      </SegmentedButton>
      <SegmentedButton active={value === "F"} onClick={() => onChange("F")}>
        Nữ
      </SegmentedButton>
    </SegmentedControl>
  );
}

function BackToPickerButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
    >
      ← Đổi quan hệ
    </button>
  );
}

function IconButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-md border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// ─── Phase B1: Quick add child (single + bulk) ────────────────────

const SOLO_VALUE = "__solo__";

function QuickAddChild({
  clanId,
  personId,
  onBack,
  onDone,
}: {
  clanId: string;
  personId: string;
  onBack: (() => void) | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: focal } = useQuery({
    queryKey: queryKeys.person(personId, userId),
    queryFn: () => getPerson(personId),
    enabled: !!personId,
  });
  const { data: rels } = useQuery({
    queryKey: queryKeys.personRelationships(personId, userId),
    queryFn: () => getPersonRelationships(personId),
    enabled: !!personId,
  });

  const existingCount = rels?.children.length ?? 0;
  const spouses = rels?.spouses ?? [];
  const children = rels?.children ?? [];

  const [otherParent, setOtherParent] = useState<string>(SOLO_VALUE);
  const [otherParentTouched, setOtherParentTouched] = useState(false);
  useEffect(() => {
    if (otherParentTouched) return;
    if (spouses.length >= 1 && otherParent === SOLO_VALUE) {
      setOtherParent(spouses[0].id);
    }
  }, [spouses, otherParent, otherParentTouched]);

  const [bulkMode, setBulkMode] = useState(false);

  // Single-mode state.
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  // Once the user manually picks a gender we stop auto-flipping from
  // name inference — they've made an explicit choice we shouldn't
  // second-guess on every keystroke.
  const [genderTouched, setGenderTouched] = useState(false);
  const [birthOrder, setBirthOrder] = useState<string>("");
  const [birth, setBirth] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [death, setDeath] = useState<CalendarDateValue>(
    EMPTY_LUNAR_CALENDAR_DATE,
  );
  const [isLiving, setIsLiving] = useState(true);
  const nameRef = useRef<HTMLInputElement>(null);

  function onSingleNameChange(v: string) {
    setName(v);
    if (!genderTouched) {
      const inferred = inferGenderFromName(v);
      if (inferred) setGender(inferred);
    }
  }

  useEffect(() => {
    if (!bulkMode && birthOrder === "" && rels) {
      setBirthOrder(String(existingCount + 1));
    }
  }, [rels, existingCount, birthOrder, bulkMode]);

  // One-shot prefill of the single-mode name with the derived prefix
  // (họ + đệm). Subsequent name edits are the user's; we re-set the
  // prefix only after a successful save (where we intentionally
  // clear).
  const singleInitRef = useRef(false);
  useEffect(() => {
    if (singleInitRef.current) return;
    if (!focal || !rels) return;
    const p = deriveNamePrefix(focal, children, gender);
    if (p) {
      setName(p);
      setTimeout(() => focusAtEnd(nameRef.current), 0);
    }
    singleInitRef.current = true;
    // gender is intentionally excluded — first-load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focal, rels]);

  // Bulk-mode state: list of rows. `genderTouched` is tracked per
  // row so manual picks aren't clobbered by subsequent name edits.
  type Row = {
    name: string;
    gender: "M" | "F";
    genderTouched: boolean;
    birthYear: string;
    deathYear: string;
  };
  const mkRow = (name: string, gender: "M" | "F" = "M"): Row => ({
    name,
    gender,
    genderTouched: false,
    birthYear: "",
    deathYear: "",
  });
  const [rows, setRows] = useState<Row[]>([mkRow(""), mkRow(""), mkRow("")]);
  const bulkInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const bulkInitRef = useRef(false);

  useEffect(() => {
    if (bulkInitRef.current) return;
    if (!focal || !rels) return;
    const p = deriveNamePrefix(focal, children, "M");
    setRows([mkRow(p), mkRow(p), mkRow(p)]);
    bulkInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focal, rels]);

  function resolveFamilyInputs() {
    if (!focal) throw new Error("Thiếu thông tin");
    let partnerB: { id: string; gender: "M" | "F" } | null = null;
    if (otherParent !== SOLO_VALUE) {
      const sp = spouses.find((s) => s.id === otherParent);
      if (sp) partnerB = { id: sp.id, gender: sp.gender };
    }
    return {
      clanId,
      partnerA: { id: focal.id, gender: focal.gender },
      partnerB,
    };
  }

  const singleMutation = useMutation({
    mutationFn: async () => {
      const family = await findOrCreateFamily(resolveFamilyInputs());
      return addChildToFamily({
        clanId,
        family_id: family.id,
        full_name: name.trim(),
        gender,
        birth_order: birthOrder.trim()
          ? Math.max(1, Math.floor(Number(birthOrder)))
          : null,
        ...birthDeathPayload(birth, death, isLiving),
      });
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId);
      toast.success("Đã thêm con", { description: name.trim() });
      // Reset to the prefix so the user can type the next given name
      // immediately — the genealogy use-case is a row of siblings
      // sharing họ + đệm.
      const next = deriveNamePrefix(focal, children, gender);
      setName(next);
      setBirth(EMPTY_CALENDAR_DATE);
      setDeath(EMPTY_LUNAR_CALENDAR_DATE);
      setIsLiving(true);
      setBirthOrder((prev) => {
        const n = Math.max(1, Math.floor(Number(prev || existingCount + 1)));
        return String(n + 1);
      });
      setTimeout(() => focusAtEnd(nameRef.current), 0);
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const valid = rows.filter((r) => r.name.trim().length > 0);
      if (valid.length === 0) throw new Error("Chưa có tên nào");
      const family = await findOrCreateFamily(resolveFamilyInputs());
      // 1 insert nhiều dòng thay vì lặp N round-trip — atomic, ít dính
      // timeout/504 khi mạng yếu.
      const inputs = valid.map((r, i) => {
        const b = yearToCols(r.birthYear);
        const d = yearToCols(r.deathYear);
        return {
          clanId,
          family_id: family.id,
          full_name: r.name.trim(),
          gender: r.gender,
          birth_order: existingCount + i + 1,
          birth_date: b?.date ?? null,
          birth_date_precision: b?.precision ?? null,
          death_date: d?.date ?? null,
          death_date_precision: d?.precision ?? null,
          is_living: d ? false : true,
        };
      });
      const { count } = await addChildrenToFamily(inputs);
      return count;
    },
    onSuccess: async (n) => {
      await invalidateClanData(queryClient, clanId);
      toast.success(`Đã thêm ${n} người con`);
      const p = deriveNamePrefix(focal, children, "M");
      setRows([mkRow(p), mkRow(p), mkRow(p)]);
      setTimeout(() => focusAtEnd(bulkInputRefs.current[0]), 0);
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  function onSubmitSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || singleMutation.isPending) return;
    singleMutation.mutate();
  }

  function onSubmitBulk(e: React.FormEvent) {
    e.preventDefault();
    if (bulkMutation.isPending) return;
    bulkMutation.mutate();
  }

  function addRow() {
    const lastGender = rows[rows.length - 1]?.gender ?? "M";
    const p = deriveNamePrefix(focal, children, lastGender);
    setRows((prev) => [...prev, mkRow(p, lastGender)]);
    setTimeout(() => {
      const idx = bulkInputRefs.current.length - 1;
      focusAtEnd(bulkInputRefs.current[idx]);
    }, 0);
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function onBulkNameChange(i: number, v: string) {
    setRows((prev) =>
      prev.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, name: v };
        if (!r.genderTouched) {
          const inferred = inferGenderFromName(v);
          if (inferred) next.gender = inferred;
        }
        return next;
      }),
    );
  }

  function removeRow(i: number) {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((_, j) => j !== i) : prev,
    );
  }

  function moveRow(i: number, dir: -1 | 1) {
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const otherParentNote = (() => {
    if (spouses.length === 0) return null;
    if (otherParent === SOLO_VALUE) return "Đơn thân";
    const sp = spouses.find((s) => s.id === otherParent);
    return sp ? `Với ${sp.full_name}` : null;
  })();

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {onBack && <BackToPickerButton onBack={onBack} />}
        <SegmentedControl ariaLabel="Chế độ thêm con">
          <SegmentedButton
            active={!bulkMode}
            onClick={() => setBulkMode(false)}
          >
            1 người
          </SegmentedButton>
          <SegmentedButton
            active={bulkMode}
            onClick={() => setBulkMode(true)}
          >
            Nhiều người
          </SegmentedButton>
        </SegmentedControl>
      </div>

      {spouses.length >= 2 && (
        <div className="space-y-2">
          <Label htmlFor="other_parent">Cùng với</Label>
          <Select
            id="other_parent"
            icon={<IconUsers />}
            value={otherParent}
            onChange={(e) => {
              setOtherParent(e.target.value);
              setOtherParentTouched(true);
            }}
          >
            <option value={SOLO_VALUE}>Đơn thân</option>
            {spouses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {spouses.length === 1 && otherParentNote && (
        <p className="text-xs text-muted-foreground">{otherParentNote}</p>
      )}

      {!bulkMode ? (
        <form onSubmit={onSubmitSingle} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick_name" required>
              Tên con
            </Label>
            <Input
              id="quick_name"
              icon={<IconUser />}
              ref={nameRef}
              required
              autoFocus
              maxLength={200}
              value={name}
              onChange={(e) => onSingleNameChange(e.target.value)}
              placeholder="Vd: Nguyễn Văn C"
            />
          </div>

          <div className="flex flex-col items-start gap-2">
            <Label>Giới tính</Label>
            <GenderToggle
              value={gender}
              onChange={(g) => {
                setGender(g);
                setGenderTouched(true);
              }}
            />
          </div>

          <BirthOrderPicker
            value={birthOrder}
            onChange={setBirthOrder}
            inputId="quick_birth_order"
            helper={null}
          />

          <DateFields
            idPrefix="qa-child"
            birth={birth}
            death={death}
            isLiving={isLiving}
            onBirth={setBirth}
            onDeath={setDeath}
            onLiving={setIsLiving}
          />

          <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-card border-t flex gap-2 z-10">
            <Button
              type="submit"
              className="flex-1"
              disabled={singleMutation.isPending || !name.trim()}
            >
              <IconCheck className="h-4 w-4 mr-1.5" />
              Lưu & thêm người nữa
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDone}
              className="shrink-0"
            >
              Xong
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={onSubmitBulk} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Thứ tự nhập = thứ tự sinh. Enter để thêm dòng mới.
            Dùng ↑ ↓ để đổi thứ tự.
          </p>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li
                key={i}
                className="rounded-lg border bg-card p-2.5 space-y-2"
              >
                {/* icon-audit: ok — hàng dày đặc (số thứ tự, giới tính, 2 ô năm, nút xoá), icon ăn mất chỗ gõ */}
                {/* Hàng 1: số thứ tự + họ tên + xoá */}
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs text-muted-foreground tabular-nums">
                    {existingCount + i + 1}
                  </span>
                  <Input
                    ref={(el) => {
                      bulkInputRefs.current[i] = el;
                    }}
                    value={r.name}
                    onChange={(e) => onBulkNameChange(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (i === rows.length - 1) addRow();
                        else focusAtEnd(bulkInputRefs.current[i + 1]);
                      }
                    }}
                    placeholder="Họ tên"
                    maxLength={200}
                    className="flex-1 min-w-0"
                  />
                  <IconButton
                    onClick={() => removeRow(i)}
                    disabled={rows.length === 1}
                    label="Xoá dòng"
                  >
                    <IconX className="h-4 w-4" />
                  </IconButton>
                </div>
                {/* icon-audit: ok — cùng lý do hàng 1: mỗi ô chỉ ~90px */}
                {/* Hàng 2: giới tính + năm sinh/mất + đổi thứ tự */}
                <div className="flex items-center gap-2 pl-8">
                  <GenderToggle
                    value={r.gender}
                    onChange={(g) =>
                      updateRow(i, { gender: g, genderTouched: true })
                    }
                  />
                  <Input
                    value={r.birthYear}
                    onChange={(e) =>
                      updateRow(i, {
                        birthYear: e.target.value.replace(/\D/g, "").slice(0, 4),
                      })
                    }
                    inputMode="numeric"
                    placeholder="Năm sinh"
                    aria-label="Năm sinh"
                    className="flex-1 min-w-0"
                  />
                  {/* icon-audit: ok — cùng lý do: ô năm chỉ ~90px */}
                  <Input
                    value={r.deathYear}
                    onChange={(e) =>
                      updateRow(i, {
                        deathYear: e.target.value.replace(/\D/g, "").slice(0, 4),
                      })
                    }
                    inputMode="numeric"
                    placeholder="Năm mất"
                    aria-label="Năm mất"
                    className="flex-1 min-w-0"
                  />
                  <IconButton
                    onClick={() => moveRow(i, -1)}
                    disabled={i === 0}
                    label="Lên"
                  >
                    <IconChevronUp className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    onClick={() => moveRow(i, 1)}
                    disabled={i === rows.length - 1}
                    label="Xuống"
                  >
                    <IconChevronUp className="h-4 w-4 rotate-180" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={addRow}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <IconPlus className="h-4 w-4" />
            Thêm dòng
          </button>

          <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-card border-t flex gap-2 z-10">
            <Button
              type="submit"
              className="flex-1"
              disabled={
                bulkMutation.isPending ||
                rows.every((r) => !r.name.trim())
              }
            >
              <IconCheck className="h-4 w-4 mr-1.5" />
              {bulkMutation.isPending
                ? "Đang lưu…"
                : `Lưu ${rows.filter((r) => r.name.trim()).length} người`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDone}
              className="shrink-0"
            >
              Xong
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Phase B2: Quick add spouse ───────────────────────────────────

function QuickAddSpouse({
  clanId,
  personId,
  onBack,
  onDone,
}: {
  clanId: string;
  personId: string;
  onBack: (() => void) | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: focal } = useQuery({
    queryKey: queryKeys.person(personId, userId),
    queryFn: () => getPerson(personId),
    enabled: !!personId,
  });

  const defaultGender: "M" | "F" = focal?.gender === "M" ? "F" : "M";
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"M" | "F">(defaultGender);
  const [genderTouched, setGenderTouched] = useState(false);
  const [birth, setBirth] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [death, setDeath] = useState<CalendarDateValue>(
    EMPTY_LUNAR_CALENDAR_DATE,
  );
  const [isLiving, setIsLiving] = useState(true);
  const nameRef = useRef<HTMLInputElement>(null);

  if (focal && !genderTouched && gender !== defaultGender) {
    setGender(defaultGender);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!focal) throw new Error("Thiếu thông tin");
      const spouse = await createPerson({
        clan_id: clanId,
        full_name: name.trim(),
        gender,
        ...birthDeathPayload(birth, death, isLiving),
      });
      await findOrCreateFamily({
        clanId,
        partnerA: { id: focal.id, gender: focal.gender },
        partnerB: { id: spouse.id, gender },
      });
      return spouse;
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId);
      toast.success("Đã thêm vợ/chồng", { description: name.trim() });
      setName("");
      setBirth(EMPTY_CALENDAR_DATE);
      setDeath(EMPTY_LUNAR_CALENDAR_DATE);
      setIsLiving(true);
      nameRef.current?.focus();
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || mutation.isPending) return;
        mutation.mutate();
      }}
      className="space-y-5 pb-6"
    >
      {onBack && <BackToPickerButton onBack={onBack} />}

      <div className="space-y-2">
        <Label htmlFor="quick_spouse_name" required>
          Tên vợ / chồng
        </Label>
        <Input
          id="quick_spouse_name"
          icon={<IconUser />}
          ref={nameRef}
          required
          autoFocus
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vd: Trần Thị B"
        />
      </div>

      <div className="flex flex-col items-start gap-2">
        <Label>Giới tính</Label>
        <GenderToggle
          value={gender}
          onChange={(g) => {
            setGender(g);
            setGenderTouched(true);
          }}
        />
      </div>

      <DateFields
        idPrefix="qa-spouse"
        birth={birth}
        death={death}
        isLiving={isLiving}
        onBirth={setBirth}
        onDeath={setDeath}
        onLiving={setIsLiving}
      />

      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-card border-t flex gap-2 z-10">
        <Button
          type="submit"
          className="flex-1"
          disabled={mutation.isPending || !name.trim()}
        >
          <IconCheck className="h-4 w-4 mr-1.5" />
          Lưu & thêm người nữa
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          className="shrink-0"
        >
          Xong
        </Button>
      </div>
    </form>
  );
}

// ─── Phase B3: Quick add parent ───────────────────────────────────

function QuickAddParent({
  clanId,
  personId,
  onBack,
  onDone,
}: {
  clanId: string;
  personId: string;
  onBack: (() => void) | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const { data: focal } = useQuery({
    queryKey: queryKeys.person(personId, userId),
    queryFn: () => getPerson(personId),
    enabled: !!personId,
  });
  const { data: rels } = useQuery({
    queryKey: queryKeys.personRelationships(personId, userId),
    queryFn: () => getPersonRelationships(personId),
    enabled: !!personId,
  });

  const hasFather = !!rels?.parents.find((p) => p.gender === "M");
  const hasMother = !!rels?.parents.find((p) => p.gender === "F");
  const defaultRole: "M" | "F" = !hasFather ? "M" : !hasMother ? "F" : "M";

  const [name, setName] = useState("");
  const [role, setRole] = useState<"M" | "F">(defaultRole);
  const [roleTouched, setRoleTouched] = useState(false);
  const [birth, setBirth] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [death, setDeath] = useState<CalendarDateValue>(
    EMPTY_LUNAR_CALENDAR_DATE,
  );
  const [isLiving, setIsLiving] = useState(true);
  const nameRef = useRef<HTMLInputElement>(null);

  if (rels && !roleTouched && role !== defaultRole) {
    setRole(defaultRole);
  }

  // Parent commonly shares surname with focal. Prefill on first load.
  const focalSurname = focal
    ? focal.full_name.trim().split(/\s+/)[0] ?? ""
    : "";
  const parentPrefix = focalSurname ? focalSurname + " " : "";
  const parentInitRef = useRef(false);
  useEffect(() => {
    if (parentInitRef.current) return;
    if (!focal) return;
    if (parentPrefix) {
      setName(parentPrefix);
      setTimeout(() => focusAtEnd(nameRef.current), 0);
    }
    parentInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focal]);

  const bothFilled = hasFather && hasMother;
  // Auto-infer Cha/Mẹ from the typed name, but only when both slots
  // are still empty. Once one slot is filled the other role is forced
  // anyway (the opposite button is disabled), so inference would just
  // fight the user.
  const canInferRole = !hasFather && !hasMother;
  function onParentNameChange(v: string) {
    setName(v);
    if (!roleTouched && canInferRole) {
      const inferred = inferGenderFromName(v);
      if (inferred) setRole(inferred);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!focal) throw new Error("Thiếu thông tin");
      const parent = await createPerson({
        clan_id: clanId,
        full_name: name.trim(),
        gender: role,
        ...birthDeathPayload(birth, death, isLiving),
      });
      const existingOther = rels?.parents.find((p) => p.gender !== role);
      const family = await findOrCreateFamily({
        clanId,
        partnerA: { id: parent.id, gender: role },
        partnerB: existingOther
          ? { id: existingOther.id, gender: existingOther.gender }
          : null,
      });
      await updatePerson(focal.id, { birth_family_id: family.id });
      return { roleAdded: role };
    },
    onSuccess: async ({ roleAdded }) => {
      await invalidateClanData(queryClient, clanId);
      toast.success(
        roleAdded === "M" ? "Đã thêm cha" : "Đã thêm mẹ",
        { description: name.trim() },
      );
      const willBeBoth =
        (roleAdded === "M" && hasMother) || (roleAdded === "F" && hasFather);
      if (willBeBoth) {
        onDone();
      } else {
        setRole(roleAdded === "M" ? "F" : "M");
        setRoleTouched(true);
        setName(parentPrefix);
        setBirth(EMPTY_CALENDAR_DATE);
        setDeath(EMPTY_LUNAR_CALENDAR_DATE);
        setIsLiving(true);
        setTimeout(() => focusAtEnd(nameRef.current), 0);
      }
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  if (bothFilled) {
    return (
      <div className="space-y-5 pb-6">
        {onBack && <BackToPickerButton onBack={onBack} />}
        <p className="text-sm text-muted-foreground">
          {focal?.full_name ?? "Người này"} đã có đủ cha và mẹ trên cây.
          Sửa thông tin cha/mẹ qua icon bút chì.
        </p>
        <Button type="button" variant="outline" onClick={onDone}>
          Đóng
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || mutation.isPending) return;
        mutation.mutate();
      }}
      className="space-y-5 pb-6"
    >
      {onBack && <BackToPickerButton onBack={onBack} />}

      <div className="space-y-2">
        <Label htmlFor="quick_parent_name" required>
          Tên {role === "M" ? "cha" : "mẹ"}
        </Label>
        <Input
          id="quick_parent_name"
          icon={<IconUser />}
          ref={nameRef}
          required
          autoFocus
          maxLength={200}
          value={name}
          onChange={(e) => onParentNameChange(e.target.value)}
          placeholder={role === "M" ? "Vd: Nguyễn Văn A" : "Vd: Trần Thị B"}
        />
      </div>

      <div className="flex flex-col items-start gap-2">
        <Label>Vai trò</Label>
        <SegmentedControl ariaLabel="Vai trò cha mẹ">
          <SegmentedButton
            active={role === "M"}
            onClick={() => {
              setRole("M");
              setRoleTouched(true);
            }}
            disabled={hasFather}
          >
            Cha
          </SegmentedButton>
          <SegmentedButton
            active={role === "F"}
            onClick={() => {
              setRole("F");
              setRoleTouched(true);
            }}
            disabled={hasMother}
          >
            Mẹ
          </SegmentedButton>
        </SegmentedControl>
      </div>

      <DateFields
        idPrefix="qa-parent"
        birth={birth}
        death={death}
        isLiving={isLiving}
        onBirth={setBirth}
        onDeath={setDeath}
        onLiving={setIsLiving}
      />

      <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-card border-t flex gap-2 z-10">
        <Button
          type="submit"
          className="flex-1"
          disabled={mutation.isPending || !name.trim()}
        >
          <IconCheck className="h-4 w-4 mr-1.5" />
          Lưu
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          className="shrink-0"
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}
