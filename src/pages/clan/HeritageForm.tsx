import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { IconCheck, IconMapPin, IconScroll, IconX } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import {
  addHeritagePerson,
  createHeritageItem,
  getHeritageItem,
  HERITAGE_CATEGORY_HINT,
  HERITAGE_CATEGORY_LABEL,
  HERITAGE_CATEGORY_PROMPTS,
  removeHeritagePerson,
  updateHeritageItem,
  type HeritageCategory,
} from "@/lib/queries/heritage";
import { matchesName } from "@/lib/unaccent";

const CATEGORIES = Object.keys(HERITAGE_CATEGORY_LABEL) as HeritageCategory[];

interface StagedPerson {
  personId: string;
  name: string;
  gender: "M" | "F";
  linkId: string | null; // set if already saved (edit mode)
}

export default function HeritageForm() {
  const { clan } = useClanContext();
  const { itemId } = useParams<{ itemId?: string }>();
  const isEdit = !!itemId;
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [category, setCategory] = useState<HeritageCategory>("place");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [builtYear, setBuiltYear] = useState("");
  const [people, setPeople] = useState<StagedPerson[]>([]);
  const [origPeople, setOrigPeople] = useState<StagedPerson[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");

  const { data: existing } = useQuery({
    queryKey: ["heritage-item", itemId, userId],
    queryFn: () => getHeritageItem(itemId!),
    enabled: isEdit,
  });
  useEffect(() => {
    if (!existing) return;
    setCategory(existing.category);
    setTitle(existing.title);
    setSummary(existing.summary ?? "");
    setBody(existing.body ?? "");
    setLocationName(existing.location_name ?? "");
    setAddress(existing.address ?? "");
    setLat(existing.latitude != null ? String(existing.latitude) : "");
    setLng(existing.longitude != null ? String(existing.longitude) : "");
    setBuiltYear(existing.built_year != null ? String(existing.built_year) : "");
    const ppl = existing.people.map((p) => ({
      personId: p.person_id, name: p.full_name, gender: p.gender, linkId: p.link_id,
    }));
    setPeople(ppl);
    setOrigPeople(ppl);
  }, [existing]);

  const { data: clanIndex } = useQuery({
    queryKey: queryKeys.kinshipIndex(clan.id, userId),
    queryFn: () => getKinshipIndex(clan.id),
    enabled: !!userId && pickerOpen,
    staleTime: 5 * 60_000,
  });
  const candidates = useMemo(() => {
    if (!clanIndex) return [];
    const taken = new Set(people.map((p) => p.personId));
    return clanIndex.ordered
      .filter((p) => !taken.has(p.id) && matchesName(p.full_name, pickerFilter))
      .slice(0, 50);
  }, [clanIndex, people, pickerFilter]);

  const isPlace = category === "place";

  const save = useMutation({
    mutationFn: async () => {
      const fields = {
        category,
        title: title.trim(),
        summary: summary.trim() || null,
        body: body.trim() || null,
        location_name: isPlace ? locationName.trim() || null : null,
        address: isPlace ? address.trim() || null : null,
        latitude: isPlace && lat.trim() ? Number(lat) : null,
        longitude: isPlace && lng.trim() ? Number(lng) : null,
        built_year: isPlace && builtYear.trim() ? Math.floor(Number(builtYear)) : null,
      };
      let id = itemId ?? "";
      if (isEdit) {
        await updateHeritageItem(id, fields);
        const stagedIds = new Set(people.map((p) => p.personId));
        const origIds = new Set(origPeople.map((p) => p.personId));
        for (const p of people) if (!origIds.has(p.personId)) await addHeritagePerson(id, p.personId);
        for (const p of origPeople)
          if (!stagedIds.has(p.personId) && p.linkId) await removeHeritagePerson(p.linkId);
      } else {
        const res = await createHeritageItem(clan.id, fields);
        id = res.id;
        for (const p of people) await addHeritagePerson(id, p.personId);
      }
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["heritage", clan.id] });
      qc.invalidateQueries({ queryKey: ["heritage-item", id] });
      toast.success(isEdit ? "Đã lưu" : "Đã thêm", {
        description: isEdit ? undefined : "Giờ bạn có thể thêm ảnh và ghi âm kể chuyện.",
      });
      navigate(`/clans/${clan.id}/heritage/${id}`);
    },
    onError: (e) => toast.error("Không lưu được", { description: (e as Error).message }),
  });

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt không hỗ trợ định vị");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast.success("Đã lấy vị trí hiện tại");
      },
      () => toast.error("Không lấy được vị trí (cần cấp quyền định vị)"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const back = isEdit ? `/clans/${clan.id}/heritage/${itemId}` : `/clans/${clan.id}/heritage`;
  const prompts = HERITAGE_CATEGORY_PROMPTS[category];

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Di sản & Văn hoá", to: `/clans/${clan.id}/heritage` },
          { label: isEdit ? "Sửa" : "Thêm" },
        ]}
      />
      <PageHeader
        icon={<IconScroll className="h-7 w-7" />}
        title={isEdit ? "Sửa mục di sản" : "Thêm mục di sản"}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFormError(null);
          if (!title.trim()) {
            setFormError("Hãy nhập tên / tiêu đề cho mục này.");
            return;
          }
          save.mutate();
        }}
        className="space-y-6"
      >
        {/* Loại */}
        <div className="space-y-2">
          <Label htmlFor="category">Loại di sản</Label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as HeritageCategory)}
            className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{HERITAGE_CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">{HERITAGE_CATEGORY_HINT[category]}</p>
        </div>

        {/* Tiêu đề */}
        <div className="space-y-2">
          <Label htmlFor="title" required>Tên / tiêu đề</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isPlace ? "vd: Từ đường họ Nguyễn" : "vd: Lệ giỗ Tổ mùng 10 tháng Giêng"}
            maxLength={200}
            className="h-12 text-base"
          />
        </div>

        {/* Nơi (chỉ place) */}
        {isPlace && (
          <>
            <div className="space-y-2">
              <Label htmlFor="loc-name">Ở đâu</Label>
              <Input id="loc-name" value={locationName} onChange={(e) => setLocationName(e.target.value)}
                placeholder="vd: thôn …, xã …" className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Địa chỉ (tuỳ chọn)</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="vd: xã …, huyện …, tỉnh …" className="h-12 text-base" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="year">Lập / xây năm (tuỳ chọn)</Label>
                <Input id="year" inputMode="numeric" value={builtYear} onChange={(e) => setBuiltYear(e.target.value)}
                  placeholder="vd: 1920" className="h-12 text-base" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vị trí trên bản đồ (tuỳ chọn)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input className="w-32 h-12" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="vĩ độ" />
                <Input className="w-32 h-12" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="kinh độ" />
                <Button type="button" variant="outline" onClick={useCurrentLocation}>
                  <IconMapPin className="h-4 w-4 mr-1" /> Lấy vị trí hiện tại
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Đứng tại từ đường rồi bấm "Lấy vị trí hiện tại" để lưu toạ độ chỉ đường.</p>
            </div>
          </>
        )}

        {/* Mô tả ngắn */}
        <div className="space-y-2">
          <Label htmlFor="summary">Mô tả ngắn (tuỳ chọn)</Label>
          <Input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)}
            placeholder="Một câu tóm tắt, hiện ở danh sách" maxLength={300} className="h-12 text-base" />
        </div>

        {/* Nội dung + câu hỏi gợi ý (dành cho người lớn tuổi) */}
        <div className="space-y-2">
          <Label htmlFor="body">Nội dung</Label>
          <div className="rounded-md border border-divider bg-muted/40 p-3">
            <p className="text-sm font-medium mb-1">Gợi ý — bạn chỉ cần lần lượt trả lời:</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-0.5">
              {prompts.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder="Kể lại bằng lời của bạn… (có thể dùng nút micro trên bàn phím điện thoại để đọc cho máy ghi)"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base leading-relaxed"
          />
          <p className="text-sm text-muted-foreground">
            Sau khi lưu, bạn có thể <strong>thêm ảnh</strong> và <strong>ghi âm kể chuyện</strong> ở trang chi tiết.
          </p>
        </div>

        {/* Người liên quan */}
        <div className="space-y-2">
          <Label className="block">Người liên quan trong họ (tuỳ chọn)</Label>
          {people.length > 0 && (
            <ul className="space-y-1.5">
              {people.map((p) => (
                <li key={p.personId} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                  <PersonAvatar gender={p.gender} size={28} />
                  <span className="flex-1 truncate text-base">{p.name}</span>
                  <button type="button" aria-label="Bỏ" onClick={() => setPeople((prev) => prev.filter((x) => x.personId !== p.personId))}>
                    <IconX className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!pickerOpen ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
              Gắn người
            </Button>
          ) : (
            <div className="space-y-2 rounded-md border p-2">
              <Input value={pickerFilter} onChange={(e) => setPickerFilter(e.target.value)} placeholder="Gõ tên để tìm (không cần dấu)" autoFocus />
              <ul className="max-h-60 overflow-y-auto divide-y text-sm">
                {candidates.length === 0 && <li className="px-2 py-2 text-muted-foreground italic">{clanIndex ? "Không có người khớp." : "Đang tải…"}</li>}
                {candidates.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="w-full text-left px-2 py-2 flex items-center gap-2 hover:bg-muted/50"
                      onClick={() => {
                        setPeople((prev) => [...prev, { personId: p.id, name: p.full_name, gender: p.gender, linkId: null }]);
                        setPickerFilter("");
                      }}>
                      <PersonAvatar gender={p.gender} size={28} />
                      <span className="truncate">{p.full_name}</span>
                      {p.birth_year && <span className="text-xs text-muted-foreground ml-auto">{p.birth_year}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPickerOpen(false)}>Xong</Button>
            </div>
          )}
        </div>

        {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="submit" disabled={save.isPending}>
            <IconCheck className="h-4 w-4 mr-1.5" />
            {save.isPending ? "Đang lưu…" : "Lưu"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(back)}>
            <IconX className="h-4 w-4 mr-1.5" /> Hủy
          </Button>
        </div>
      </form>
    </div>
  );
}
