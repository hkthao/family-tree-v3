import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { BirthOrderPicker } from "@/components/BirthOrderPicker";
import { CalendarDateInput } from "@/components/CalendarDateInput";
import { IconCheck, IconChevronUp, IconPlus, IconX } from "@/components/icons";
import { PhotoUploadField } from "@/components/PhotoUploadField";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";
import { invalidateClanData } from "@/lib/cache";
import {
  buildDeathAnniversary,
  buildPersonDateColumns,
  EMPTY_CALENDAR_DATE,
  loadCalendarDateValue,
  type CalendarDateValue,
} from "@/lib/personDates";
import { queryKeys } from "@/lib/queries/keys";
import { getPerson, updatePerson } from "@/lib/queries/persons";

interface EditPersonFormProps {
  clanId: string;
  personId: string;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * Embeddable edit form — used by the /edit route AND by the inline
 * sheet on /tree so users can fix a card without losing their place
 * in the tree.
 */
export function EditPersonForm({
  clanId,
  personId,
  onSaved,
  onCancel,
}: EditPersonFormProps) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: person, isLoading } = useQuery({
    queryKey: queryKeys.person(personId, userId),
    queryFn: () => getPerson(personId),
    enabled: !!personId,
  });

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [isLiving, setIsLiving] = useState(true);
  const [isRoot, setIsRoot] = useState(false);
  const [birth, setBirth] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [death, setDeath] = useState<CalendarDateValue>(EMPTY_CALENDAR_DATE);
  const [birthPlace, setBirthPlace] = useState("");
  const [burialPlace, setBurialPlace] = useState("");
  const [courtesyName, setCourtesyName] = useState("");
  const [nickname, setNickname] = useState("");
  const [posthumousName, setPosthumousName] = useState("");
  const [bio, setBio] = useState("");
  const [todoExcluded, setTodoExcluded] = useState(false);
  const [birthOrder, setBirthOrder] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  // Progressive disclosure for the optional fields. Auto-opens when
  // any of them is already filled so existing data isn't hidden after
  // the person loads.
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    if (!person) return;
    setFullName(person.full_name);
    setGender(person.gender);
    setIsLiving(person.is_living);
    setIsRoot(person.is_root);
    setBirth(
      loadCalendarDateValue({
        solarDate: person.birth_date,
        solarPrecision: person.birth_date_precision,
        lunarYear: person.birth_lunar_year,
        lunarMonth: person.birth_lunar_month,
        lunarDay: person.birth_lunar_day,
      }),
    );
    setDeath(
      loadCalendarDateValue({
        solarDate: person.death_date,
        solarPrecision: person.death_date_precision,
        lunarYear: person.death_lunar_year,
        lunarMonth: person.death_lunar_month,
        lunarDay: person.death_lunar_day,
      }),
    );
    setBirthPlace(person.birth_place ?? "");
    setBurialPlace(person.burial_place ?? "");
    setCourtesyName(person.courtesy_name ?? "");
    setNickname(person.nickname ?? "");
    setPosthumousName(person.posthumous_name ?? "");
    setBio(person.bio ?? "");
    setTodoExcluded(person.todo_excluded ?? false);
    setBirthOrder(person.birth_order != null ? String(person.birth_order) : "");
    if (
      person.courtesy_name ||
      person.nickname ||
      person.posthumous_name ||
      person.birth_place ||
      person.burial_place ||
      person.bio ||
      person.death_date ||
      person.birth_order != null ||
      person.todo_excluded
    ) {
      setShowOptional(true);
    }
  }, [person]);

  const mutation = useMutation({
    mutationFn: async () => {
      const birthCols = buildPersonDateColumns(birth);
      const deathCols = buildPersonDateColumns(death);
      const anniv = buildDeathAnniversary(death);
      return updatePerson(personId, {
        full_name: fullName.trim(),
        gender,
        is_living: isLiving,
        is_root: isRoot,
        todo_excluded: todoExcluded,
        birth_order: birthOrder.trim()
          ? Math.max(1, Math.floor(Number(birthOrder)))
          : null,
        birth_date: birthCols.solar_date,
        birth_date_precision: birthCols.solar_precision,
        death_date: deathCols.solar_date,
        death_date_precision: deathCols.solar_precision,
        birth_lunar_year: birthCols.lunar_year,
        birth_lunar_month: birthCols.lunar_month,
        birth_lunar_day: birthCols.lunar_day,
        birth_lunar_is_leap: birthCols.lunar_is_leap,
        death_lunar_year: deathCols.lunar_year,
        death_lunar_month: deathCols.lunar_month,
        death_lunar_day: deathCols.lunar_day,
        death_lunar_is_leap: deathCols.lunar_is_leap,
        death_anniv_lunar_month: anniv.death_anniv_lunar_month,
        death_anniv_lunar_day: anniv.death_anniv_lunar_day,
        death_anniv_lunar_is_leap: anniv.death_anniv_lunar_is_leap,
        birth_place: birthPlace || null,
        burial_place: burialPlace || null,
        courtesy_name: courtesyName.trim() || null,
        nickname: nickname.trim() || null,
        posthumous_name: posthumousName.trim() || null,
        bio: bio || null,
      });
    },
    onSuccess: async () => {
      track("person_edited");
      await invalidateClanData(queryClient, clanId);
      toast.success("Đã lưu thay đổi");
      onSaved();
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải…</p>;
  }
  if (!person) return null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(null);
        if (!fullName.trim()) return;
        try {
          buildPersonDateColumns(birth);
          buildPersonDateColumns(death);
        } catch (err) {
          setFormError((err as Error).message);
          return;
        }
        mutation.mutate();
      }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label>Ảnh đại diện</Label>
        <PhotoUploadField
          clanId={clanId}
          personId={personId}
          gender={gender}
          photoPath={person.photo_path ?? null}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="full_name" required>
          Họ và tên
        </Label>
        <Input
          id="full_name"
          required
          maxLength={200}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-base font-medium mb-2">Giới tính</legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              checked={gender === "M"}
              onChange={() => setGender("M")}
              className="h-4 w-4 accent-primary"
            />
            <span>Nam</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              checked={gender === "F"}
              onChange={() => setGender("F")}
              className="h-4 w-4 accent-primary"
            />
            <span>Nữ</span>
          </label>
        </div>
      </fieldset>

      <CalendarDateInput
        label="Ngày sinh"
        idPrefix="birth"
        value={birth}
        onChange={setBirth}
        helperText="Chỉ nhớ năm cũng được — bỏ trống ngày, tháng. Bấm 'Nhập theo lịch Âm' nếu bia mộ ghi ngày âm."
      />

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={!isLiving}
          onChange={(e) => setIsLiving(!e.target.checked)}
          className="h-5 w-5 accent-primary shrink-0"
        />
        <span>Đã mất</span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isRoot}
          onChange={(e) => setIsRoot(e.target.checked)}
          className="mt-1 h-5 w-5 accent-primary shrink-0"
        />
        <span>
          <span className="font-medium">Thuỷ tổ</span>
          <span className="block text-sm text-muted-foreground">
            Khi bật, đời = 1; trigger tự cập nhật đời cho con cháu.
          </span>
        </span>
      </label>

      {!showOptional ? (
        <button
          type="button"
          onClick={() => setShowOptional(true)}
          className="w-full text-left rounded-md border border-dashed bg-muted/30 px-4 py-3 hover:bg-muted/60 hover:border-primary transition-colors"
        >
          <div className="flex items-start gap-3">
            <IconPlus className="h-5 w-5 mt-0.5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-foreground">
                Sửa chi tiết khác
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Tên tự, tên húy, tên thụy, ngày mất, con thứ mấy,
                nơi sinh, nơi an táng, tiểu sử. Bỏ qua nếu chưa cần.
              </div>
            </div>
          </div>
        </button>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Chi tiết bổ sung
            </span>
            <button
              type="button"
              onClick={() => setShowOptional(false)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <IconChevronUp className="h-3.5 w-3.5" />
              Thu gọn
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="courtesy_name">Tên tự</Label>
            <Input
              id="courtesy_name"
              maxLength={100}
              value={courtesyName}
              onChange={(e) => setCourtesyName(e.target.value)}
              placeholder="Tên đặt khi trưởng thành, dùng nơi trang trọng"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Tên húy</Label>
            <Input
              id="nickname"
              maxLength={100}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Tên khai sinh, kiêng gọi sau khi mất"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="posthumous_name">Tên thụy</Label>
            <Input
              id="posthumous_name"
              maxLength={100}
              value={posthumousName}
              onChange={(e) => setPosthumousName(e.target.value)}
              placeholder="Tên đặt khi mất, dùng trong văn cúng"
            />
          </div>

          <CalendarDateInput
            label="Ngày mất (nếu đã mất)"
            idPrefix="death"
            value={death}
            onChange={(next) => {
              setDeath(next);
              if (next.parts.year) setIsLiving(false);
            }}
            helperText="Khi nhập ngày âm đầy đủ, ngày giỗ tự sinh từ tháng/ngày âm."
          />

          <BirthOrderPicker value={birthOrder} onChange={setBirthOrder} />

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={todoExcluded}
              onChange={(e) => setTodoExcluded(e.target.checked)}
              className="mt-1 h-5 w-5 accent-primary shrink-0"
            />
            <span>
              <span className="font-medium">
                Loại khỏi "Việc cần làm"
              </span>
              <span className="block text-sm text-muted-foreground">
                Bật khi thông tin thiếu là <em>cố ý</em> hoặc không
                thể bổ sung (vd. thuỷ tổ không có cha mẹ, người mất
                tích không rõ năm sinh/mất). App sẽ không nhắc nữa.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="birth_place">Nơi sinh</Label>
            <Input
              id="birth_place"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="burial_place">Nơi an táng</Label>
            <Input
              id="burial_place"
              value={burialPlace}
              onChange={(e) => setBurialPlace(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Tiểu sử</Label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}

      {(formError || mutation.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {formError ?? (mutation.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-0 -mx-5 px-5 py-3 bg-card border-t flex gap-3 z-10">
        <Button
          type="submit"
          className="flex-1 sm:flex-none"
          disabled={mutation.isPending || !fullName.trim()}
        >
          {mutation.isPending ? (
            "Đang lưu…"
          ) : (
            <>
              <IconCheck className="h-4 w-4 mr-1.5" />
              Lưu
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 sm:flex-none"
          onClick={onCancel}
        >
          <IconX className="h-4 w-4 mr-1.5" />
          Hủy
        </Button>
      </div>
    </form>
  );
}

export default function EditPerson() {
  const { clanId, personId } = useParams<{ clanId: string; personId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromQs = searchParams.get("from") === "tree" ? "?from=tree" : "";

  if (!clanId || !personId) return null;
  const back = `/clans/${clanId}/people/${personId}${fromQs}`;

  return (
    <div className="space-y-6">
      <nav>
        <BackLink fallback={back} />
      </nav>

      <h1 className="text-2xl font-semibold">Sửa thông tin</h1>

      <EditPersonForm
        clanId={clanId}
        personId={personId}
        onSaved={() => navigate(back)}
        onCancel={() => navigate(back)}
      />
    </div>
  );
}

