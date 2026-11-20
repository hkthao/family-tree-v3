import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/Toast";
import {
  IconBook,
  IconCalendar,
  IconCamera,
  IconCheck,
  IconMapPin,
  IconMicrophone,
  IconPencil,
  IconSend,
  IconUser,
  IconUsers,
  IconX,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import { isAudioRecordingSupported, useAudioRecorder } from "@/lib/audioRecord";
import { compressMemoryPhoto, uploadMemoryMedia } from "@/lib/photoUpload";
import {
  createMemory,
  readGuestProfile,
  saveGuestProfile,
  submitGuestMemory,
  type MemoryStatus,
} from "@/lib/queries/community";

import { t } from "@lingui/core/macro";

type Kind = "story" | "photo" | "audio";

interface BaseProps {
  clanId: string;
  personId: string | null;
  /** Tên người được kể — để câu hỏi gần gũi ("Bạn nhớ gì về cụ Tư?"). */
  personName?: string | null;
  onDone: (status: MemoryStatus) => void;
  onCancel?: () => void;
}

type Props =
  | (BaseProps & { mode: "member"; userId: string })
  | (BaseProps & { mode: "guest"; token: string });

const AUDIO_MAX_SEC = 300;

/**
 * Form kể một ký ức về một người — dùng chung cho thành viên (ghi thẳng, tải tệp lên storage)
 * và khách qua link (gửi edge function community-submit). Chỉ hỏi những gì cần: kể chuyện / ảnh /
 * ghi âm, thêm tuỳ chọn năm · nơi chốn · biết từ đâu — các mốc này để sau ghép tiểu sử / video ký ức.
 */
export function MemoryForm(props: Props) {
  const toast = useToast();
  const isGuest = props.mode === "guest";
  const openedAt = useRef(performance.now());
  const [kind, setKind] = useState<Kind>("story");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [year, setYear] = useState("");
  const [place, setPlace] = useState("");
  const [source, setSource] = useState("");
  const guestDefaults = isGuest ? readGuestProfile() : { name: "", relation: "" };
  const [name, setName] = useState(guestDefaults.name);
  const [relation, setRelation] = useState(guestDefaults.relation);
  const [showOnShare, setShowOnShare] = useState(isGuest);
  const [allowAi, setAllowAi] = useState(true);
  const [website, setWebsite] = useState("");
  const recorder = useAudioRecorder(AUDIO_MAX_SEC);
  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const who = props.personName ? props.personName : t`người này`;

  const mutation = useMutation({
    mutationFn: async (): Promise<MemoryStatus> => {
      const yearNum = year.trim() ? Number(year) : null;
      if (yearNum !== null && (!Number.isInteger(yearNum) || yearNum < 1000 || yearNum > 2200)) {
        throw new Error(t`Năm không hợp lệ`);
      }
      let blob: Blob | null = null;
      let ext = "";
      let mime: string | null = null;
      let durationSec: number | null = null;
      if (kind === "photo") {
        if (!photo) throw new Error(t`Bạn chưa chọn ảnh`);
        blob = await compressMemoryPhoto(photo);
        ext = "jpg";
        mime = "image/jpeg";
      } else if (kind === "audio") {
        if (!recorder.result) throw new Error(t`Bạn chưa ghi âm`);
        blob = recorder.result.blob;
        ext = recorder.result.ext;
        mime = blob.type.split(";")[0] || "audio/webm";
        durationSec = recorder.result.durationSec;
      } else if (!body.trim()) {
        throw new Error(t`Bạn chưa viết gì`);
      }

      if (props.mode === "guest") {
        if (!name.trim()) throw new Error(t`Cho biết tên của bạn nhé`);
        saveGuestProfile({ name: name.trim(), relation: relation.trim() });
        const res = await submitGuestMemory({
          token: props.token,
          kind,
          person_id: props.personId,
          body: body.trim() || undefined,
          author_name: name.trim(),
          author_relation: relation.trim() || undefined,
          year_approx: yearNum,
          place: place.trim() || undefined,
          source: source.trim() || undefined,
          allow_ai_reuse: allowAi,
          file: blob,
          file_name: blob ? `memory.${ext}` : undefined,
          website,
          elapsed_ms: performance.now() - openedAt.current,
        });
        return res.status;
      }

      let mediaPath: string | null = null;
      if (blob) {
        const up = await uploadMemoryMedia(props.clanId, props.userId, blob, ext);
        mediaPath = up.path;
      }
      const res = await createMemory({
        clan_id: props.clanId,
        person_id: props.personId,
        kind,
        body: body.trim() || null,
        media_path: mediaPath,
        media_mime: mime,
        duration_sec: durationSec,
        year_approx: yearNum,
        place,
        source,
        author_relation: relation,
        visibility: showOnShare ? "share" : "clan",
        allow_ai_reuse: allowAi,
      });
      return res.status;
    },
    onSuccess: (status) => {
      track("community_memory_submit", { kind, guest: isGuest ? 1 : 0, status });
      toast.success(
        status === "visible" ? t`Đã lưu đóng góp, cảm ơn bạn!` : t`Đã gửi, chờ người quản lý dòng họ duyệt. Cảm ơn bạn!`,
      );
      props.onDone(status);
    },
    onError: (e) => toast.error(t`Chưa gửi được`, { description: (e as Error).message }),
  });

  const kinds: { key: Kind; label: string; icon: React.ReactNode }[] = [
    { key: "story", label: t`Câu chuyện`, icon: <IconPencil className="h-4 w-4" /> },
    { key: "photo", label: t`Ảnh cũ`, icon: <IconCamera className="h-4 w-4" /> },
    ...(isAudioRecordingSupported()
      ? [{ key: "audio" as const, label: t`Ghi âm`, icon: <IconMicrophone className="h-4 w-4" /> }]
      : []),
  ];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div role="radiogroup" aria-label={t`Cách góp`} className="grid grid-cols-3 gap-2">
        {kinds.map((k) => (
          <button
            key={k.key}
            type="button"
            role="radio"
            aria-checked={kind === k.key}
            onClick={() => setKind(k.key)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-medium transition-colors ${
              kind === k.key ? "border-primary bg-primary/10 text-primary" : "bg-card hover:border-primary/60"
            }`}
          >
            {k.icon}
            {k.label}
          </button>
        ))}
      </div>

      {kind === "photo" && (
        <div className="space-y-2">
          <Label htmlFor="memory-photo">{t`Chọn ảnh`}</Label>
          <Input
            id="memory-photo"
            type="file"
            accept="image/*"
            icon={<IconCamera />}
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
          {photoPreview && (
            <img
              src={photoPreview}
              alt={t`Ảnh đã chọn`}
              className="max-h-56 rounded-lg border object-contain"
            />
          )}
        </div>
      )}

      {kind === "audio" && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">
            {t`Bấm nút micrô rồi kể, tối đa 5 phút. Bấm lần nữa để dừng.`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {recorder.state !== "recording" ? (
              <Button type="button" onClick={() => void recorder.start()} disabled={recorder.state === "recorded"}>
                <IconMicrophone className="mr-1.5 h-4 w-4" />
                {t`Bắt đầu ghi âm`}
              </Button>
            ) : (
              <Button type="button" variant="destructive" onClick={recorder.stop}>
                <IconCheck className="mr-1.5 h-4 w-4" />
                {t`Dừng (${recorder.seconds} giây)`}
              </Button>
            )}
            {recorder.state === "recorded" && (
              <Button type="button" variant="outline" onClick={recorder.reset}>
                <IconX className="mr-1.5 h-4 w-4" />
                {t`Ghi lại`}
              </Button>
            )}
          </div>
          {recorder.result && <audio controls src={recorder.result.url} className="w-full" />}
          {recorder.error && <p className="text-sm text-destructive">{recorder.error}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="memory-body">
          {kind === "story"
            ? t`Bạn nhớ gì về ${who}?`
            : kind === "photo"
              ? t`Vài lời về tấm ảnh (không bắt buộc)`
              : t`Vài lời về đoạn ghi âm (không bắt buộc)`}
        </Label>
        <Textarea
          id="memory-body"
          icon={<IconBook />}
          rows={kind === "story" ? 6 : 3}
          value={body}
          maxLength={isGuest ? 5000 : 20000}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            kind === "story"
              ? t`Một kỷ niệm, món ăn hay nấu, câu hay dặn, công việc ngày trước…`
              : kind === "photo"
                ? t`Ảnh chụp ở đâu, có những ai…`
                : t`Ai nói, nói về chuyện gì…`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="memory-year">{t`Khoảng năm (nếu nhớ)`}</Label>
          <Input
            id="memory-year"
            icon={<IconCalendar />}
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="1975"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="memory-place">{t`Ở đâu (nếu nhớ)`}</Label>
          <Input
            id="memory-place"
            icon={<IconMapPin />}
            value={place}
            maxLength={200}
            onChange={(e) => setPlace(e.target.value)}
            placeholder={t`Làng, xã, thành phố…`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="memory-source">{t`Bạn biết chuyện này từ đâu?`}</Label>
        <Input
          id="memory-source"
          icon={<IconUsers />}
          value={source}
          maxLength={200}
          onChange={(e) => setSource(e.target.value)}
          placeholder={t`Chính tôi nhớ · nghe bố mẹ kể · giấy tờ…`}
        />
      </div>

      {isGuest && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="memory-name">{t`Tên của bạn`}</Label>
            <Input
              id="memory-name"
              icon={<IconUser />}
              value={name}
              maxLength={80}
              required
              onChange={(e) => setName(e.target.value)}
              placeholder={t`Ví dụ: Nguyễn Minh`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="memory-relation">{t`Bạn là gì của ${who}?`}</Label>
            <Input
              id="memory-relation"
              icon={<IconUsers />}
              value={relation}
              maxLength={120}
              onChange={(e) => setRelation(e.target.value)}
              placeholder={t`Cháu nội, con dâu, hàng xóm…`}
            />
          </div>
        </div>
      )}

      {/* Bẫy bot: người thật không thấy, không điền. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <div className="space-y-2 text-sm">
        {!isGuest && (
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={showOnShare}
              onChange={(e) => setShowOnShare(e.target.checked)}
            />
            <span>{t`Cho hiện ở trang chia sẻ (người ngoài có link cũng đọc được — chỉ áp dụng với người đã mất)`}</span>
          </label>
        )}
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-primary"
            checked={allowAi}
            onChange={(e) => setAllowAi(e.target.checked)}
          />
          <span>{t`Cho phép dùng đóng góp này khi soạn tiểu sử / video kỷ niệm của dòng họ`}</span>
        </label>
      </div>

      {isGuest && (
        <Alert>
          <AlertDescription>
            {t`Không cần đăng ký. Người quản lý dòng họ sẽ xem trước khi đăng; tên bạn được ghi là người đóng góp.`}
          </AlertDescription>
        </Alert>
      )}

      <FormActions>
        {props.onCancel && (
          <Button type="button" variant="outline" onClick={props.onCancel}>
            {t`Huỷ`}
          </Button>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          <IconSend className="mr-1.5 h-4 w-4" />
          {mutation.isPending ? t`Đang gửi…` : t`Gửi đóng góp`}
        </Button>
      </FormActions>
    </form>
  );
}
