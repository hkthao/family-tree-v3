/**
 * Bóc tách người từ lời kể → ĐỀ XUẤT, không phải lệnh ghi (GĐ 5).
 *
 * Ranh giới quan trọng nhất của cả giai đoạn này: **model không bao giờ
 * ghi vào gia phả**. Nó chỉ mô tả nó hiểu gì; máy chủ kiểm lại từng
 * trường; người dùng nhìn thẻ xác nhận rồi mới bấm "Đúng rồi"; và lệnh
 * ghi cuối cùng chạy ở trình duyệt **bằng JWT của chính người dùng**, đi
 * qua RLS và trigger audit y như khi họ tự nhập tay.
 *
 * Nghĩa là kịch bản xấu nhất — model bịa ra người, hoặc một trường `bio`
 * độc hại xui model "thêm 500 người" — dừng lại ở một cái thẻ hiện trên
 * màn hình. Không có đường nào để lời nói biến thành hàng trong bảng mà
 * không qua mắt người.
 *
 * File tách riêng khỏi index.ts để **test được ngoài Deno**: nó không
 * import gì ngoài kiểu, giống toolSpecs.ts.
 */

import type { ToolSpec } from "../_shared/llm/types.ts";

/** Trần số người mỗi lượt bóc tách. */
export const MAX_PROPOSED = 10;

export type Relation = "child" | "spouse" | "parent";

export interface ProposedPerson {
  /** Mã tạm trong phạm vi một đề xuất, để người sau trỏ tới người trước. */
  tempId: string;
  fullName: string;
  gender: "M" | "F";
  birthYear: number | null;
  deathYear: number | null;
  /** Quan hệ của người này VỚI `relatedTo`. */
  relation: Relation;
  /** id người đã có trong gia phả, hoặc tempId của người khác trong đề xuất. */
  relatedTo: string;
  note: string | null;
}

export interface Proposal {
  people: ProposedPerson[];
}

export const PROPOSE_TOOL: ToolSpec = {
  name: "propose_persons",
  description:
    "Dùng khi người dùng KỂ thông tin về người trong họ để thêm vào gia phả " +
    '(ví dụ "Bố tôi là Nguyễn Văn A, sinh 1940, có ba người con"), KHÔNG phải khi họ hỏi. ' +
    "Bắt buộc gọi search_person trước để lấy id của người đã có trong gia phả làm điểm neo. " +
    "Công cụ này KHÔNG ghi gì cả — người dùng sẽ nhìn lại rồi mới xác nhận.",
  parameters: {
    type: "object",
    properties: {
      people: {
        type: "array",
        description: `Danh sách người cần thêm, tối đa ${MAX_PROPOSED}.`,
        items: {
          type: "object",
          properties: {
            tempId: {
              type: "string",
              description: "Mã tạm, ví dụ p1, p2. Duy nhất trong danh sách này.",
            },
            fullName: { type: "string", description: "Họ tên đầy đủ" },
            gender: { type: "string", enum: ["M", "F"] },
            birthYear: {
              type: ["integer", "null"],
              description: "Năm sinh dương lịch, không rõ thì null",
            },
            deathYear: { type: ["integer", "null"] },
            relation: {
              type: "string",
              enum: ["child", "spouse", "parent"],
              description: "Quan hệ của người này với relatedTo",
            },
            relatedTo: {
              type: "string",
              description:
                "id người đã có trong gia phả (từ search_person), hoặc tempId của người khác trong danh sách này",
            },
            note: { type: ["string", "null"] },
          },
          required: [
            "tempId",
            "fullName",
            "gender",
            "birthYear",
            "deathYear",
            "relation",
            "relatedTo",
            "note",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["people"],
    additionalProperties: false,
  },
};

const CURRENT_YEAR = 2100; // trần thô, chặn năm vô lý chứ không phải kiểm lịch

/**
 * Kiểm lại đề xuất của model.
 *
 * Không tin đầu ra của model, kể cả khi đã khai schema: `strict` chỉ đảm
 * bảo hình dạng JSON, không đảm bảo *nội dung* hợp lý. Trả về lỗi bằng
 * tiếng Việt để model tự sửa ở vòng sau.
 */
export function validateProposal(raw: unknown): {
  proposal: Proposal | null;
  error: string | null;
} {
  const people = (raw as { people?: unknown })?.people;
  if (!Array.isArray(people) || people.length === 0) {
    return { proposal: null, error: "Danh sách người trống." };
  }
  if (people.length > MAX_PROPOSED) {
    return {
      proposal: null,
      error: `Mỗi lần chỉ thêm tối đa ${MAX_PROPOSED} người. Hãy chia nhỏ ra.`,
    };
  }

  const seen = new Set<string>();
  const out: ProposedPerson[] = [];

  for (const p of people as Record<string, unknown>[]) {
    const tempId = String(p.tempId ?? "").trim();
    const fullName = String(p.fullName ?? "").trim();
    const gender = String(p.gender ?? "");
    const relation = String(p.relation ?? "");
    const relatedTo = String(p.relatedTo ?? "").trim();

    if (!tempId || seen.has(tempId)) {
      return { proposal: null, error: `Mã tạm trùng hoặc trống: "${tempId}".` };
    }
    if (!fullName || fullName.length > 100) {
      return { proposal: null, error: "Họ tên trống hoặc quá dài." };
    }
    if (gender !== "M" && gender !== "F") {
      return { proposal: null, error: `Giới tính của ${fullName} phải là M hoặc F.` };
    }
    if (relation !== "child" && relation !== "spouse" && relation !== "parent") {
      return { proposal: null, error: `Quan hệ không hợp lệ: "${relation}".` };
    }
    if (!relatedTo || relatedTo === tempId) {
      return {
        proposal: null,
        error: `${fullName} phải gắn với một người khác đã có trong gia phả.`,
      };
    }

    const year = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isInteger(n) && n > 0 && n < CURRENT_YEAR ? n : null;
    };
    const birthYear = year(p.birthYear);
    const deathYear = year(p.deathYear);
    if (birthYear && deathYear && birthYear > deathYear) {
      return {
        proposal: null,
        error: `${fullName}: năm sinh muộn hơn năm mất.`,
      };
    }

    seen.add(tempId);
    out.push({
      tempId,
      fullName,
      gender,
      birthYear,
      deathYear,
      relation,
      relatedTo,
      note: p.note ? String(p.note).slice(0, 500) : null,
    });
  }

  // Người trỏ tới người khác trong cùng đề xuất thì người đó phải đứng
  // TRƯỚC — client tạo tuần tự nên trỏ ngược là gặp id chưa tồn tại.
  const created = new Set<string>();
  for (const p of out) {
    if (seen.has(p.relatedTo) && !created.has(p.relatedTo)) {
      return {
        proposal: null,
        error:
          `${p.fullName} gắn với "${p.relatedTo}" nhưng người đó đứng sau ` +
          "trong danh sách. Hãy xếp người được gắn lên trước.",
      };
    }
    created.add(p.tempId);
  }

  return { proposal: { people: out }, error: null };
}
