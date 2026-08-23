import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useToast } from "@/components/Toast";
import {
  IconCalendar,
  IconCheck,
  IconGrave,
  IconMail,
  IconMapPin,
  IconSend,
  IconUser,
  IconUsers,
  IconX,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import {
  submitContribution,
  submitGuestContribution,
  type AddPersonRelation,
  type ContributionType,
  type EditPersonChanges,
} from "@/lib/queries/contributions";

// ─── Props ───────────────────────────────────────────────────────

export interface FocalPerson {
  id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  birth_date: string | null;
  death_date: string | null;
  courtesy_name?: string | null;
  birth_place?: string | null;
  burial_place?: string | null;
  bio?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  clanId: string;
  focalPerson: FocalPerson;
  /** When the page is being viewed by an authenticated member. */
  userId?: string;
  /**
   * When set, this dialog runs in guest mode and submits via the
   * submit-contribution edge function using this share-link token.
   * Required when `userId` is omitted.
   */
  shareToken?: string;
  onSuccess?: () => void;
}

type Mode = "edit_person" | "add_note" | "add_person";
type AddPersonAs = "spouse" | "child";

/**
 * Modal for proposing edits on a person. Three modes:
 *   - edit_person: tweak the focal's most-edited fields (name, dates,
 *     places, bio). Lunar dates + tên tự/húy/thụy are admin-only;
 *     keep the form short for the common case.
 *   - add_note: append a paragraph to the bio. Lightest weight; good
 *     for "cụ làm hương trưởng làng X" style supplemental info.
 *   - add_person: propose adding a new person related to the focal
 *     (spouse OR child).
 *
 * Auth modes — both go through the same component:
 *   - Member (userId set): direct INSERT via supabase-js; RLS pins
 *     submitter_user_id to auth.uid().
 *   - Guest (shareToken set): POSTs to the submit-contribution edge
 *     function which validates the share link and inserts with the
 *     service role.
 */
export function ContributeDialog({
  open,
  onClose,
  clanId,
  focalPerson,
  userId,
  shareToken,
  onSuccess,
}: Props) {
  const toast = useToast();
  const isGuest = !userId;

  const [mode, setMode] = useState<Mode>("edit_person");
  const [submitted, setSubmitted] = useState(false);

  // edit_person fields — prefilled from focal
  const [editName, setEditName] = useState("");
  const [editIsLiving, setEditIsLiving] = useState(true);
  const [editBirthYear, setEditBirthYear] = useState("");
  const [editDeathYear, setEditDeathYear] = useState("");
  const [editBirthPlace, setEditBirthPlace] = useState("");
  const [editBurialPlace, setEditBurialPlace] = useState("");

  // add_note field
  const [noteAddition, setNoteAddition] = useState("");

  // add_person fields
  const [addAs, setAddAs] = useState<AddPersonAs>("child");
  const [addName, setAddName] = useState("");
  const [addGender, setAddGender] = useState<"M" | "F">("M");
  const [addIsLiving, setAddIsLiving] = useState(true);
  const [addBirthYear, setAddBirthYear] = useState("");
  const [addDeathYear, setAddDeathYear] = useState("");
  const [addBio, setAddBio] = useState("");

  // Submitter (always required)
  const [submitterName, setSubmitterName] = useState("");
  const [submitterContact, setSubmitterContact] = useState("");
  const [submitterRelation, setSubmitterRelation] = useState("");
  const [submitterNote, setSubmitterNote] = useState("");

  // Reset whenever the dialog reopens — and prefill edit form.
  useEffect(() => {
    if (!open) return;
    setMode("edit_person");
    setSubmitted(false);
    setEditName(focalPerson.full_name);
    setEditIsLiving(focalPerson.is_living);
    setEditBirthYear(focalPerson.birth_date?.slice(0, 4) ?? "");
    setEditDeathYear(focalPerson.death_date?.slice(0, 4) ?? "");
    setEditBirthPlace(focalPerson.birth_place ?? "");
    setEditBurialPlace(focalPerson.burial_place ?? "");
    setNoteAddition("");
    setAddAs("child");
    setAddName("");
    setAddGender("M");
    setAddIsLiving(true);
    setAddBirthYear("");
    setAddDeathYear("");
    setAddBio("");
    setSubmitterName("");
    setSubmitterContact("");
    setSubmitterRelation("");
    setSubmitterNote("");
  }, [open, focalPerson]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // ─── Build payload ────────────────────────────────────────────
  function buildPayload(): { type: ContributionType; data: unknown } | null {
    if (mode === "edit_person") {
      const changes: EditPersonChanges = {};
      const original: Partial<EditPersonChanges> = {};
      if (editName.trim() !== focalPerson.full_name) {
        changes.full_name = editName.trim();
        original.full_name = focalPerson.full_name;
      }
      if (editIsLiving !== focalPerson.is_living) {
        changes.is_living = editIsLiving;
        original.is_living = focalPerson.is_living;
      }
      const editBirth = editBirthYear ? `${editBirthYear}-01-01` : null;
      const focBirthYear = focalPerson.birth_date?.slice(0, 4) ?? null;
      if (editBirthYear !== (focBirthYear ?? "")) {
        changes.birth_date = editBirth;
        changes.birth_date_precision = editBirth ? "year" : null;
        original.birth_date = focalPerson.birth_date;
      }
      const editDeath = editDeathYear ? `${editDeathYear}-01-01` : null;
      const focDeathYear = focalPerson.death_date?.slice(0, 4) ?? null;
      if (editDeathYear !== (focDeathYear ?? "")) {
        changes.death_date = editDeath;
        changes.death_date_precision = editDeath ? "year" : null;
        original.death_date = focalPerson.death_date;
      }
      if (editBirthPlace.trim() !== (focalPerson.birth_place ?? "")) {
        changes.birth_place = editBirthPlace.trim() || null;
        original.birth_place = focalPerson.birth_place ?? null;
      }
      if (editBurialPlace.trim() !== (focalPerson.burial_place ?? "")) {
        changes.burial_place = editBurialPlace.trim() || null;
        original.burial_place = focalPerson.burial_place ?? null;
      }
      if (Object.keys(changes).length === 0) return null;
      return { type: "edit_person", data: { changes, original } };
    }

    if (mode === "add_note") {
      const text = noteAddition.trim();
      if (!text) return null;
      return { type: "add_note", data: { note_addition: text } };
    }

    // add_person
    const name = addName.trim();
    if (!name) return null;
    const relation: AddPersonRelation = {
      as: addAs,
      of_person_id: focalPerson.id,
    };
    return {
      type: "add_person",
      data: {
        full_name: name,
        gender: addGender,
        is_living: addIsLiving,
        birth_date: addBirthYear ? `${addBirthYear}-01-01` : null,
        birth_date_precision: addBirthYear ? "year" : null,
        death_date: addDeathYear ? `${addDeathYear}-01-01` : null,
        death_date_precision: addDeathYear ? "year" : null,
        bio: addBio.trim() || null,
        relation,
      },
    };
  }

  // ─── Submit ──────────────────────────────────────────────────
  const m = useMutation({
    mutationFn: async () => {
      const built = buildPayload();
      if (!built) throw new Error("Chưa có gì thay đổi để đề xuất");
      const relation = submitterRelation.trim();
      if (!relation) throw new Error("Cần ghi quan hệ của bạn với người này");
      const note = submitterNote.trim();

      if (isGuest) {
        const name = submitterName.trim();
        const contact = submitterContact.trim();
        if (!name) throw new Error("Cần tên người gửi");
        if (!contact && !note) {
          throw new Error("Cần email/sđt liên hệ hoặc ghi chú");
        }
        if (!shareToken) {
          throw new Error("Thiếu token chia sẻ");
        }
        await submitGuestContribution({
          token: shareToken,
          contribution_type: built.type,
          person_id: built.type === "add_person" ? null : focalPerson.id,
          proposed_data: built.data,
          submitter_name: name,
          submitter_contact: contact || undefined,
          submitter_relation: relation,
          submitter_note: note || undefined,
        });
      } else {
        await submitContribution(
          {
            clan_id: clanId,
            person_id: built.type === "add_person" ? null : focalPerson.id,
            contribution_type: built.type,
            proposed_data: built.data,
            submitter_relation: relation,
            submitter_note: note || null,
          },
          userId,
        );
      }
    },
    onSuccess: () => {
      setSubmitted(true);
      track("contribution_submitted", { kind: mode, guest: isGuest });
      toast.success("Đã gửi đề xuất");
      onSuccess?.();
    },
    onError: (e) =>
      toast.error("Không gửi được", { description: (e as Error).message }),
  });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    // Two-layer scroll pattern: outer is fixed + scrollable, inner
    // wrapper has min-h-full so flex centering still works when the
    // content fits, but the modal can grow past viewport and stay
    // fully reachable by scrolling — items-start guarantees the top
    // (title + close button) is always above the fold.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Đề xuất sửa thông tin"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/40"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start justify-center p-2 sm:p-4">
        <div
          className="relative w-full max-w-xl rounded-lg bg-card p-4 sm:p-5 shadow-xl my-4 sm:my-8"
          onClick={(e) => e.stopPropagation()}
        >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
        >
          <IconX className="h-5 w-5" />
        </button>

        <h2 className="clan-name text-lg font-semibold text-primary pr-9">
          Đề xuất cho {focalPerson.full_name}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Admin sẽ xem xét trước khi áp dụng. Đề xuất của bạn không tự
          động sửa cây gia phả.
        </p>

        {submitted ? (
          <div className="mt-5 py-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-accent/15 inline-flex items-center justify-center text-accent">
              <IconCheck className="h-8 w-8" />
            </div>
            <p className="font-medium">Đã gửi đề xuất.</p>
            <p className="text-sm text-muted-foreground">
              Admin sẽ liên hệ qua{" "}
              {submitterContact || "thông tin bạn đã ghi"} nếu cần.
            </p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Đóng
            </Button>
          </div>
        ) : (
          <>
            {/* Mode tabs */}
            <div
              className="mt-4 inline-flex flex-wrap rounded-md border bg-background overflow-hidden text-sm"
              role="group"
              aria-label="Loại đề xuất"
            >
              <ModeTab
                active={mode === "edit_person"}
                onClick={() => setMode("edit_person")}
                label="Sửa thông tin"
              />
              <ModeTab
                active={mode === "add_note"}
                onClick={() => setMode("add_note")}
                label="Bổ sung tiểu sử"
              />
              <ModeTab
                active={mode === "add_person"}
                onClick={() => setMode("add_person")}
                label="Thêm vợ/chồng/con"
              />
            </div>

            {/* Mode body */}
            <div className="mt-4 space-y-3">
              {mode === "edit_person" && (
                <>
                  <Field label="Họ và tên">
                    <Input
                      icon={<IconUser />}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!editIsLiving}
                        onChange={(e) => setEditIsLiving(!e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span>Đã mất</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Năm sinh">
                      <Input
                        icon={<IconCalendar />}
                        type="number"
                        inputMode="numeric"
                        value={editBirthYear}
                        onChange={(e) => setEditBirthYear(e.target.value)}
                        placeholder="1920"
                      />
                    </Field>
                    {!editIsLiving && (
                      <Field label="Năm mất">
                        <Input
                          icon={<IconCalendar />}
                          type="number"
                          inputMode="numeric"
                          value={editDeathYear}
                          onChange={(e) => setEditDeathYear(e.target.value)}
                          placeholder="1990"
                        />
                      </Field>
                    )}
                  </div>
                  <Field label="Nơi sinh">
                    <Input
                      icon={<IconMapPin />}
                      value={editBirthPlace}
                      onChange={(e) => setEditBirthPlace(e.target.value)}
                    />
                  </Field>
                  {!editIsLiving && (
                    <Field label="Nơi an táng">
                      <Input
                        icon={<IconGrave />}
                        value={editBurialPlace}
                        onChange={(e) => setEditBurialPlace(e.target.value)}
                      />
                    </Field>
                  )}
                  <p className="text-xs text-muted-foreground italic">
                    Để thêm thông tin tiểu sử (cụ làm gì, sống ở đâu…),
                    chuyển sang tab <span className="font-medium">Bổ sung tiểu sử</span>.
                  </p>
                </>
              )}

              {mode === "add_note" && (
                <Field label="Nội dung bổ sung tiểu sử">
                  <Textarea
                    value={noteAddition}
                    onChange={(e) => setNoteAddition(e.target.value)}
                    rows={5}
                    placeholder="Cụ từng làm hương trưởng làng X từ 1932 đến 1945…"
                    className="text-sm"
                  />
                </Field>
              )}

              {mode === "add_person" && (
                <>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="text-muted-foreground">Quan hệ:</span>
                    <div className="inline-flex rounded-md border bg-background overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setAddAs("child")}
                        aria-pressed={addAs === "child"}
                        className={`px-3 h-9 ${
                          addAs === "child"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        Là con của {focalPerson.full_name}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddAs("spouse")}
                        aria-pressed={addAs === "spouse"}
                        className={`px-3 h-9 border-l ${
                          addAs === "spouse"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        Là vợ / chồng
                      </button>
                    </div>
                  </div>
                  <Field label="Họ và tên">
                    <Input
                      icon={<IconUser />}
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                    />
                  </Field>
                  <div className="flex items-center gap-4 text-sm">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="add_gender"
                        checked={addGender === "M"}
                        onChange={() => setAddGender("M")}
                      />
                      <span>Nam</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="add_gender"
                        checked={addGender === "F"}
                        onChange={() => setAddGender("F")}
                      />
                      <span>Nữ</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer ml-auto">
                      <input
                        type="checkbox"
                        checked={!addIsLiving}
                        onChange={(e) => setAddIsLiving(!e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span>Đã mất</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Năm sinh">
                      <Input
                        icon={<IconCalendar />}
                        type="number"
                        value={addBirthYear}
                        onChange={(e) => setAddBirthYear(e.target.value)}
                        placeholder="1950"
                      />
                    </Field>
                    {!addIsLiving && (
                      <Field label="Năm mất">
                        <Input
                          icon={<IconCalendar />}
                          type="number"
                          value={addDeathYear}
                          onChange={(e) => setAddDeathYear(e.target.value)}
                        />
                      </Field>
                    )}
                  </div>
                  <Field label="Ghi chú">
                    <Textarea
                      value={addBio}
                      onChange={(e) => setAddBio(e.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                  </Field>
                </>
              )}
            </div>

            {/* Submitter identity */}
            <div className="mt-5 pt-4 border-t space-y-3">
              <p className="text-xs text-muted-foreground">
                Thông tin liên hệ — admin có thể cần xác nhận với bạn.
              </p>
              {isGuest && (
                <>
                  <Field label="Tên của bạn">
                    <Input
                      icon={<IconUser />}
                      value={submitterName}
                      onChange={(e) => setSubmitterName(e.target.value)}
                      placeholder="Nguyễn Văn B"
                    />
                  </Field>
                  <Field label="Email hoặc số điện thoại">
                    <Input
                      icon={<IconMail />}
                      value={submitterContact}
                      onChange={(e) => setSubmitterContact(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </Field>
                </>
              )}
              <Field
                label={`Quan hệ của bạn với ${focalPerson.full_name}`}
              >
                <Input
                  icon={<IconUsers />}
                  value={submitterRelation}
                  onChange={(e) => setSubmitterRelation(e.target.value)}
                  placeholder="cháu nội, em họ, khách…"
                />
              </Field>
              <Field label="Ghi chú / nguồn (tuỳ chọn)">
                <Textarea
                  value={submitterNote}
                  onChange={(e) => setSubmitterNote(e.target.value)}
                  rows={2}
                  placeholder="Tôi có giấy chứng tử, hoặc bố tôi kể lại…"
                  className="text-sm"
                />
              </Field>
            </div>

            {m.error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  {(m.error as Error).message}
                </AlertDescription>
              </Alert>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Huỷ
              </Button>
              <Button
                size="sm"
                onClick={() => m.mutate()}
                disabled={m.isPending}
              >
                <IconSend className="h-4 w-4 mr-1.5" />
                {m.isPending ? "Đang gửi…" : "Gửi đề xuất"}
              </Button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Local helpers ───────────────────────────────────────────────

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 h-9 border-l first:border-l-0 ${
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-muted/50"
      }`}
    >
      {label}
    </button>
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
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
