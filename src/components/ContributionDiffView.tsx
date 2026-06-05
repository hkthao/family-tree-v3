import type {
  AddPersonPayload,
  ContributionRow,
  EditPersonChanges,
  EditPersonPayload,
} from "@/lib/queries/contributions";
import type { PersonDetail } from "@/lib/queries/persons";

interface Props {
  contribution: ContributionRow;
  /** Current state of the target person (when contribution is on an
   *  existing person). Drives the "Hiện tại" column of the diff. */
  currentPerson?: PersonDetail | null;
}

/**
 * Side-by-side diff render for a pending contribution. Shape depends
 * on contribution_type:
 *   - edit_person: list each changed field with old vs new
 *   - add_note: show current bio + appended note
 *   - add_person: render the proposed person card + relation hint
 *
 * Pure presentational — caller owns the approve/reject mutations.
 */
export function ContributionDiffView({ contribution, currentPerson }: Props) {
  if (contribution.contribution_type === "edit_person") {
    return (
      <EditPersonDiff
        payload={contribution.proposed_data as EditPersonPayload}
        currentPerson={currentPerson}
      />
    );
  }
  if (contribution.contribution_type === "add_note") {
    return (
      <AddNoteDiff
        note={(contribution.proposed_data as { note_addition: string }).note_addition}
        currentBio={currentPerson?.bio ?? null}
      />
    );
  }
  return (
    <AddPersonDiff
      payload={contribution.proposed_data as AddPersonPayload}
    />
  );
}

// ─── edit_person ─────────────────────────────────────────────────

const EDIT_LABELS: Record<keyof EditPersonChanges, string> = {
  full_name: "Họ và tên",
  courtesy_name: "Tên tự",
  posthumous_name: "Tên thuỵ",
  nickname: "Tên húy",
  gender: "Giới tính",
  is_living: "Còn sống",
  birth_date: "Ngày sinh",
  birth_date_precision: "Độ chính xác ngày sinh",
  death_date: "Ngày mất",
  death_date_precision: "Độ chính xác ngày mất",
  birth_lunar_year: "Năm sinh (âm)",
  birth_lunar_month: "Tháng sinh (âm)",
  birth_lunar_day: "Ngày sinh (âm)",
  death_lunar_year: "Năm mất (âm)",
  death_lunar_month: "Tháng mất (âm)",
  death_lunar_day: "Ngày mất (âm)",
  death_anniv_lunar_month: "Tháng giỗ",
  death_anniv_lunar_day: "Ngày giỗ",
  birth_place: "Nơi sinh",
  burial_place: "Nơi an táng",
  bio: "Tiểu sử",
};

/**
 * One row per changed field: label on top, current value with
 * strikethrough next to an arrow, then the proposed value in
 * primary tint. Bio + place fields with long content get a
 * vertical layout so each value has full width.
 */
function EditPersonDiff({
  payload,
  currentPerson,
}: {
  payload: EditPersonPayload;
  currentPerson?: PersonDetail | null;
}) {
  const changes = payload?.changes ?? {};
  const keys = Object.keys(changes) as (keyof EditPersonChanges)[];
  if (keys.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Không có thay đổi nào trong đề xuất này.
      </p>
    );
  }
  return (
    <ul className="rounded-md border bg-card divide-y">
      {keys.map((k) => {
        const currentVal = formatVal(
          currentPerson?.[k as keyof PersonDetail] ?? null,
        );
        const proposedVal = formatVal(changes[k] ?? null);
        const longField = k === "bio" || currentVal.length > 50 || proposedVal.length > 50;
        return (
          <li key={k} className="px-3 py-3">
            <p className="text-xs text-muted-foreground mb-1.5">
              {EDIT_LABELS[k] ?? k}
            </p>
            {longField ? (
              <div className="space-y-1.5">
                <DiffCell tone="old" value={currentVal} />
                <DiffCell tone="new" value={proposedVal} />
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <DiffCell tone="old" value={currentVal} inline />
                <span aria-hidden="true" className="text-muted-foreground">
                  →
                </span>
                <DiffCell tone="new" value={proposedVal} inline />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DiffCell({
  tone,
  value,
  inline,
}: {
  tone: "old" | "new";
  value: string;
  inline?: boolean;
}) {
  const empty = !value;
  const display = empty ? "(trống)" : value;
  const old = tone === "old";
  return (
    <span
      className={
        inline
          ? // Inline pill — strikethrough for old, solid primary tint
            // for new. Same height as surrounding text.
            `inline-flex items-center px-2 py-0.5 rounded text-sm ${
              old
                ? "bg-muted/60 text-muted-foreground line-through decoration-1"
                : "bg-primary/15 text-foreground font-medium"
            } ${empty ? "italic" : ""}`
          : // Block — used for bio / long places. The strikethrough on
            // multi-line text is awkward, so for old we just dim it
            // heavily; the visual contrast with the highlighted new
            // block makes the change obvious.
            `block whitespace-pre-wrap rounded-md px-3 py-2 text-sm ${
              old
                ? "bg-muted/40 text-muted-foreground"
                : "bg-primary/10 text-foreground border-l-4 border-primary"
            } ${empty ? "italic" : ""}`
      }
    >
      {!inline && (
        <span
          className={`block text-[10px] uppercase tracking-wider mb-0.5 ${
            old ? "text-muted-foreground" : "text-primary"
          }`}
        >
          {old ? "Hiện tại" : "Đề xuất"}
        </span>
      )}
      {display}
    </span>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return v ? "Có" : "Không";
  return String(v);
}

// ─── add_note ────────────────────────────────────────────────────
//
// Show the resulting bio in one block with the new portion visibly
// inserted at the end — left-border + tint highlight. Easier to scan
// than two separate boxes because admins read top-to-bottom and see
// exactly what the bio will look like post-approval.

function AddNoteDiff({
  note,
  currentBio,
}: {
  note: string;
  currentBio: string | null;
}) {
  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/40 text-xs text-muted-foreground border-b">
        Tiểu sử sau khi duyệt
      </div>
      <div className="p-3 space-y-3">
        {currentBio ? (
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {currentBio}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            (tiểu sử hiện tại đang trống)
          </p>
        )}
        <div className="border-l-4 border-primary bg-primary/10 pl-3 py-2 rounded-r">
          <p className="text-[10px] uppercase tracking-wider text-primary mb-0.5">
            + Thêm mới
          </p>
          <p className="text-sm whitespace-pre-wrap">{note}</p>
        </div>
      </div>
    </div>
  );
}

// ─── add_person ──────────────────────────────────────────────────

function AddPersonDiff({ payload }: { payload: AddPersonPayload }) {
  const relation = payload.relation
    ? payload.relation.as === "spouse"
      ? "Vợ / chồng"
      : "Con"
    : null;
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-4 space-y-2 text-sm">
      <p className="text-xs text-primary font-medium">Người mới đề xuất</p>
      <Row label="Họ và tên" value={payload.full_name} />
      <Row label="Giới tính" value={payload.gender === "M" ? "Nam" : "Nữ"} />
      <Row
        label="Tình trạng"
        value={payload.is_living === false ? "Đã mất" : "Còn sống"}
      />
      {payload.birth_date && (
        <Row label="Ngày sinh" value={payload.birth_date} />
      )}
      {payload.death_date && (
        <Row label="Ngày mất" value={payload.death_date} />
      )}
      {payload.birth_place && (
        <Row label="Nơi sinh" value={payload.birth_place} />
      )}
      {payload.burial_place && (
        <Row label="Nơi an táng" value={payload.burial_place} />
      )}
      {payload.bio && <Row label="Ghi chú" value={payload.bio} />}
      {relation && (
        <Row label="Quan hệ" value={`${relation} của người đang xem`} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-medium">{value}</span>
    </div>
  );
}
