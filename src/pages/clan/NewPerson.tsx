import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import { CalendarDateInput } from "@/components/CalendarDateInput";
import { IconCheck, IconChevronUp, IconCopy, IconPlus, IconX } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { invalidateClanData } from "@/lib/cache";
import {
  buildDeathAnniversary,
  buildPersonDateColumns,
  EMPTY_CALENDAR_DATE,
  loadCalendarDateValue,
  type CalendarDateValue,
} from "@/lib/personDates";
import { queryKeys } from "@/lib/queries/keys";
import { track } from "@/lib/analytics";
import { createPerson, getPerson } from "@/lib/queries/persons";

export default function NewPerson() {
  const { clanId } = useParams<{ clanId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const { clan } = useClanContext();
  const userId = user?.id ?? "";

  // When ?from=<personId> is present, this is a "copy" flow: fetch the
  // source person and pre-fill every editable field. Photo and family
  // relationships (parents/spouses/children) are intentionally NOT
  // copied — those would point at the same shared records or be wrong
  // for a near-duplicate, so the user wires them up afterwards.
  const fromId = searchParams.get("from");
  const { data: source } = useQuery({
    queryKey: queryKeys.person(fromId ?? "", userId),
    queryFn: () => getPerson(fromId!),
    enabled: !!fromId && !!userId,
  });
  const isCopy = !!fromId;

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
  const [formError, setFormError] = useState<string | null>(null);
  // Track whether prefill ran once so re-renders don't clobber user edits
  // if the source query refetches.
  const [prefilled, setPrefilled] = useState(false);
  // Set right before mutate() to tell onSuccess whether to navigate
  // away or reset the form for another entry. Ref instead of state so
  // a re-render between click and mutate doesn't race.
  const andContinueRef = useRef(false);
  // Progressive disclosure — optional fields (tên tự/húy/thuỵ, ngày
  // mất, nơi sinh/an táng, tiểu sử) are hidden by default to keep the
  // form short for the common case of "just add a name + birth year".
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    if (!source || prefilled) return;
    setFullName(source.full_name);
    setGender(source.gender);
    setIsLiving(source.is_living);
    // Don't auto-mark a copy as Thuỷ tổ even if the source is — usually
    // a duplicate root is unintended. User can re-tick if needed.
    setIsRoot(false);
    setBirth(
      loadCalendarDateValue({
        solarDate: source.birth_date,
        solarPrecision: source.birth_date_precision,
        lunarYear: source.birth_lunar_year,
        lunarMonth: source.birth_lunar_month,
        lunarDay: source.birth_lunar_day,
      }),
    );
    setDeath(
      loadCalendarDateValue({
        solarDate: source.death_date,
        solarPrecision: source.death_date_precision,
        lunarYear: source.death_lunar_year,
        lunarMonth: source.death_lunar_month,
        lunarDay: source.death_lunar_day,
      }),
    );
    setBirthPlace(source.birth_place ?? "");
    setBurialPlace(source.burial_place ?? "");
    setCourtesyName(source.courtesy_name ?? "");
    setNickname(source.nickname ?? "");
    setPosthumousName(source.posthumous_name ?? "");
    setBio(source.bio ?? "");
    // Reveal optional fields if the source had any of them set —
    // hiding prefilled data behind a collapsed section would be
    // misleading.
    if (
      source.courtesy_name ||
      source.nickname ||
      source.posthumous_name ||
      source.birth_place ||
      source.burial_place ||
      source.bio ||
      source.death_date
    ) {
      setShowOptional(true);
    }
    setPrefilled(true);
  }, [source, prefilled]);

  const mutation = useMutation({
    mutationFn: async () => {
      const birthCols = buildPersonDateColumns(birth);
      const deathCols = buildPersonDateColumns(death);
      const anniv = buildDeathAnniversary(death);
      return createPerson({
        clan_id: clanId!,
        full_name: fullName.trim(),
        gender,
        is_living: isLiving,
        is_root: isRoot,
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
        birth_place: birthPlace.trim() || null,
        burial_place: burialPlace.trim() || null,
        courtesy_name: courtesyName.trim() || null,
        nickname: nickname.trim() || null,
        posthumous_name: posthumousName.trim() || null,
        bio: bio.trim() || null,
      });
    },
    onSuccess: async () => {
      await invalidateClanData(queryClient, clanId!);
      track("person_added", { copy: isCopy });
      const savedName = fullName.trim();
      if (andContinueRef.current) {
        andContinueRef.current = false;
        // Reset the form for the next entry. Keep `isRoot` cleared and
        // gender at the previous choice — a user batch-entering
        // siblings usually keeps gender steady.
        setFullName("");
        setCourtesyName("");
        setNickname("");
        setPosthumousName("");
        setBirth(EMPTY_CALENDAR_DATE);
        setDeath(EMPTY_CALENDAR_DATE);
        setIsLiving(true);
        setIsRoot(false);
        setBirthPlace("");
        setBurialPlace("");
        setBio("");
        setFormError(null);
        toast.success("Đã thêm. Tiếp tục…", { description: savedName });
        // Refocus the name input so the user can type immediately.
        document.getElementById("full_name")?.focus();
        return;
      }
      toast.success(isCopy ? "Đã tạo bản sao" : "Đã thêm người", {
        description: savedName,
      });
      navigate(`/clans/${clanId}/people`);
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  if (!clanId || !user) return null;

  function handleSubmit(e: React.FormEvent, andContinue: boolean) {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim()) return;
    try {
      // Pre-validate so the user sees a clear message before we round-trip
      buildPersonDateColumns(birth);
      buildPersonDateColumns(death);
    } catch (err) {
      setFormError((err as Error).message);
      return;
    }
    andContinueRef.current = andContinue;
    mutation.mutate();
  }

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: "Danh bạ", to: `/clans/${clanId}/people` },
          { label: isCopy ? "Sao chép người" : "Thêm người" },
        ]}
      />

      <PageHeader
        icon={isCopy ? <IconCopy className="h-7 w-7" /> : <IconPlus className="h-7 w-7" />}
        title={isCopy ? "Sao chép người" : "Thêm người"}
        description={
          isCopy
            ? "Tạo bản sao thông tin — không sao chép quan hệ."
            : "Thêm 1 người vào dòng họ. Có thể đánh dấu Thuỷ tổ."
        }
      />
      {isCopy && source && (
        <Alert>
          <AlertDescription>
            Đang sao chép từ <strong>{source.full_name}</strong>. Quan hệ
            cha mẹ / vợ chồng / con không được sao chép — bạn nối lại sau
            khi lưu.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="full_name" required>
            Họ và tên
          </Label>
          <Input
            id="full_name"
            data-testid="person-name-input"
            required
            autoFocus
            maxLength={200}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Vd: Nguyễn Văn A"
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-base font-medium mb-2">Giới tính</legend>
          <div className="flex gap-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="gender"
                value="M"
                checked={gender === "M"}
                onChange={() => setGender("M")}
                className="h-4 w-4 accent-primary"
              />
              <span>Nam</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="gender"
                value="F"
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
          helperText="Chỉ nhớ năm cũng được — bỏ trống ngày, tháng. Bấm 'Nhập theo lịch Âm' nếu tài liệu ghi ngày âm."
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
            data-testid="person-is-root-checkbox"
            checked={isRoot}
            onChange={(e) => setIsRoot(e.target.checked)}
            className="mt-1 h-5 w-5 accent-primary shrink-0"
          />
          <span>
            <span className="font-medium">Thuỷ tổ</span>
            <span className="block text-sm text-muted-foreground">
              Đánh dấu khi đây là gốc của dòng họ (đời 1). Có thể có nhiều
              Thuỷ tổ nếu nhiều chi tách lập.
            </span>
          </span>
        </label>

        {!showOptional ? (
          <button
            type="button"
            data-testid="show-optional-fields"
            onClick={() => setShowOptional(true)}
            className="w-full text-left rounded-md border border-dashed bg-muted/30 px-4 py-3 hover:bg-muted/60 hover:border-primary transition-colors"
          >
            <div className="flex items-start gap-3">
              <IconPlus className="h-5 w-5 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-foreground">
                  Thêm chi tiết khác
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  Bấm để nhập các thông tin tuỳ chọn nếu bạn có:
                  tên tự, tên húy, tên thụy, ngày mất, nơi sinh,
                  nơi an táng, tiểu sử. Bỏ qua nếu chưa cần — vẫn
                  lưu được người mới.
                </div>
              </div>
            </div>
          </button>
        ) : (
          <div className="space-y-3">
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="courtesy_name">Tên tự</Label>
                <Input
                  id="courtesy_name"
                  maxLength={100}
                  value={courtesyName}
                  onChange={(e) => setCourtesyName(e.target.value)}
                  placeholder="(tuỳ chọn)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nickname">Tên húy / biệt hiệu</Label>
                <Input
                  id="nickname"
                  maxLength={100}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="(tuỳ chọn)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="posthumous_name">Tên thụy</Label>
                <Input
                  id="posthumous_name"
                  maxLength={100}
                  value={posthumousName}
                  onChange={(e) => setPosthumousName(e.target.value)}
                  placeholder="(tuỳ chọn)"
                />
              </div>
            </div>

            <CalendarDateInput
              label="Ngày mất (nếu đã mất)"
              idPrefix="death"
              value={death}
              onChange={(next) => {
                setDeath(next);
                if (next.parts.year) setIsLiving(false);
              }}
              helperText="Để trống nếu còn sống. Khi nhập ngày âm đầy đủ, ngày giỗ tự sinh từ tháng/ngày âm."
            />

            <div className="space-y-2">
              <Label htmlFor="birth_place">Nơi sinh</Label>
              <Input
                id="birth_place"
                maxLength={200}
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                placeholder="(tuỳ chọn)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="burial_place">Nơi an táng</Label>
              <Input
                id="burial_place"
                maxLength={200}
                value={burialPlace}
                onChange={(e) => setBurialPlace(e.target.value)}
                placeholder="(tuỳ chọn)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Tiểu sử</Label>
              <textarea
                id="bio"
                rows={4}
                maxLength={5000}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="(tuỳ chọn)"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <div className="flex gap-3 pt-2 justify-end">
          <Button
            type="submit"
            variant="outline"
            data-testid="person-submit-button"
            disabled={mutation.isPending || !fullName.trim()}
          >
            {mutation.isPending && !andContinueRef.current ? (
              "Đang lưu…"
            ) : (
              <>
                <IconCheck className="h-4 w-4 mr-1.5" />
                Lưu
              </>
            )}
          </Button>
          {!isCopy && (
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending || !fullName.trim()}
              onClick={(e) => handleSubmit(e, true)}
              title="Lưu rồi tiếp tục thêm người khác (giữ giới tính)"
            >
              {mutation.isPending && andContinueRef.current ? (
                "Đang lưu…"
              ) : (
                <>
                  <IconPlus className="h-4 w-4 mr-1.5" />
                  Lưu & thêm nữa
                </>
              )}
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to={`/clans/${clanId}/people`}>
              <IconX className="h-4 w-4 mr-1.5" />
              Hủy
            </Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
