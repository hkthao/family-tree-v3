/**
 * Dàn cây gia phả kiểu THƯ MỤC thành một danh sách dòng phẳng để in.
 *
 * Trên màn hình cây thư mục bung tới đâu tải tới đó; trong sổ thì không
 * có gì để bấm, nên phải bung HẾT từ trước và tính sẵn cho từng dòng:
 * thụt vào mấy tầng, cột nào còn nét dọc chạy xuyên qua, và nét rẽ vào
 * dòng là "├" hay "└". Tách khỏi phần vẽ PDF để kiểm thử được mà không
 * cần dựng cả trình kết xuất.
 *
 * Luật gom vợ/con giữ đúng như trên màn hình (xem lib/tree/folderModel):
 * một vợ/chồng → ghi chung dòng, con nằm thẳng dưới; hai trở lên → mỗi
 * cuộc hôn nhân một dòng "⚭", con treo dưới đúng mẹ/cha của mình.
 */

export interface FolderPdfPerson {
  id: string;
  name: string;
  gender: "M" | "F";
  /** Đời để HIỂN THỊ (đã trừ offset của dòng họ); null = chưa ghi. */
  generation: number | null;
  /** "1900–1983", "1958–nay"… hoặc "" nếu không có năm nào. */
  years: string;
  /** Nguồn ảnh (data URI ảnh thật, hoặc ảnh minh hoạ theo giới tính). */
  photo: string;
}

export interface FolderPdfRow {
  key: string;
  /** "marriage" = dòng đầu nhóm của một cuộc hôn nhân (ca nhiều vợ/chồng). */
  kind: "person" | "marriage";
  depth: number;
  /**
   * Các cột thụt lề TRƯỚC cột rẽ nhánh: true = ở tầng đó còn anh em phía
   * dưới nên nét dọc phải chạy xuyên qua dòng này. Dài `depth - 1`.
   */
  rails: boolean[];
  /** Con út trong nhóm anh em → nét dọc dừng ở giữa dòng ("└"). */
  isLast: boolean;
  /** Người của dòng; với dòng "marriage" là vợ/chồng, null = chưa ghi. */
  person: FolderPdfPerson | null;
  /** Vợ/chồng ghi chung dòng (chỉ ở dòng "person" một cuộc hôn nhân). */
  spouses: FolderPdfPerson[];
  /** Đời của người trong họ mà dòng này thuộc về — để tô màu cả cặp. */
  generation: number | null;
  /** Chỉ ở dòng "marriage": nhãn khi chưa ghi vợ/chồng, và số con. */
  label?: string;
  childCount?: number;
}

export interface FolderPdfInput {
  roots: string[];
  person: (id: string) => FolderPdfPerson | undefined;
  /** Con của một người, ĐÃ sắp theo thứ tự anh chị em. */
  childrenOf: (id: string) => string[];
  spousesOf: (id: string) => string[];
  /** Cha/mẹ còn lại của `childId` (không phải `parentId`); null = chưa ghi. */
  otherParentOf: (childId: string, parentId: string) => string | null;
}

export function buildFolderPdfRows(input: FolderPdfInput): FolderPdfRow[] {
  const rows: FolderPdfRow[] = [];
  // Dữ liệu nhập tay có khi vòng (A là con B, B là con A). Trên màn hình
  // người dùng tự dừng bấm; ở đây đệ quy sẽ không bao giờ dừng.
  const seen = new Set<string>();

  const childRails = (depth: number, rails: boolean[], isLast: boolean) =>
    depth === 0 ? [] : [...rails, !isLast];

  function visit(id: string, depth: number, rails: boolean[], isLast: boolean) {
    const me = input.person(id);
    if (!me || seen.has(id)) return;
    seen.add(id);

    const spouseIds = [...new Set(input.spousesOf(id))].filter((s) =>
      input.person(s),
    );
    const kids = input.childrenOf(id).filter((k) => input.person(k) && !seen.has(k));
    const below = childRails(depth, rails, isLast);

    if (spouseIds.length < 2) {
      rows.push({
        key: id,
        kind: "person",
        depth,
        rails,
        isLast,
        person: me,
        spouses: spouseIds.map((s) => input.person(s)!),
        generation: me.generation,
      });
      kids.forEach((k, i) => visit(k, depth + 1, below, i === kids.length - 1));
      return;
    }

    rows.push({
      key: id,
      kind: "person",
      depth,
      rails,
      isLast,
      person: me,
      spouses: [],
      generation: me.generation,
    });

    // Gom con theo cha/mẹ còn lại. Con mà cha/mẹ kia không nằm trong các
    // cuộc hôn nhân đã ghi thì dồn vào nhóm "chưa ghi".
    const known = new Set(spouseIds);
    const bySpouse = new Map<string | null, string[]>();
    for (const k of kids) {
      const other = input.otherParentOf(k, id);
      const key = other && known.has(other) ? other : null;
      bySpouse.set(key, [...(bySpouse.get(key) ?? []), k]);
    }
    const groups: (string | null)[] = [...spouseIds];
    if (bySpouse.has(null)) groups.push(null);

    groups.forEach((sp, gi) => {
      const groupKids = bySpouse.get(sp) ?? [];
      const groupLast = gi === groups.length - 1;
      rows.push({
        key: `${id}:${sp ?? "?"}`,
        kind: "marriage",
        depth: depth + 1,
        rails: below,
        isLast: groupLast,
        person: sp ? input.person(sp)! : null,
        spouses: [],
        generation: me.generation,
        label: sp ? undefined : me.gender === "F" ? "chưa ghi chồng" : "chưa ghi vợ",
        childCount: groupKids.length,
      });
      const underGroup = childRails(depth + 1, below, groupLast);
      groupKids.forEach((k, i) =>
        visit(k, depth + 2, underGroup, i === groupKids.length - 1),
      );
    });
  }

  for (const r of input.roots) visit(r, 0, [], true);
  return rows;
}

// ───────── Khổ giấy ────────────────────────────────────────────────

/**
 * Giới hạn cứng của định dạng PDF: một cạnh trang tối đa 14.400pt (200
 * inch). Vượt quá thì Acrobat từ chối mở, nên cây dài hơn phải sang trang.
 */
export const PDF_MAX_SIDE = 14400;

/** Dòng hai tầng chữ (tên / đời + năm) cạnh ảnh tròn — như trên web. */
export const FOLDER_ROW_H = 34;
export const FOLDER_AVATAR = 24;
export const FOLDER_SPOUSE_AVATAR = 20;
export const FOLDER_INDENT = 16;
/** Cỡ chữ tên = cỡ chữ thân bài của các trang khác trong sổ. */
export const FOLDER_NAME_PT = 10.5;
export const FOLDER_META_PT = 8;
const NAME_PT = FOLDER_NAME_PT;
const META_PT = FOLDER_META_PT;

/**
 * Ước lượng bề ngang chữ. Không đo thật được (font chỉ nạp lúc kết xuất),
 * nên lấy hệ số rộng trung bình của Be Vietnam Pro đậm rồi cộng 10% dự
 * phòng — thà thừa lề phải còn hơn tên bị rớt dòng làm vỡ lưới.
 */
const textW = (s: string, pt: number) => s.length * pt * 0.58 * 1.1;

/** Bề ngang một khối người: ảnh + dòng chữ dài hơn trong hai dòng. */
function personW(
  p: FolderPdfPerson,
  avatar: number,
  metaExtra: number,
  note = "",
): number {
  const top = textW(p.name, NAME_PT) + 12;
  const bottom =
    metaExtra + textW([p.years, note].filter(Boolean).join(" · "), META_PT);
  return avatar + 8 + Math.max(top, bottom);
}

/** Bề ngang nội dung của một dòng, tính cả phần thụt lề. */
export function folderRowWidth(r: FolderPdfRow): number {
  let w = r.depth * FOLDER_INDENT;
  if (r.kind === "marriage") {
    w +=
      18 +
      (r.person
        ? personW(r.person, FOLDER_SPOUSE_AVATAR, 0, "10 con")
        : textW(`${r.label ?? ""} · 10 con`, NAME_PT));
  } else if (r.person) {
    w += personW(r.person, FOLDER_AVATAR, 42); // 42 = huy hiệu "Đời N"
    for (const s of r.spouses) w += 28 + personW(s, FOLDER_SPOUSE_AVATAR, 0);
  }
  return w + 12;
}

export interface FolderPdfPageSpec {
  width: number;
  height: number;
  rows: FolderPdfRow[];
}

/** A4 nằm ngang — khổ nhỏ nhất của trang này. */
export const A4_LANDSCAPE = { width: 842, height: 595 };

/**
 * Tính KHỔ GIẤY vừa khít cây đã bung hết.
 *
 * Cả cây nằm trong MỘT cột liền từ trên xuống — không chia cột, vì một
 * nhánh vắt sang cột bên cạnh là mắt mất dấu ngay. Nên chiều DÀI trang
 * tính theo số dòng: bao nhiêu người thì trang dài bấy nhiêu. Bề ngang
 * vừa dòng dài nhất, không hẹp hơn A4 nằm ngang.
 *
 * Chỉ khi chiều dài chạm trần 14.400pt của PDF mới ngắt sang trang kế;
 * các nét dọc vẫn nối tiếp vì mỗi dòng tự mang thông tin nét của mình.
 */
export function paginateFolderRows(
  rows: FolderPdfRow[],
  chrome: { padX: number; padTop: number; padBottom: number; header: number },
): FolderPdfPageSpec[] {
  if (rows.length === 0) return [];
  const widest = rows.reduce((m, r) => Math.max(m, folderRowWidth(r)), 0);
  const width = Math.min(
    PDF_MAX_SIDE,
    Math.max(A4_LANDSCAPE.width, Math.ceil(widest + chrome.padX * 2)),
  );
  const fixed = chrome.padTop + chrome.padBottom + chrome.header;
  const perPage = Math.max(1, Math.floor((PDF_MAX_SIDE - fixed) / FOLDER_ROW_H));

  const pages: FolderPdfPageSpec[] = [];
  for (let i = 0; i < rows.length; i += perPage) {
    const slice = rows.slice(i, i + perPage);
    pages.push({
      width,
      height: Math.max(
        A4_LANDSCAPE.height,
        Math.ceil(fixed + slice.length * FOLDER_ROW_H),
      ),
      rows: slice,
    });
  }
  return pages;
}
