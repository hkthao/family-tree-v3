import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { BackLink } from "@/components/BackLink";
import { IconCheck, IconCopy, IconX } from "@/components/icons";
import { PartialDateInput } from "@/components/PartialDateInput";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { invalidateClanData } from "@/lib/cache";
import { dateFromParts, partsFromDate, type DateParts } from "@/lib/partialDate";
import { queryKeys } from "@/lib/queries/keys";
import { createPerson, getPerson } from "@/lib/queries/persons";

const EMPTY_PARTS: DateParts = { year: "", month: "", day: "" };

export default function NewPerson() {
  const { clanId } = useParams<{ clanId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
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
  const [birth, setBirth] = useState<DateParts>(EMPTY_PARTS);
  const [death, setDeath] = useState<DateParts>(EMPTY_PARTS);
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

  useEffect(() => {
    if (!source || prefilled) return;
    setFullName(source.full_name);
    setGender(source.gender);
    setIsLiving(source.is_living);
    // Don't auto-mark a copy as Thuỷ tổ even if the source is — usually
    // a duplicate root is unintended. User can re-tick if needed.
    setIsRoot(false);
    setBirth(
      partsFromDate({
        date: source.birth_date,
        precision: source.birth_date_precision,
      }),
    );
    setDeath(
      partsFromDate({
        date: source.death_date,
        precision: source.death_date_precision,
      }),
    );
    setBirthPlace(source.birth_place ?? "");
    setBurialPlace(source.burial_place ?? "");
    setCourtesyName(source.courtesy_name ?? "");
    setNickname(source.nickname ?? "");
    setPosthumousName(source.posthumous_name ?? "");
    setBio(source.bio ?? "");
    setPrefilled(true);
  }, [source, prefilled]);

  const mutation = useMutation({
    mutationFn: async () => {
      const birthD = dateFromParts(birth);
      const deathD = dateFromParts(death);
      return createPerson({
        clan_id: clanId!,
        full_name: fullName.trim(),
        gender,
        is_living: isLiving,
        is_root: isRoot,
        birth_date: birthD.date,
        birth_date_precision: birthD.precision,
        death_date: deathD.date,
        death_date_precision: deathD.precision,
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
      toast.success(isCopy ? "Đã tạo bản sao" : "Đã thêm người", {
        description: fullName.trim(),
      });
      navigate(`/clans/${clanId}/people`);
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
  });

  if (!clanId || !user) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim()) return;
    try {
      // Pre-validate so the user sees a clear message before we round-trip
      dateFromParts(birth);
      dateFromParts(death);
    } catch (err) {
      setFormError((err as Error).message);
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="space-y-6">
      <nav>
        <BackLink fallback={`/clans/${clanId}/people`} />
      </nav>

      <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
        {isCopy ? (
          <>
            <IconCopy className="h-5 w-5" />
            Sao chép người
          </>
        ) : (
          "Thêm người"
        )}
      </h1>
      {isCopy && source && (
        <Alert>
          <AlertDescription>
            Đang sao chép từ <strong>{source.full_name}</strong>. Quan hệ
            cha mẹ / vợ chồng / con không được sao chép — bạn nối lại sau
            khi lưu.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="full_name">Họ và tên</Label>
          <Input
            id="full_name"
            required
            autoFocus
            maxLength={200}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Vd: Nguyễn Văn A"
          />
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

        <PartialDateInput
          label="Ngày sinh (dương lịch)"
          idPrefix="birth"
          value={birth}
          onChange={setBirth}
          helperText="Có thể bỏ trống ngày, tháng nếu chỉ biết năm (như khắc trên bia mộ)."
        />

        <PartialDateInput
          label="Ngày mất (nếu đã mất)"
          idPrefix="death"
          value={death}
          onChange={(next) => {
            setDeath(next);
            if (next.year) setIsLiving(false);
          }}
          helperText="Để trống nếu còn sống."
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
              Đánh dấu khi đây là gốc của dòng họ (đời 1). Có thể có nhiều
              Thuỷ tổ nếu nhiều chi tách lập.
            </span>
          </span>
        </label>

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

        {(formError || mutation.error) && (
          <Alert variant="destructive">
            <AlertDescription>
              {formError ?? (mutation.error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 pt-2">
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
          <Button asChild variant="outline" className="flex-1 sm:flex-none">
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
