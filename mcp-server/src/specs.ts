/**
 * Khai báo tool của máy chủ MCP — CHỈ dữ liệu, không import gì (test được độc lập).
 *
 * Mô tả viết bằng tiếng Anh ngắn gọn vì khách của endpoint này là AI bên ngoài
 * (Claude, ChatGPT…), không phải cụ lớn tuổi; nhưng dữ liệu trả về giữ tiếng Việt.
 */

export interface McpToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /**
   * Gói quyền token cần có. 'read' = ai cũng gọi được; 'propose' / 'write' là hai gói loại
   * trừ nhau: propose chỉ gửi vào hàng chờ duyệt, write ghi thẳng như chính chủ token.
   */
  needs: Scope;
}

export type Scope = "read" | "propose" | "write";

/** Gói `scope` của token có được gọi tool cần `needs` không. */
export function scopeAllows(scope: Scope, needs: Scope): boolean {
  return needs === "read" || scope === needs;
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const personId = { type: "string", description: "Person id (UUID) from search_person" };

/** Các trường chỉnh sửa được qua đề xuất — khớp danh sách cột trong apply_contribution. */
export const EDITABLE_FIELDS = [
  "full_name",
  "courtesy_name",
  "posthumous_name",
  "nickname",
  "gender",
  "is_living",
  "birth_date",
  "death_date",
  "birth_place",
  "burial_place",
  "bio",
  "death_anniv_lunar_month",
  "death_anniv_lunar_day",
] as const;

const CHANGES_SCHEMA = {
  type: "object",
  description: `Any of: ${EDITABLE_FIELDS.join(", ")}`,
  additionalProperties: false,
  properties: {
    full_name: { type: "string" },
    courtesy_name: { type: "string" },
    posthumous_name: { type: "string" },
    nickname: { type: "string" },
    gender: { type: "string", enum: ["M", "F"] },
    is_living: { type: "boolean" },
    birth_date: { type: "string", description: "YYYY-MM-DD" },
    death_date: { type: "string", description: "YYYY-MM-DD" },
    birth_place: { type: "string" },
    burial_place: { type: "string" },
    bio: { type: "string" },
    death_anniv_lunar_month: { type: "integer" },
    death_anniv_lunar_day: { type: "integer" },
  },
};

export const MCP_TOOLS: McpToolSpec[] = [
  {
    name: "clan_stats",
    needs: "read",
    description: "Headcount of the family tree: total people, living, number of generations.",
    inputSchema: obj({}),
  },
  {
    name: "search_person",
    needs: "read",
    description:
      "Find people by name (accent-insensitive). Returns up to 25 matches with id, birth/death years and generation. Always call this first to get an id.",
    inputSchema: obj({ name: { type: "string" } }, ["name"]),
  },
  {
    name: "get_person",
    needs: "read",
    description:
      "Details of one person: dates, lunar death anniversary, generation, place of birth/burial, biography.",
    inputSchema: obj({ person_id: personId }, ["person_id"]),
  },
  {
    name: "get_relatives",
    needs: "read",
    description:
      "Parents, spouses and children of one person, each with id so you can walk the tree.",
    inputSchema: obj({ person_id: personId }, ["person_id"]),
  },
  {
    name: "get_kinship",
    needs: "read",
    description:
      "How two people address each other in Vietnamese (chú/bác/cô/cậu/dì…). ALWAYS use this instead of working it out yourself.",
    inputSchema: obj({ person_a_id: personId, person_b_id: personId }, [
      "person_a_id",
      "person_b_id",
    ]),
  },
  {
    name: "upcoming_anniversaries",
    needs: "read",
    description:
      "Upcoming death anniversaries (giỗ), already converted from the lunar to the solar calendar. ALWAYS use this for giỗ dates.",
    inputSchema: obj({
      days: { type: "integer", description: "Look-ahead in days, default 60, max 400" },
    }),
  },
  {
    name: "search_book",
    needs: "read",
    description:
      "Full-text search in the family's written records: preface, chronicle, appendices, heritage items and biographies. Use for history, origin, customs, ancestral hall.",
    inputSchema: obj({ query: { type: "string", description: "A few key words" } }, ["query"]),
  },
  {
    name: "list_my_proposals",
    needs: "read",
    description:
      "Status (pending / approved / rejected / needs_info) of proposals submitted through this token's user.",
    inputSchema: obj({
      status: { type: "string", enum: ["pending", "approved", "rejected", "needs_info"] },
    }),
  },
  {
    name: "propose_add_person",
    needs: "propose",
    description:
      "PROPOSE adding a new person. Nothing is written to the tree: the proposal goes to the review queue and a clan admin must approve it in the app. Optionally link to an existing person as child or spouse.",
    inputSchema: obj(
      {
        full_name: { type: "string" },
        gender: { type: "string", enum: ["M", "F"] },
        is_living: { type: "boolean" },
        birth_date: { type: "string", description: "YYYY-MM-DD" },
        death_date: { type: "string", description: "YYYY-MM-DD" },
        birth_place: { type: "string" },
        burial_place: { type: "string" },
        bio: { type: "string" },
        relation_as: { type: "string", enum: ["child", "spouse"] },
        relation_of_person_id: personId,
        reason: { type: "string", description: "Source / why, shown to the reviewer" },
      },
      ["full_name", "gender"],
    ),
  },
  {
    name: "propose_edit_person",
    needs: "propose",
    description:
      "PROPOSE changes to fields of an existing person. Only the fields you pass change. Goes to the review queue; nothing is written until an admin approves.",
    inputSchema: obj(
      {
        person_id: personId,
        changes: CHANGES_SCHEMA,
        reason: { type: "string", description: "Source / why, shown to the reviewer" },
      },
      ["person_id", "changes"],
    ),
  },
  {
    name: "propose_add_note",
    needs: "propose",
    description:
      "PROPOSE appending a note to a person's biography. Goes to the review queue.",
    inputSchema: obj(
      {
        person_id: personId,
        note: { type: "string" },
        reason: { type: "string" },
      },
      ["person_id", "note"],
    ),
  },
  {
    name: "create_person",
    needs: "write",
    description:
      "Add a new person to the tree DIRECTLY, with the same permissions as the token owner. Optionally link as child or spouse of an existing person. Check search_person first to avoid duplicates.",
    inputSchema: obj(
      {
        full_name: { type: "string" },
        gender: { type: "string", enum: ["M", "F"] },
        is_living: { type: "boolean" },
        birth_date: { type: "string", description: "YYYY-MM-DD" },
        death_date: { type: "string", description: "YYYY-MM-DD" },
        birth_place: { type: "string" },
        burial_place: { type: "string" },
        bio: { type: "string" },
        relation_as: { type: "string", enum: ["child", "spouse"] },
        relation_of_person_id: personId,
      },
      ["full_name", "gender"],
    ),
  },
  {
    name: "update_person",
    needs: "write",
    description:
      "Change fields of an existing person DIRECTLY. Only the fields you pass change. Every change is recorded in the audit log under the token owner.",
    inputSchema: obj(
      { person_id: personId, changes: CHANGES_SCHEMA },
      ["person_id", "changes"],
    ),
  },
  {
    name: "append_person_note",
    needs: "write",
    description: "Append a paragraph to a person's biography DIRECTLY.",
    inputSchema: obj({ person_id: personId, note: { type: "string" } }, ["person_id", "note"]),
  },
  {
    name: "delete_person",
    needs: "write",
    description:
      "Soft-delete a person (restorable from the audit log). Works only if the token owner may delete people in the app (editor/admin). Set confirm=true only after the user explicitly asked for this deletion.",
    inputSchema: obj({ person_id: personId, confirm: { type: "boolean" } }, ["person_id", "confirm"]),
  },
];
