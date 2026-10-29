/**
 * Định dạng file nháp gia phả lịch sử + bộ kiểm tra (validator).
 * Xem docs/plan-gia-pha-vua-chua.md.
 *
 * Nguyên tắc:
 *  - MỌI dữ kiện phải có trích dẫn (nguồn + vị trí + trích nguyên văn), và
 *    giá trị điền vào form phải KHỚP với giá trị một nguồn ghi.
 *  - Cột của `persons` được dựng bằng đúng hàm của form sửa người
 *    (`buildPersonDateColumns`, `buildDeathAnniversary`) → mở form ra thấy
 *    đúng dữ liệu, bấm Lưu không làm mất gì.
 *  - Tiểu sử ngắn gọn, văn phong sử (giới hạn độ dài), cuối tự thêm dòng nguồn.
 *
 * Chạy bằng tsx cần `--tsconfig tsconfig.app.json` (alias "@/").
 */
import {
  buildDeathAnniversary,
  buildPersonDateColumns,
  type CalendarDateValue,
} from "../../src/lib/personDates.ts";
import { lunarToSolarString, solarStringToLunar } from "../../src/lib/lunarDate.ts";

export type Tier = "A" | "B" | "C";
export type Confidence = "confirmed" | "single_source" | "disputed" | "legendary";

export interface SourceDef {
  code: string;
  title: string;
  author?: string | null;
  edition?: string | null;
  translator?: string | null;
  published_year?: number | null;
  tier: Tier;
  url?: string | null;
  notes?: string | null;
}

export interface Citation {
  /** 'existence' | 'birth' | 'parents' | 'reign:0' | 'title:1' | 'union'… */
  field: string;
  source: string; // SourceDef.code
  locator: string; // 'Bản kỷ, Q.5, tờ 12a'
  quote: string; // trích ngắn nguyên văn
  /**
   * Giá trị nguồn này ghi. BẮT BUỘC với trường một-giá-trị (xem
   * VALUE_FIELDS); khác nhau giữa các nguồn ⇒ dị bản. Ngày viết theo
   * `formatDateFact` (vd "âm 1225-12-12", "âm 1225", "âm ?-4-3").
   */
  value?: string | null;
  legendary?: boolean;
  note?: string | null;
}

export interface Review {
  status: "draft" | "verified" | "rejected";
  by?: string | null;
  at?: string | null; // ISO date
  note?: string | null;
}

/** Ngày như NGUỒN ghi — sử cũ chép âm lịch; `solar` chỉ dùng khi nguồn ghi dương lịch. */
export interface DateFact {
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_leap?: boolean;
  /** 'YYYY' | 'YYYY-MM' | 'YYYY-MM-DD' — chỉ khi nguồn ghi dương lịch. */
  solar?: string | null;
  qualifier?: "circa" | "before" | "after" | null;
}

export interface ReignDraft {
  dynasty: string;
  ordinal?: number | null;
  role?: "emperor" | "retired_emperor" | "lord" | "regent";
  temple_name?: string | null;
  era_names?: { name: string; from_year?: number | null; to_year?: number | null }[];
  start_year?: number | null;
  end_year?: number | null;
  notes?: string | null;
}

export interface TitleDraft {
  title: string;
  from_year?: number | null;
  to_year?: number | null;
  notes?: string | null;
}

/**
 * Nguồn ảnh được chấp nhận: kho ảnh có trang riêng cho từng tệp, nêu rõ giấy
 * phép và tác giả. Ảnh (`url`) và trang nguồn (`source_page`) phải cùng một
 * nhà cung cấp. Thêm nguồn mới ở đây (kèm test) chứ không nới regex ở nơi khác.
 */
export interface PhotoProvider {
  id: string;
  /** Tên hiện trong dòng ghi công. */
  label: string;
  /** Link ảnh trực tiếp (hot-link, không tải về). */
  image: RegExp;
  /** Trang tệp có giấy phép / tác giả / xuất xứ. */
  page: RegExp;
}

export const PHOTO_PROVIDERS: PhotoProvider[] = [
  {
    id: "wikimedia",
    label: "Wikimedia Commons",
    image: /^https:\/\/upload\.wikimedia\.org\/.+\.(jpe?g|png|webp|tiff?)$/i,
    page: /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
  },
  {
    id: "archive",
    label: "Internet Archive",
    image: /^https:\/\/(?:archive\.org\/download|[\w.-]+\.us\.archive\.org)\/.+\.(jpe?g|png|webp|tiff?)$/i,
    page: /^https:\/\/archive\.org\/details\/[\w.-]+/,
  },
  {
    id: "gallica",
    label: "Gallica (BnF)",
    image: /^https:\/\/gallica\.bnf\.fr\/iiif\/ark:\/12148\/[\w/.,!:-]+\.(jpe?g|png)$/i,
    page: /^https:\/\/gallica\.bnf\.fr\/ark:\/12148\/\w+/,
  },
  {
    id: "met",
    label: "The Met (Open Access)",
    image: /^https:\/\/images\.metmuseum\.org\/.+\.(jpe?g|png)$/i,
    page: /^https:\/\/www\.metmuseum\.org\/art\/collection\/search\/\d+/,
  },
  {
    id: "loc",
    label: "Library of Congress",
    image: /^https:\/\/(?:tile\.loc\.gov|www\.loc\.gov\/(?:pictures|static))\/.+\.(jpe?g|png|gif|tiff?)$/i,
    page: /^https:\/\/www\.loc\.gov\/(?:pictures\/item|item|resource)\/[\w.-]+/,
  },
  {
    id: "europeana",
    label: "Europeana",
    image: /^https:\/\/(?:api\.europeana\.eu\/thumbnail|[\w.-]+\.europeana\.eu)\/.+/i,
    page: /^https:\/\/www\.europeana\.eu\/(?:\w\w\/)?item\/[\w/-]+/,
  },
  {
    id: "flickr",
    label: "Flickr",
    image: /^https:\/\/live\.staticflickr\.com\/.+\.(jpe?g|png)$/i,
    page: /^https:\/\/www\.flickr\.com\/photos\/[\w@-]+\/\d+/,
  },
];

/** Nhà cung cấp khớp với link ảnh (hoặc null). */
export function photoProvider(url: string | null | undefined): PhotoProvider | null {
  return PHOTO_PROVIDERS.find((p) => p.image.test(url ?? "")) ?? null;
}

/** Ảnh đại diện — từ kho ảnh trong PHOTO_PROVIDERS, giấy phép tự do, ghi rõ loại ảnh. */
export interface PhotoDraft {
  /** Link ảnh trực tiếp của một nhà cung cấp trong PHOTO_PROVIDERS. */
  url: string;
  /** Trang tệp của CÙNG nhà cung cấp (nơi ghi giấy phép, tác giả). */
  source_page: string;
  /** 'PD' / 'PD-old' / 'CC0' / 'CC BY 4.0' / 'CC BY-SA 3.0'… */
  license: string;
  author?: string | null; // bắt buộc trừ PD/CC0
  /**
   * photograph = ảnh chụp thật; contemporary_portrait = chân dung vẽ đương thời;
   * later_depiction = tượng / tranh thờ (KHÔNG phải chân dung thật — sẽ ghi rõ).
   */
  kind: "photograph" | "contemporary_portrait" | "later_depiction";
  year?: string | null; // năm chụp / vẽ nếu biết
}

export interface PersonDraft {
  key: string;
  /** Tên thường gọi trong sử (vua: họ + miếu hiệu, vd "Trần Thái Tông"). */
  full_name: string;
  gender: "M" | "F";
  is_root?: boolean;
  nickname?: string | null; // Tên húy (vd "Trần Cảnh")
  courtesy_name?: string | null; // Tên tự
  posthumous_name?: string | null; // Tên thụy / thụy hiệu
  birth?: DateFact | null;
  /** Ngày mất âm lịch → app tự suy ra ngày giỗ (như form). */
  death?: DateFact | null;
  lifespan?: number | null; // Tuổi thọ như nguồn ghi ("thọ 60 tuổi" — tuổi ta)
  birth_place?: string | null;
  burial_place?: string | null;
  parents?: string | null; // UnionDraft.key — cha mẹ đẻ
  adoptive_parents?: string | null; // UnionDraft.key — cha mẹ nuôi / thừa tự
  /**
   * Con thứ mấy — thứ tự trong TẤT CẢ con của cha (qua mọi bà vợ), chỉ khi
   * nguồn ghi. "Hoàng tử thứ N" (chỉ đếm con trai) → ghi ở titles/tiểu sử.
   */
  birth_order?: number | null;
  reigns?: ReignDraft[];
  titles?: TitleDraft[];
  photo?: PhotoDraft | null;
  /** Tiểu sử: ngắn gọn, văn phong sử, ≤ BIO_MAX ký tự. Dòng nguồn tự thêm khi nhập. */
  bio?: string | null;
  citations: Citation[];
  review?: Review;
}

export interface UnionDraft {
  key: string;
  husband?: string | null;
  wife?: string | null;
  /**
   * Thứ tự người vợ này trong các vợ của chồng (1 = chính thất / vợ cả…) —
   * cần khi chồng có ≥ 2 vợ (vua chúa thường nhiều vợ). Phẩm vị hậu phi
   * (Hoàng hậu, Phi, Tần…) ghi ở `titles` của người vợ.
   */
  spouse_order?: number | null;
  union_type?: "marriage" | "remarriage" | "other";
  notes?: string | null;
  citations: Citation[];
  review?: Review;
}

/** Ảnh của lăng / di sản: như PhotoDraft + chú thích. */
export interface PlacePhotoDraft extends PhotoDraft {
  caption?: string | null;
}

/** Lăng tẩm → module Mộ phần (resting_places). */
export interface RestingPlaceDraft {
  key: string;
  name: string; // "Chiêu Lăng"
  kind?: "grave" | "other";
  /** Địa danh như sử chép (vd "hương Tinh Cương, phủ Long Hưng"). */
  location_name?: string | null;
  /** Địa chỉ ngày nay — cần nguồn tầng A/B (hồ sơ di tích, nghiên cứu). */
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: "existing" | "relocated" | "lost";
  built_year?: number | null;
  notes?: string | null; // ngắn gọn, văn phong sử
  occupants: string[]; // key người an táng tại đây
  photos?: PlacePhotoDraft[];
  citations: Citation[];
  review?: Review;
}

/** Di sản dòng họ (heritage_items): nơi thờ, tục lệ, giai thoại, tư liệu. */
export interface HeritageDraft {
  key: string;
  category: "place" | "custom" | "story" | "artifact";
  title: string;
  summary?: string | null;
  body?: string | null;
  location_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  built_year?: number | null;
  people?: { person: string; role_note?: string | null }[];
  photos?: PlacePhotoDraft[];
  citations: Citation[];
  review?: Review;
}

export interface DynastyFile {
  clan: {
    key: string;
    name: string;
    description?: string | null;
    /** royal = hoàng tộc · noble = quý tộc · official = quan lại, khoa bảng · military = võ tướng */
    category: "royal" | "noble" | "official" | "military";
  };
  persons: PersonDraft[];
  unions: UnionDraft[];
  resting_places?: RestingPlaceDraft[];
  heritage?: HeritageDraft[];
  /**
   * Thông gia: người này CŨNG có trong dòng họ lịch sử khác (vd Lý Chiêu Hoàng —
   * con gái trong cây nhà Lý, vợ trong cây nhà Trần). Nhập thành person_links
   * 'same_person' đã xác nhận khi dòng họ kia đã có.
   */
  same_person_links?: SamePersonLinkDraft[];
  events?: EventDraft[];
}

/**
 * Sự kiện thường niên (lễ hội đền, tế lăng…) → module Sự kiện. KHÔNG khai giỗ
 * của người đã có ngày mất: app tự sinh giỗ từ ngày mất.
 */
export interface EventDraft {
  key: string;
  title: string;
  event_type?: "custom" | "reunion" | "memorial" | "tomb_visit";
  /** Âm lịch: { lunar_month, lunar_day } — hoặc dương lịch: { solar: 'YYYY-MM-DD' }. */
  date: { lunar_month?: number | null; lunar_day?: number | null; lunar_leap?: boolean; solar?: string | null };
  is_yearly?: boolean;
  related_person?: string | null;
  resting_place?: string | null; // key lăng (tế lăng)
  notes?: string | null;
  citations: Citation[];
  review?: Review;
}

export interface SamePersonLinkDraft {
  person: string; // key người trong file này
  other_clan: string; // clan.key của dòng họ kia
  other_person: string; // key người đó trong dòng họ kia
  note?: string | null; // vd "Con gái Lý Huệ Tông, hoàng hậu của Trần Thái Tông"
  citations: Citation[]; // field 'same_person'
  review?: Review;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  /** key người/hôn nhân → field → mức tin cậy */
  confidence: Map<string, Map<string, Confidence>>;
  /** key người → cột `persons` đã dựng (đúng như form ghi). */
  columns: Map<string, PersonColumns>;
  /** key người → đời (mô phỏng đúng recompute_generation_for_clan), null = không nối vào cây. */
  generations: Map<string, number | null>;
}

export const BIO_SOFT_MAX = 500;
export const BIO_MAX = 800;
export const NOTES_MAX = 500;
export const HERITAGE_BODY_SOFT_MAX = 1000;
export const HERITAGE_BODY_MAX = 1500;
export const SUMMARY_MAX = 200;

/** Trường chỉ có MỘT giá trị đúng — các nguồn ghi khác nhau ⇒ dị bản. */
const SINGLE_FIELDS = [
  "full_name",
  "birth",
  "death",
  "lifespan",
  "parents",
  "adoptive_parents",
  "posthumous_name",
  "courtesy_name",
  "nickname",
  "birth_place",
  "burial_place",
  "birth_order",
  "bio",
] as const;

/** Trường mà citation phải ghi `value` và giá trị trên form phải khớp một nguồn. */
const VALUE_FIELDS = new Set([
  "date",
  "location_name",
  "address",
  "built_year",
  "status",
  "birth",
  "death",
  "lifespan",
  "posthumous_name",
  "courtesy_name",
  "nickname",
  "birth_place",
  "burial_place",
  "birth_order",
]);

const KEY_RE = /^[a-z0-9][a-z0-9.-]*$/;
const SOLAR_RE = /^(\d{3,4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const MIN_QUOTE = 8;
/** Chữ Hán đặc nghĩa hơn chữ Latin — trích ≥ 4 chữ để đủ ngữ cảnh tra lại. */
const MIN_QUOTE_CJK = 4;
const CJK_RE = /[\u3400-\u9fff\u{20000}-\u{2ffff}]/u;

/**
 * Trước năm này KHÔNG quy đổi âm → dương: lịch Việt thời đó (Thụ Thời, Hiệp
 * Kỷ…) khác thuật toán thiên văn hiện đại, ngày dương "quy đổi" sẽ là giá trị
 * suy diễn. Lưu đúng ngày âm như sử chép. (Lỗi bảng năm 1200–1799 của
 * @dqcai/vn-lunar đã được vá ở src/lib/lunarDate.ts — không còn là lý do.)
 */
export const LUNAR_CONVERT_FROM_YEAR = 1800;

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

function norm(v: string): string {
  return v.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Các giá trị có mâu thuẫn không. Ngày ("âm 1290-5" và "âm 1290-5-25") chỉ
 * khác độ chi tiết thì KHÔNG mâu thuẫn — nguồn này ghi gọn hơn nguồn kia.
 */
export function conflicting(values: string[]): boolean {
  if (new Set(values).size <= 1) return false;
  const dateParts = (v: string) => {
    const m = /^(âm )?([\d?]+(?:-[\dn?]+)*)$/.exec(v);
    return m ? { lunar: !!m[1], parts: m[2].split("-") } : null;
  };
  const parsed = values.map(dateParts);
  if (parsed.some((p) => !p)) return true;
  for (const a of parsed) {
    for (const b of parsed) {
      if (a!.lunar !== b!.lunar) return true;
      const n = Math.min(a!.parts.length, b!.parts.length);
      for (let i = 0; i < n; i++) if (a!.parts[i] !== b!.parts[i]) return true;
    }
  }
  return false;
}

export function isPublishable(r: Review | undefined): boolean {
  return r?.status === "verified";
}

/** Cách viết chuẩn của một ngày trong `Citation.value`. */
export function formatDateFact(d: DateFact): string {
  if (d.solar) return d.solar;
  const leap = d.lunar_leap ? "n" : "";
  const parts = [d.lunar_year ?? "?", d.lunar_month != null ? `${d.lunar_month}${leap}` : null, d.lunar_day]
    .filter((x) => x != null)
    .join("-");
  return `âm ${parts}`;
}

// ── Dựng cột persons như form ─────────────────────────────────────────

export interface DateColumns {
  date: string | null;
  precision: "day" | "month" | "year" | null;
  qualifier: DateFact["qualifier"];
  lunar_year: number | null;
  lunar_month: number | null;
  lunar_day: number | null;
  lunar_is_leap: boolean;
  /** Giá trị đưa vào form (để suy ngày giỗ). */
  formValue: CalendarDateValue;
  /** Chi tiết nguồn không lưu được trên form (chỉ còn trong trích dẫn/tiểu sử). */
  lost: string | null;
  /** Ngày trước LUNAR_CONVERT_FROM_YEAR: lưu âm + năm, không quy đổi ra ngày dương. */
  lunarOnly?: boolean;
}

/**
 * Ngày như nguồn ghi → cột persons, theo đúng quy tắc form:
 *  - đủ ngày/tháng/năm âm → lưu âm + dương quy đổi (tab dương hiện ngày quy đổi);
 *  - chỉ tháng/ngày âm (giỗ, không năm) → chỉ lưu âm;
 *  - chỉ năm (hoặc năm + tháng) → năm dương, độ chính xác "năm" — để cây/tuổi
 *    thọ hiển thị được. Tháng âm lẻ không có chỗ trên form → `lost`.
 */
export function dateColumns(d: DateFact): DateColumns {
  const blank = { year: "", month: "", day: "" };
  const make = (formValue: CalendarDateValue, lost: string | null = null): DateColumns => {
    const c = buildPersonDateColumns(formValue);
    return {
      lunarOnly: false,
      date: c.solar_date,
      precision: c.solar_precision,
      qualifier: d.qualifier ?? null,
      lunar_year: c.lunar_year,
      lunar_month: c.lunar_month,
      lunar_day: c.lunar_day,
      lunar_is_leap: c.lunar_is_leap,
      formValue,
      lost,
    };
  };
  const solarYear = (y: number) => make({ mode: "solar", parts: { ...blank, year: String(y) }, isLeap: false });

  if (d.solar) {
    const m = SOLAR_RE.exec(d.solar);
    if (!m) throw new Error(`ngày dương "${d.solar}" sai định dạng (YYYY[-MM[-DD]])`);
    return make({ mode: "solar", parts: { year: m[1], month: m[2] ?? "", day: m[3] ?? "" }, isLeap: false });
  }

  const { lunar_year: y, lunar_month: mo, lunar_day: da } = d;
  const leap = !!d.lunar_leap;

  // Trước 1800: lưu ngày âm như nguồn + năm (độ chính xác "năm") để cây hiện
  // được năm; không suy ra ngày dương.
  if (y != null && y < LUNAR_CONVERT_FROM_YEAR) {
    return {
      ...solarYear(y),
      lunar_year: y,
      lunar_month: mo ?? null,
      lunar_day: mo != null ? da ?? null : null,
      lunar_is_leap: mo != null && leap,
      lost: null,
      lunarOnly: true,
    };
  }

  if (y != null && mo != null && da != null) {
    const solar = lunarToSolarString({ year: y, month: mo, day: da, isLeap: leap });
    // Quy đổi ngược để bắt ngày không có thật (thư viện "nuốt" tháng nhuận sai).
    const back = solar ? solarStringToLunar(solar) : null;
    if (solar && back && back.year === y && back.month === mo && back.day === da && back.isLeap === leap) {
      return make({ mode: "lunar", parts: { year: String(y), month: String(mo), day: String(da) }, isLeap: leap });
    }
    throw new Error(`ngày âm ${formatDateFact(d)} không tồn tại (kiểm tra tháng nhuận/ngày 30)`);
  }
  if (y == null && mo != null) {
    return make({ mode: "lunar", parts: { year: "", month: String(mo), day: da != null ? String(da) : "" }, isLeap: leap });
  }
  if (y != null) {
    if (mo == null) return solarYear(y);
    // Năm + tháng âm: tháng 11–12 âm có thể đã sang năm dương sau.
    const mid = lunarToSolarString({ year: y, month: mo, day: 15, isLeap: leap });
    const sy = mid ? Number(mid.slice(0, 4)) : y;
    return { ...solarYear(sy), lost: formatDateFact(d) };
  }
  throw new Error("ngày cần ít nhất năm hoặc tháng âm");
}

export interface PersonColumns {
  birth: DateColumns | null;
  death: DateColumns | null;
  death_anniv_lunar_month: number | null;
  death_anniv_lunar_day: number | null;
  death_anniv_lunar_is_leap: boolean;
}

function yearOf(c: DateColumns | null): number | null {
  if (!c) return null;
  if (c.date) return Number(c.date.slice(0, 4));
  return c.lunar_year;
}

/** Dòng nguồn cuối tiểu sử: "Theo: Đại Việt sử ký toàn thư (Bản kỷ Q.5); …". */
export function sourceLine(
  p: Pick<PersonDraft, "citations">,
  sources: SourceDef[],
  only: string[] = ["bio", "existence"],
): string {
  const byCode = new Map(sources.map((s) => [s.code, s]));
  const fields = new Set(only);
  const seen = new Map<string, Set<string>>();
  for (const c of p.citations) {
    if (!fields.has(c.field)) continue;
    const set = seen.get(c.source) ?? new Set<string>();
    set.add(c.locator.trim());
    seen.set(c.source, set);
  }
  const parts = [...seen].map(([code, locs]) => `${byCode.get(code)?.title ?? code} (${[...locs].join("; ")})`);
  return parts.length ? `Theo: ${parts.join("; ")}.` : "";
}

const PHOTO_KIND_LABEL: Record<PhotoDraft["kind"], string> = {
  photograph: "ảnh chụp",
  contemporary_portrait: "chân dung vẽ đương thời",
  later_depiction: "tượng / tranh thờ, không phải chân dung thật",
};

/** Dòng ghi công ảnh: "Ảnh: tượng / tranh thờ, không phải chân dung thật — Tác giả, CC BY-SA 4.0, Wikimedia Commons." */
export function photoLine(photo: PhotoDraft | null | undefined): string {
  if (!photo) return "";
  const who = [photo.author, photo.year].filter(Boolean).join(", ");
  return `Ảnh: ${PHOTO_KIND_LABEL[photo.kind]} — ${who ? `${who}, ` : ""}${photo.license}, ${photoProvider(photo.url)?.label ?? "nguồn ngoài"}.`;
}

/** Chú thích ảnh lăng / di sản: chú thích riêng + ghi công. */
export function photoCaption(ph: PlacePhotoDraft): string {
  return [ph.caption?.trim(), photoLine(ph)].filter(Boolean).join(" — ");
}

/** Dòng nguồn cho lăng / di sản (ghi cuối ghi chú / nội dung). */
export function placeSourceLine(citations: Citation[], sources: SourceDef[]): string {
  return sourceLine({ citations }, sources, ["existence", "notes", "body"]);
}

/** Ghi chú lăng / nội dung di sản + dòng nguồn cuối. */
export function composeProse(text: string | null | undefined, citations: Citation[], sources: SourceDef[]): string | null {
  const body = text?.trim();
  const line = placeSourceLine(citations, sources);
  if (!body) return line || null;
  return line ? `${body}\n\n${line}` : body;
}

export function composeBio(p: PersonDraft, sources: SourceDef[]): string | null {
  const body = p.bio?.trim();
  const line = [sourceLine(p, sources), photoLine(p.photo)].filter(Boolean).join("\n");
  if (!body) return line || null;
  return line ? `${body}\n\n${line}` : body;
}

// ── Số đời (mô phỏng recompute_generation_for_clan) ──────────────────

/**
 * Tính đời y như DB: thuỷ tổ (is_root) = 1; lặp: con đẻ (parents, KHÔNG tính
 * cha mẹ nuôi) = min(đời cha, đời mẹ) + 1, rồi vợ/chồng chưa có đời nhận đời
 * của người kia. Người còn null = không nối được vào cây.
 */
export function simulateGenerations(persons: PersonDraft[], unions: UnionDraft[]): Map<string, number | null> {
  const gen = new Map<string, number | null>(persons.map((p) => [p.key, p.is_root ? 1 : null]));
  const unionByKey = new Map(unions.map((u) => [u.key, u]));
  const g = (k: string | null | undefined) => (k && gen.has(k) ? gen.get(k)! : null);
  for (let guard = 0; guard < 80; guard++) {
    const blood = new Map<string, number>();
    for (const p of persons) {
      if (p.is_root || gen.get(p.key) != null || !p.parents) continue;
      const u = unionByKey.get(p.parents);
      if (!u) continue;
      const pg = [g(u.husband), g(u.wife)].filter((x): x is number => x != null);
      if (pg.length) blood.set(p.key, Math.min(...pg) + 1);
    }
    for (const [k, v] of blood) gen.set(k, v);
    let spouse = 0;
    for (const u of unions) {
      if (!u.husband || !u.wife || !gen.has(u.husband) || !gen.has(u.wife)) continue;
      const h = gen.get(u.husband)!;
      const w = gen.get(u.wife)!;
      if ((h == null) === (w == null)) continue;
      if (h == null) gen.set(u.husband, w);
      else gen.set(u.wife, h);
      spouse++;
    }
    if (blood.size === 0 && spouse === 0) break;
  }
  return gen;
}

// ── Validator ────────────────────────────────────────────────────────

export function validate(
  file: DynastyFile,
  sources: SourceDef[],
  opts: { publishOnly?: boolean } = {},
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const confidence = new Map<string, Map<string, Confidence>>();
  const columns = new Map<string, PersonColumns>();
  const sourceByCode = new Map(sources.map((s) => [s.code, s]));

  if (!file.clan?.key || !KEY_RE.test(file.clan.key)) errors.push("clan.key thiếu hoặc sai định dạng");
  if (!file.clan?.name) errors.push("clan.name thiếu");
  if (!["royal", "noble", "official", "military"].includes(file.clan?.category)) {
    errors.push("clan.category phải là royal | noble | official | military");
  }

  const persons = new Map<string, PersonDraft>();
  const unions = new Map<string, UnionDraft>();
  for (const p of file.persons ?? []) {
    if (!KEY_RE.test(p.key ?? "")) errors.push(`người "${p.key}": key sai định dạng (a-z0-9.-)`);
    if (persons.has(p.key) || unions.has(p.key)) errors.push(`key trùng: ${p.key}`);
    persons.set(p.key, p);
  }
  for (const u of file.unions ?? []) {
    if (!KEY_RE.test(u.key ?? "")) errors.push(`hôn nhân "${u.key}": key sai định dạng (a-z0-9.-)`);
    if (persons.has(u.key) || unions.has(u.key)) errors.push(`key trùng: ${u.key}`);
    unions.set(u.key, u);
  }

  /** Kiểm trích dẫn + tính mức tin cậy. `formValues`: giá trị trên form của từng trường. */
  function checkCitations(
    who: string,
    citations: Citation[] | undefined,
    required: string[],
    singleFields: Set<string>,
    formValues: Map<string, string> = new Map(),
    weakOk: Set<string> = new Set(),
  ) {
    const byField = new Map<string, Citation[]>();
    for (const c of citations ?? []) {
      const where = `${who} [${c.field}]`;
      if (!sourceByCode.has(c.source)) errors.push(`${where}: nguồn "${c.source}" không có trong danh mục`);
      if (!c.locator?.trim()) errors.push(`${where}: thiếu vị trí (quyển/tờ)`);
      const q = c.quote?.trim() ?? "";
      if ([...q].length < (CJK_RE.test(q) ? MIN_QUOTE_CJK : MIN_QUOTE)) errors.push(`${where}: thiếu trích dẫn nguyên văn (quá ngắn)`);
      const list = byField.get(c.field) ?? [];
      list.push(c);
      byField.set(c.field, list);
    }

    const conf = new Map<string, Confidence>();
    for (const field of required) {
      const list = byField.get(field);
      if (!list?.length) {
        errors.push(`${who}: dữ kiện "${field}" không có trích dẫn`);
        continue;
      }
      const values = new Set(list.filter((c) => hasValue(c.value)).map((c) => norm(c.value!)));
      const formValue = formValues.get(field);
      if (VALUE_FIELDS.has(field) && formValue != null) {
        const missing = list.filter((c) => !hasValue(c.value)).length;
        if (missing) errors.push(`${who}: ${missing} trích dẫn "${field}" thiếu value (nguồn ghi gì?)`);
        else if (!values.has(norm(formValue))) {
          errors.push(`${who}: "${field}" = "${formValue}" không khớp nguồn nào (${[...values].join(" | ")})`);
        }
      }
      const strong = new Set(
        list.filter((c) => {
          const t = sourceByCode.get(c.source)?.tier;
          return t === "A" || t === "B";
        }).map((c) => c.source),
      );
      let level: Confidence;
      if (list.some((c) => c.legendary)) level = "legendary";
      else if (singleFields.has(field) && conflicting([...values])) level = "disputed";
      else if (strong.size >= 2) level = "confirmed";
      else if (strong.size === 1) level = "single_source";
      else if (weakOk.has(field)) {
        warnings.push(`${who}: "${field}" chỉ theo nguồn tầng C — nên đối chiếu hồ sơ di tích`);
        level = "single_source";
      } else {
        errors.push(`${who}: dữ kiện "${field}" chỉ có nguồn tầng C (Wikipedia/Wikidata) — chưa đủ để công bố`);
        continue;
      }
      conf.set(field, level);
    }
    for (const field of byField.keys()) {
      if (!required.includes(field)) warnings.push(`${who}: trích dẫn cho "${field}" nhưng không có dữ kiện tương ứng`);
    }
    return conf;
  }

  function checkPhoto(who: string, ph: PhotoDraft) {
    const provider = photoProvider(ph.url);
    if (!provider) {
      errors.push(
        `${who}: link ảnh không thuộc nguồn được chấp nhận (${PHOTO_PROVIDERS.map((p) => p.label).join(", ")})`,
      );
    } else if (!provider.page.test(ph.source_page ?? "")) {
      errors.push(`${who}: ảnh ${provider.label} thiếu trang nguồn đúng dạng của ${provider.label}`);
    }
    const lic = ph.license?.trim() ?? "";
    if (!/^(PD(-[\w-]+)?|PDM( 1\.0)?|CC0( 1\.0)?|CC BY(-SA)? \d\.\d)$/.test(lic)) {
      errors.push(`${who}: giấy phép ảnh "${lic}" không thuộc PD / PDM / CC0 / CC BY / CC BY-SA`);
    }
    if (!/^(PD|CC0)/.test(lic) && !ph.author?.trim()) errors.push(`${who}: ảnh ${lic} cần ghi tác giả`);
    if (!["photograph", "contemporary_portrait", "later_depiction"].includes(ph.kind)) {
      errors.push(`${who}: ảnh cần kind = photograph | contemporary_portrait | later_depiction`);
    } else if (ph.kind === "later_depiction") {
      warnings.push(`${who}: ảnh là tượng / tranh thờ — sẽ ghi rõ "không phải chân dung thật"`);
    }
  }

  /** Văn bản tự do (tiểu sử, ghi chú, nội dung di sản): độ dài + văn phong sử. */
  function checkProse(who: string, label: string, text: string | null | undefined, soft: number, max: number) {
    const t = text?.trim() ?? "";
    if (t.length > max) errors.push(`${who}: ${label} ${t.length} ký tự — tối đa ${max}, viết gọn lại`);
    else if (t.length > soft) warnings.push(`${who}: ${label} ${t.length} ký tự — nên ≤ ${soft}`);
    if (/[!?]|\b(tôi|chúng ta|bạn)\b|(vô cùng|tuyệt vời|cực kỳ|huyền thoại)/i.test(t)) {
      warnings.push(`${who}: ${label} có lời cảm thán / ngôi thứ nhất / từ phóng đại — giữ văn phong sử`);
    }
    if (/\bTheo:/.test(t)) warnings.push(`${who}: không cần tự ghi "Theo:" — dòng nguồn được thêm khi nhập`);
  }

  /** Trường địa điểm chung của lăng / di sản → required + giá trị form. */
  function placeFields(
    who: string,
    x: { location_name?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null; built_year?: number | null },
    required: string[],
    formValues: Map<string, string>,
  ) {
    if (x.location_name) (required.push("location_name"), formValues.set("location_name", x.location_name));
    if (x.address) (required.push("address"), formValues.set("address", x.address));
    if (x.built_year != null) (required.push("built_year"), formValues.set("built_year", String(x.built_year)));
    const hasLat = x.latitude != null;
    if (hasLat !== (x.longitude != null)) errors.push(`${who}: cần cả vĩ độ và kinh độ`);
    if (hasLat && x.longitude != null) {
      required.push("coordinates");
      if (x.latitude! < 8 || x.latitude! > 24 || x.longitude < 102 || x.longitude > 110) {
        warnings.push(`${who}: toạ độ ${x.latitude}, ${x.longitude} nằm ngoài Việt Nam — kiểm tra lại`);
      }
    }
  }

  // ── Hôn nhân ───────────────────────────────────────────────────────
  for (const u of unions.values()) {
    const who = `hôn nhân ${u.key}`;
    const h = u.husband ? persons.get(u.husband) : null;
    const w = u.wife ? persons.get(u.wife) : null;
    if (u.husband && !h) errors.push(`${who}: không có người "${u.husband}"`);
    if (u.wife && !w) errors.push(`${who}: không có người "${u.wife}"`);
    if (h && h.gender !== "M") errors.push(`${who}: husband ${h.key} không phải nam`);
    if (w && w.gender !== "F") errors.push(`${who}: wife ${w.key} không phải nữ`);
    if (!u.husband && !u.wife) errors.push(`${who}: cần ít nhất một người`);
    // Hôn nhân "khuyết" (chỉ biết cha hoặc mẹ) là chỗ neo cho con — không cần trích dẫn riêng.
    const required = u.husband && u.wife ? ["union"] : [];
    confidence.set(u.key, checkCitations(who, u.citations, required, new Set(["union"])));
    if (opts.publishOnly && isPublishable(u.review)) {
      for (const k of [u.husband, u.wife]) {
        if (k && persons.has(k) && !isPublishable(persons.get(k)!.review)) {
          errors.push(`${who}: đã duyệt nhưng ${k} chưa duyệt`);
        }
      }
    }
  }

  // Đa thê: mỗi cặp vợ chồng một hôn nhân, có thứ tự vợ; mỗi cha chỉ
  // một hôn nhân "khuyết mẹ" (neo cho con không rõ mẹ).
  const byHusband = new Map<string, UnionDraft[]>();
  for (const u of unions.values()) {
    if (!u.husband) continue;
    const list = byHusband.get(u.husband) ?? [];
    list.push(u);
    byHusband.set(u.husband, list);
  }
  for (const [h, list] of byHusband) {
    const withWife = list.filter((u) => u.wife);
    const pairs = new Set<string>();
    for (const u of withWife) {
      if (pairs.has(u.wife!)) errors.push(`${h} và ${u.wife}: khai trùng hôn nhân`);
      pairs.add(u.wife!);
    }
    const noWife = list.filter((u) => !u.wife);
    if (noWife.length > 1) {
      errors.push(`${h}: có ${noWife.length} hôn nhân khuyết mẹ (${noWife.map((u) => u.key).join(", ")}) — gộp làm một`);
    }
    if (withWife.length >= 2) {
      const missing = withWife.filter((u) => u.spouse_order == null);
      if (missing.length) warnings.push(`${h}: ${withWife.length} vợ nhưng ${missing.map((u) => u.key).join(", ")} chưa có spouse_order`);
      const orders = withWife.map((u) => u.spouse_order).filter((o): o is number => o != null);
      if (new Set(orders).size !== orders.length) errors.push(`${h}: spouse_order bị trùng giữa các vợ`);
    }
    for (const u of list) {
      if (u.spouse_order != null && (!Number.isInteger(u.spouse_order) || u.spouse_order < 1)) {
        errors.push(`hôn nhân ${u.key}: spouse_order phải là số nguyên ≥ 1`);
      }
    }
  }

  // ── Người ──────────────────────────────────────────────────────────
  for (const p of persons.values()) {
    const who = `người ${p.key}`;
    if (!p.full_name?.trim()) errors.push(`${who}: thiếu full_name`);
    if (p.gender !== "M" && p.gender !== "F") errors.push(`${who}: gender phải là M/F`);

    // Ngày → cột persons (đúng như form).
    const cols: PersonColumns = {
      birth: null,
      death: null,
      death_anniv_lunar_month: null,
      death_anniv_lunar_day: null,
      death_anniv_lunar_is_leap: false,
    };
    for (const label of ["birth", "death"] as const) {
      const d = p[label];
      if (!d) continue;
      try {
        cols[label] = dateColumns(d);
        if (cols[label]!.lunarOnly && (d.lunar_month ?? 0) >= 11) {
          warnings.push(`${who}: ${label} ${formatDateFact(d)} — tháng 11–12 âm có thể đã sang năm dương sau; năm hiển thị theo năm âm`);
        }
        if (cols[label]!.lost) {
          warnings.push(`${who}: ${label} ${cols[label]!.lost} — form chỉ lưu năm; nêu chi tiết trong tiểu sử`);
        }
      } catch (e) {
        errors.push(`${who}: ${label}: ${(e as Error).message}`);
      }
    }
    if (cols.death?.lunarOnly) {
      cols.death_anniv_lunar_month = cols.death.lunar_day != null ? cols.death.lunar_month : null;
      cols.death_anniv_lunar_day = cols.death.lunar_month != null ? cols.death.lunar_day : null;
      cols.death_anniv_lunar_is_leap = cols.death_anniv_lunar_day != null && cols.death.lunar_is_leap;
    } else if (cols.death) {
      const a = buildDeathAnniversary(cols.death.formValue);
      cols.death_anniv_lunar_month = a.death_anniv_lunar_month;
      cols.death_anniv_lunar_day = a.death_anniv_lunar_day;
      cols.death_anniv_lunar_is_leap = a.death_anniv_lunar_is_leap;
    }
    columns.set(p.key, cols);

    // Bio: ngắn gọn, văn phong sử.
    checkProse(who, "tiểu sử", p.bio, BIO_SOFT_MAX, BIO_MAX);

    // Tên tự / húy / thụy: sử hầu như luôn chép tên húy và thụy hiệu của vua chúa.
    if (p.reigns?.length) {
      const missing = [
        !p.nickname && "Tên húy",
        !p.posthumous_name && "Tên thụy",
        !p.courtesy_name && "Tên tự",
      ].filter(Boolean);
      if (missing.length) {
        warnings.push(`${who}: vua/chúa chưa có ${missing.join(", ")} — soát lại bản kỷ / thế phả (nhiều tên húy thì ghi "A; B")`);
      }
    }

    if (p.photo) checkPhoto(who, p.photo);

    if (p.lifespan != null && (!Number.isInteger(p.lifespan) || p.lifespan < 0 || p.lifespan > 150)) {
      errors.push(`${who}: lifespan phải là số nguyên 0–150`);
    }

    const required = ["existence", "full_name"];
    for (const f of SINGLE_FIELDS) {
      if (f !== "full_name" && hasValue((p as unknown as Record<string, unknown>)[f])) required.push(f);
    }
    (p.reigns ?? []).forEach((_, i) => required.push(`reign:${i}`));
    (p.titles ?? []).forEach((_, i) => required.push(`title:${i}`));
    const singles = new Set<string>([...SINGLE_FIELDS, "existence"]);
    (p.reigns ?? []).forEach((_, i) => singles.add(`reign:${i}`));

    const formValues = new Map<string, string>();
    for (const f of ["posthumous_name", "courtesy_name", "nickname", "birth_place", "burial_place"] as const) {
      if (p[f]) formValues.set(f, p[f]!);
    }
    if (p.birth_order != null) formValues.set("birth_order", String(p.birth_order));
    if (p.lifespan != null) formValues.set("lifespan", String(p.lifespan));
    if (p.birth) formValues.set("birth", formatDateFact(p.birth));
    if (p.death) formValues.set("death", formatDateFact(p.death));
    // full_name: tên trên form có thể là miếu hiệu (không phải nguyên văn) → chỉ cần trích dẫn.
    // Không có trích dẫn 'full_name' riêng thì trích dẫn 'existence' đứng thay (chỉ khi kiểm, không ghi DB).
    const cites = p.citations ?? [];
    const checked = cites.some((c) => c.field === "full_name")
      ? cites
      : [...cites, ...cites.filter((c) => c.field === "existence").map((c) => ({ ...c, field: "full_name" }))];
    confidence.set(p.key, checkCitations(who, checked, required, singles, formValues));

    const by = yearOf(cols.birth);
    const dy = yearOf(cols.death);
    if (by != null && dy != null) {
      if (dy < by) errors.push(`${who}: mất (${dy}) trước khi sinh (${by})`);
      else if (dy - by > 110) warnings.push(`${who}: thọ ${dy - by} năm — kiểm tra lại`);
      // Sử ghi tuổi ta: năm mất − năm sinh + 1 (cho lệch thêm 1 vì quy đổi âm → dương).
      if (p.lifespan != null && Math.abs(p.lifespan - (dy - by + 1)) > 1) {
        warnings.push(`${who}: tuổi thọ ${p.lifespan} lệch với năm sinh/mất (${by}–${dy})`);
      }
    }

    for (const r of p.reigns ?? []) {
      if (r.start_year != null && r.end_year != null && r.start_year > r.end_year) {
        errors.push(`${who}: trị vì ${r.start_year}–${r.end_year} ngược`);
      }
      if (by != null && r.start_year != null && r.start_year < by) errors.push(`${who}: lên ngôi (${r.start_year}) trước khi sinh`);
      if (dy != null && r.end_year != null && r.end_year > dy + 1) errors.push(`${who}: hết trị vì (${r.end_year}) sau khi mất`);
    }
  }

  // Quan hệ cha mẹ – con (cần năm của cả hai phía → chạy sau khi dựng cột).
  for (const p of persons.values()) {
    const who = `người ${p.key}`;
    const by = yearOf(columns.get(p.key)?.birth ?? null);
    for (const [label, uk] of [["parents", p.parents], ["adoptive_parents", p.adoptive_parents]] as const) {
      if (!uk) continue;
      const u = unions.get(uk);
      if (!u) {
        errors.push(`${who}: ${label} trỏ tới hôn nhân "${uk}" không tồn tại`);
        continue;
      }
      if (u.husband === p.key || u.wife === p.key) errors.push(`${who}: là cha/mẹ của chính mình`);
      if (opts.publishOnly && isPublishable(p.review) && !isPublishable(u.review)) {
        errors.push(`${who}: đã duyệt nhưng ${label} (${uk}) chưa duyệt`);
      }
      if (label !== "parents" || by == null) continue;
      for (const [role, pk] of [["cha", u.husband], ["mẹ", u.wife]] as const) {
        if (!pk || !persons.has(pk)) continue;
        const pc = columns.get(pk);
        const pby = yearOf(pc?.birth ?? null);
        const pdy = yearOf(pc?.death ?? null);
        if (pby != null && by - pby < 12) errors.push(`${who}: ${role} ${pk} chỉ hơn ${by - pby} tuổi`);
        // Cha có thể mất khi con còn trong bụng mẹ → cho lệch 1 năm.
        const slack = role === "cha" ? 1 : 0;
        if (pdy != null && pdy < by - slack) errors.push(`${who}: ${role} ${pk} mất (${pdy}) trước khi con sinh (${by})`);
      }
    }
  }

  // "Con thứ mấy" trùng giữa các con của cùng một cha (qua mọi bà vợ).
  const orderByFather = new Map<string, Map<number, string[]>>();
  for (const p of persons.values()) {
    const father = p.parents ? unions.get(p.parents)?.husband : null;
    if (!father || p.birth_order == null) continue;
    const m = orderByFather.get(father) ?? new Map<number, string[]>();
    m.set(p.birth_order, [...(m.get(p.birth_order) ?? []), p.key]);
    orderByFather.set(father, m);
  }
  for (const [father, m] of orderByFather) {
    for (const [n, keys] of m) {
      if (keys.length > 1) warnings.push(`${father}: nhiều con cùng là "con thứ ${n}" (${keys.join(", ")}) — sử có đếm riêng trai/gái?`);
    }
  }

  // Vòng lặp tổ tiên (A là tổ tiên của chính A).
  const parentsOf = (k: string): string[] => {
    const p = persons.get(k);
    const out: string[] = [];
    for (const uk of [p?.parents, p?.adoptive_parents]) {
      const u = uk ? unions.get(uk) : null;
      if (u?.husband) out.push(u.husband);
      if (u?.wife) out.push(u.wife);
    }
    return out;
  };
  const state = new Map<string, 1 | 2>(); // 1 = đang thăm, 2 = xong
  const visit = (k: string, path: string[]) => {
    if (state.get(k) === 2) return;
    if (state.get(k) === 1) {
      errors.push(`vòng lặp tổ tiên: ${[...path, k].join(" → ")}`);
      return;
    }
    state.set(k, 1);
    for (const pk of parentsOf(k)) visit(pk, [...path, k]);
    state.set(k, 2);
  };
  for (const k of persons.keys()) visit(k, []);

  // ── Lăng tẩm (Mộ phần) ─────────────────────────────────────────────
  const allKeys = new Set([...persons.keys(), ...unions.keys()]);
  const claimKey = (k: string, label: string) => {
    if (!KEY_RE.test(k ?? "")) errors.push(`${label} "${k}": key sai định dạng (a-z0-9.-)`);
    if (allKeys.has(k)) errors.push(`key trùng: ${k}`);
    allKeys.add(k);
  };
  const needPerson = (who: string, k: string, owner?: Review) => {
    const p = persons.get(k);
    if (!p) errors.push(`${who}: không có người "${k}"`);
    else if (opts.publishOnly && isPublishable(owner) && !isPublishable(p.review)) {
      errors.push(`${who}: đã duyệt nhưng ${k} chưa duyệt`);
    }
  };
  const buriedAt = new Map<string, string[]>();
  for (const g of file.resting_places ?? []) {
    const who = `lăng ${g.key}`;
    claimKey(g.key, "lăng");
    if (!g.name?.trim()) errors.push(`${who}: thiếu tên`);
    const required = ["existence"];
    const formValues = new Map<string, string>();
    placeFields(who, g, required, formValues);
    if (g.status && g.status !== "existing") (required.push("status"), formValues.set("status", g.status));
    if (g.notes) required.push("notes");
    checkProse(who, "ghi chú", g.notes, NOTES_MAX, NOTES_MAX);
    if (!g.occupants?.length) errors.push(`${who}: chưa gắn người an táng`);
    (g.occupants ?? []).forEach((k, i) => {
      needPerson(who, k, g.review);
      required.push(`occupant:${i}`);
      buriedAt.set(k, [...(buriedAt.get(k) ?? []), g.name]);
    });
    (g.photos ?? []).forEach((ph) => checkPhoto(who, ph));
    confidence.set(g.key, checkCitations(who, g.citations, required, new Set(["location_name", "address", "status", "built_year"]), formValues, new Set(["coordinates"])));
  }
  for (const [k, names] of buriedAt) {
    const p = persons.get(k);
    if (!p) continue;
    if (!p.burial_place) warnings.push(`người ${k}: an táng tại ${names.join(", ")} nhưng chưa điền Nơi an táng`);
    else if (!names.some((n) => norm(p.burial_place!).includes(norm(n)))) {
      warnings.push(`người ${k}: Nơi an táng "${p.burial_place}" không nhắc tới ${names.join(", ")}`);
    }
  }

  // ── Di sản dòng họ ─────────────────────────────────────────────────
  for (const h of file.heritage ?? []) {
    const who = `di sản ${h.key}`;
    claimKey(h.key, "di sản");
    if (!h.title?.trim()) errors.push(`${who}: thiếu tiêu đề`);
    if (!["place", "custom", "story", "artifact"].includes(h.category)) {
      errors.push(`${who}: category phải là place | custom | story | artifact`);
    }
    const required = ["existence"];
    const formValues = new Map<string, string>();
    placeFields(who, h, required, formValues);
    if (h.body) required.push("body");
    checkProse(who, "nội dung", h.body, HERITAGE_BODY_SOFT_MAX, HERITAGE_BODY_MAX);
    checkProse(who, "tóm tắt", h.summary, SUMMARY_MAX, SUMMARY_MAX);
    (h.people ?? []).forEach((x, i) => {
      needPerson(who, x.person, h.review);
      required.push(`person:${i}`);
    });
    (h.photos ?? []).forEach((ph) => checkPhoto(who, ph));
    confidence.set(h.key, checkCitations(who, h.citations, required, new Set(["location_name", "address", "built_year"]), formValues, new Set(["coordinates"])));
  }

  // ── Sự kiện thường niên ────────────────────────────────────────────
  const graveKeys = new Set((file.resting_places ?? []).map((g) => g.key));
  for (const e of file.events ?? []) {
    const who = `sự kiện ${e.key}`;
    claimKey(e.key, "sự kiện");
    if (!e.title?.trim()) errors.push(`${who}: thiếu tiêu đề`);
    const type = e.event_type ?? "custom";
    if (!["custom", "reunion", "memorial", "tomb_visit"].includes(type)) errors.push(`${who}: event_type không hợp lệ`);
    const d = e.date ?? {};
    const isLunar = d.lunar_month != null;
    if (isLunar === !!d.solar) errors.push(`${who}: ngày phải là âm lịch (lunar_month/lunar_day) HOẶC dương lịch (solar), không cả hai`);
    if (isLunar && (d.lunar_month! < 1 || d.lunar_month! > 12 || d.lunar_day == null || d.lunar_day < 1 || d.lunar_day > 30)) {
      errors.push(`${who}: ngày âm cần tháng 1–12 và ngày 1–30`);
    }
    if (d.solar && !/^\d{4}-\d{2}-\d{2}$/.test(d.solar)) errors.push(`${who}: ngày dương cần YYYY-MM-DD`);
    const required = ["existence", "date"];
    const formValues = new Map<string, string>([
      ["date", isLunar ? formatDateFact({ lunar_month: d.lunar_month, lunar_day: d.lunar_day, lunar_leap: d.lunar_leap }) : d.solar ?? ""],
    ]);
    if (e.related_person) {
      needPerson(who, e.related_person, e.review);
      required.push("related_person");
      const rp = persons.get(e.related_person);
      if (type === "memorial" && rp && columns.get(rp.key)?.death_anniv_lunar_month != null) {
        errors.push(`${who}: ${rp.key} đã có ngày mất → app tự sinh giỗ, không khai sự kiện giỗ trùng`);
      }
    }
    if (e.resting_place) {
      if (!graveKeys.has(e.resting_place)) errors.push(`${who}: không có lăng "${e.resting_place}"`);
      required.push("resting_place");
    } else if (type === "tomb_visit") errors.push(`${who}: tế/viếng lăng cần resting_place`);
    if (e.notes) required.push("notes");
    checkProse(who, "ghi chú", e.notes, NOTES_MAX, NOTES_MAX);
    confidence.set(e.key, checkCitations(who, e.citations, required, new Set(["date"]), formValues));
  }

  // ── Thông gia (cùng một người ở dòng họ khác) ─────────────────────
  const linkPairs = new Set<string>();
  for (const l of file.same_person_links ?? []) {
    const who = `thông gia ${l.person} ↔ ${l.other_clan}/${l.other_person}`;
    needPerson(who, l.person, l.review);
    if (!KEY_RE.test(l.other_clan ?? "") || !KEY_RE.test(l.other_person ?? "")) {
      errors.push(`${who}: other_clan / other_person sai định dạng key`);
    }
    if (l.other_clan === file.clan.key) errors.push(`${who}: phải là dòng họ khác`);
    const pair = `${l.person}|${l.other_clan}|${l.other_person}`;
    if (linkPairs.has(pair)) errors.push(`${who}: khai trùng`);
    linkPairs.add(pair);
    checkCitations(who, l.citations, ["same_person"], new Set());
  }

  // Thuỷ tổ + số đời: chỉ xét những người sẽ được nhập.
  const inScope = (x: { review?: Review }) => !opts.publishOnly || isPublishable(x.review);
  const scopedPersons = [...persons.values()].filter(inScope);
  const scopedUnions = [...unions.values()].filter(inScope);
  const roots = scopedPersons.filter((p) => p.is_root);
  if (roots.length === 0) {
    errors.push("chưa có thuỷ tổ (is_root: true) — app cần thuỷ tổ để tính số đời và vẽ cây");
  } else if (roots.length > 1) {
    errors.push(`có ${roots.length} thuỷ tổ (${roots.map((p) => p.key).join(", ")}) — chỉ được một`);
  }
  for (const r of roots) {
    if (r.parents) errors.push(`thuỷ tổ ${r.key} không được có cha mẹ trong file (parents: ${r.parents})`);
  }
  const generations = simulateGenerations(scopedPersons, scopedUnions);
  if (roots.length === 1) {
    for (const p of scopedPersons) {
      if (generations.get(p.key) != null) continue;
      const hint = p.adoptive_parents && !p.parents
        ? " — chỉ có cha mẹ nuôi; app tính đời theo cha mẹ đẻ, cần thêm parents"
        : " — không phải con cháu/vợ chồng của dòng thuỷ tổ (cha mẹ của dâu/rể thuộc dòng họ khác: để ở dòng họ của họ)";
      errors.push(`người ${p.key}: không nối được về thuỷ tổ nên không có đời, không lên cây${hint}`);
    }
  }

  return { errors, warnings, confidence, columns, generations };
}

/** Số người theo từng đời (để soát cây). */
export function generationSummary(generations: Map<string, number | null>): [number, number][] {
  const count = new Map<number, number>();
  for (const g of generations.values()) if (g != null) count.set(g, (count.get(g) ?? 0) + 1);
  return [...count].sort((a, b) => a[0] - b[0]);
}

/** Báo cáo độ đầy đủ các trường trên form (để thấy chỗ còn trống). */
export function completeness(
  file: DynastyFile,
  only: (p: PersonDraft) => boolean = () => true,
): { field: string; label: string; filled: number; total: number }[] {
  const persons = file.persons.filter(only);
  const fields: [keyof PersonDraft, string][] = [
    ["birth", "Ngày sinh"],
    ["death", "Ngày mất / giỗ"],
    ["lifespan", "Tuổi thọ"],
    ["nickname", "Tên húy"],
    ["courtesy_name", "Tên tự"],
    ["posthumous_name", "Tên thụy"],
    ["birth_place", "Nơi sinh"],
    ["burial_place", "Nơi an táng"],
    ["birth_order", "Con thứ mấy"],
    ["bio", "Tiểu sử"],
    ["photo", "Ảnh"],
  ];
  return fields.map(([field, label]) => ({
    field,
    label,
    filled: persons.filter((p) => hasValue(p[field])).length,
    total: persons.length,
  }));
}
