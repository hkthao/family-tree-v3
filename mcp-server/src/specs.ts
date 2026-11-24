/**
 * Khai báo tool của máy chủ MCP — CHỈ dữ liệu, không import gì (test được độc lập).
 *
 * Mô tả viết bằng tiếng Anh ngắn gọn vì khách của endpoint này là AI bên ngoài
 * (Claude, ChatGPT…), không phải cụ lớn tuổi; nhưng dữ liệu trả về giữ tiếng Việt.
 */

import { CATEGORIES } from "../../supabase/functions/publish-so-tay/core.ts";
import { personProperties } from "./fields.ts";
import { EXTRA_SPECS, resourceSpecs } from "./resourceDefs.ts";

export interface McpToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /**
   * Gói quyền token cần có. 'read' = ai cũng gọi được; 'propose' / 'write' là hai gói loại
   * trừ nhau: propose chỉ gửi vào hàng chờ duyệt, write ghi thẳng như chính chủ token; 'admin' = chức năng quản trị
   * hệ thống (chỉ token admin).
   */
  needs: Scope;
  /** Tool không thuộc về một dòng họ cụ thể (vd list_my_clans): không bị thêm tham số `clan`. */
  global?: boolean;
}

export type Scope = "read" | "propose" | "write" | "admin";

/**
 * Gói `scope` của token có được gọi tool cần `needs` không.
 *  - tool đọc: mọi gói;
 *  - propose / write: chỉ đúng gói đó — RIÊNG `admin` cũng gọi được tool `write` (ghi thẳng trên dòng họ nó chọn);
 *  - tool quản trị hệ thống (`needs: "admin"`): chỉ gói admin.
 */
export function scopeAllows(scope: Scope, needs: Scope): boolean {
  if (needs === "read") return true;
  // Gói admin: ghi thẳng + quản trị, và cả ĐỀ XUẤT — tổng hợp đóng góp cộng đồng vào gia phả luôn đi qua
  // propose_* (admin duyệt trong app), kể cả khi AI cầm token admin.
  if (scope === "admin") return needs === "write" || needs === "admin" || needs === "propose";
  return scope === needs;
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const personId = { type: "string", description: "Person id (UUID) from search_person" };
/** Đóng góp cộng đồng làm nguồn cho đề xuất — admin duyệt thì các đóng góp này tự đánh dấu "đã đưa vào gia phả". */
const sourceMemoryIds = {
  type: "array",
  items: { type: "string" },
  maxItems: 20,
  description:
    "Ids of community contributions (from list_memories) this proposal is based on. When an admin approves the proposal, those contributions are marked as applied to the family tree.",
};

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
    name: "list_my_clans",
    needs: "read",
    global: true,
    description:
      "List the clans this connection can work in (name, description, headcount, permission). Call this first when the user names a clan " +
      "(e.g. \"họ Huỳnh\") — then pass that name as `clan` to other tools. Never ask the user for a clan id; they do not know it.",
    inputSchema: obj({ q: { type: "string", description: "Optional: filter by part of the clan name" } }),
  },
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
    name: "get_biography_sources",
    needs: "read",
    description:
      "Everything needed to DRAFT a professional biography of one person in a single call: recorded facts (names, dates, places, generation), parents / spouses / children, the current biography, and every approved community contribution the authors allowed for reuse — each numbered [n] with its id, author and source — plus writing guidelines. Then send the draft with propose_edit_person (changes.bio, replaces the biography) or propose_add_note (appends), passing source_memory_ids. An admin reviews it before anything changes.",
    inputSchema: obj({ person_id: personId }, ["person_id"]),
  },
  {
    name: "list_memories",
    needs: "read",
    description:
      "Community contributions about people (stories, old photos, answers to family questions) that relatives submitted and the clan approved, and whose authors allowed reuse for biographies. Use these as SOURCES to draft a biography or fix facts — then call propose_add_note / propose_edit_person with source_memory_ids. Never write directly; an admin reviews every proposal. Each item shows author, relation, approximate year, place, how they know, and whether it was already applied to the tree.",
    inputSchema: obj({
      person_id: { ...personId, description: "Only contributions about this person (from search_person)" },
      not_applied: { type: "boolean", description: "Only contributions not yet applied to the tree" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
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
        source_memory_ids: sourceMemoryIds,
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
        source_memory_ids: sourceMemoryIds,
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
        source_memory_ids: sourceMemoryIds,
      },
      ["person_id", "note"],
    ),
  },
  {
    name: "list_persons",
    needs: "read",
    description:
      "List/filter people with pagination (max 50 per page): by name text, branch, generation, gender, living or not. Use offset to page. Returns id, years, generation and sibling order.",
    inputSchema: obj({
      q: { type: "string", description: "Name text (accent-insensitive)" },
      branch_id: { type: "string" },
      generation: { type: "integer" },
      gender: { type: "string", enum: ["M", "F"] },
      is_living: { type: "boolean" },
      limit: { type: "integer", description: "1-50, default 25" },
      offset: { type: "integer" },
    }),
  },
  {
    name: "get_tree",
    needs: "read",
    description:
      "Indented text tree: descendants (with spouses) or ancestors of one person, up to 8 generations. Good for reading the family structure at a glance.",
    inputSchema: obj(
      {
        person_id: personId,
        direction: { type: "string", enum: ["descendants", "ancestors"], description: "Default descendants" },
        depth: { type: "integer", description: "Generations to show, 1-8, default 3" },
      },
      ["person_id"],
    ),
  },
  {
    name: "list_branches",
    needs: "read",
    description: "List clan branches (chi/nhánh) with ids, ancestral house and head.",
    inputSchema: obj({}),
  },
  {
    name: "list_events",
    needs: "read",
    description: "List the clan's own events (reunions, memorials, tomb visits…), solar or lunar dated.",
    inputSchema: obj({}),
  },
  {
    name: "get_clan_info",
    needs: "read",
    description: "Clan name, description, visibility, headcount and display settings.",
    inputSchema: obj({}),
  },
  {
    name: "get_book_texts",
    needs: "read",
    description:
      "The clan book's (Sổ gia phả) hand-written parts and its info block (Thông tin cho sổ gia phả: place line, origin, ancestral hall, ancestor anniversary, clan chief, compilers, year, contact). Edit with update_book_texts; clan name/description are in get_clan_info / update_clan_info.",
    inputSchema: obj({}),
  },
  {
    name: "export_clan_book",
    needs: "read",
    description:
      "Build the clan's family-book PDF (cover, table of contents, tree diagrams, per-person pages) and return a time-limited download link (30 min). The file is temporary and cleaned up automatically. Slow for big clans (seconds to minutes); only one export runs at a time. The cover has no QR code (no public share link is created).",
    inputSchema: obj({
      tree: { type: "boolean", description: "Include tree diagrams, default true" },
      folder_tree: { type: "boolean", description: "Include the folder-style tree page, default true" },
      detail: { type: "boolean", description: "Include per-person detail pages, default true" },
      tree_per_page: { type: "integer", minimum: 4, maximum: 60, description: "Max members per diagram page" },
      tree_single_page: { type: "boolean", description: "Draw the whole diagram on one page, default true" },
      watermark: { type: "string", enum: ["phoenix", "dragon", "none"], description: "Faint background image, default phoenix" },
    }),
  },
  {
    name: "create_person",
    needs: "write",
    description:
      "Add a new person DIRECTLY (same permissions as the token owner). Accepts every person field. Optionally link at creation: relation_as child|spouse|parent of relation_of_person_id (use other_parent_id to pick which marriage a child belongs to). Check search_person first to avoid duplicates.",
    inputSchema: obj(
      {
        ...personProperties(),
        relation_as: { type: "string", enum: ["child", "spouse", "parent"], description: "How the NEW person relates to relation_of_person_id" },
        relation_of_person_id: personId,
        other_parent_id: { type: "string", description: "With relation_as=child: the child's other parent (picks the right marriage)" },
      },
      ["full_name", "gender"],
    ),
  },
  {
    name: "update_person",
    needs: "write",
    description:
      "Change fields of an existing person DIRECTLY; only the fields in `changes` change, pass null to clear an optional field. Dates accept YYYY-MM-DD, YYYY-MM or YYYY. Recorded in the audit log under the token owner.",
    inputSchema: obj({ person_id: personId, changes: { type: "object", additionalProperties: false, properties: personProperties() } }, ["person_id", "changes"]),
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
      "Soft-delete a person (recover with restore_person). Works only if the token owner may delete people in the app. Set confirm=true only after the user explicitly asked for this deletion.",
    inputSchema: obj({ person_id: personId, confirm: { type: "boolean" } }, ["person_id", "confirm"]),
  },
  {
    name: "restore_person",
    needs: "write",
    description: "Restore a soft-deleted person by id.",
    inputSchema: obj({ person_id: personId }, ["person_id"]),
  },
  {
    name: "link_relation",
    needs: "write",
    description:
      "Link two EXISTING people. relation says what other_person_id is to person_id: parent (other is father/mother of person), child (other is a child of person; optional other_parent_id picks the marriage) or spouse. Cycles and same-sex pairs are refused by the server.",
    inputSchema: obj(
      {
        person_id: personId,
        relation: { type: "string", enum: ["parent", "child", "spouse"] },
        other_person_id: personId,
        other_parent_id: { type: "string", description: "Only with relation=child" },
      },
      ["person_id", "relation", "other_person_id"],
    ),
  },
  {
    name: "unlink_relation",
    needs: "write",
    description: "Remove a parent/child/spouse link between two people. Neither person is deleted.",
    inputSchema: obj(
      { person_id: personId, relation: { type: "string", enum: ["parent", "child", "spouse"] }, other_person_id: personId },
      ["person_id", "relation", "other_person_id"],
    ),
  },
  {
    name: "set_spouse_order",
    needs: "write",
    description: "Set the order of a person's marriages (first wife/husband first). spouse_ids must list every spouse in the desired order.",
    inputSchema: obj({ person_id: personId, spouse_ids: { type: "array", items: { type: "string" } } }, ["person_id", "spouse_ids"]),
  },
  {
    name: "set_person_photo",
    needs: "write",
    description:
      "Set a person's profile photo from an https image_url OR image_base64 (JPEG/PNG/WebP, ≤10 MB). It is resized to 512px JPEG like the app does. Private/internal addresses are refused.",
    inputSchema: obj({ person_id: personId, image_url: { type: "string" }, image_base64: { type: "string" } }, ["person_id"]),
  },
  {
    name: "remove_person_photo",
    needs: "write",
    description: "Remove a person's profile photo.",
    inputSchema: obj({ person_id: personId }, ["person_id"]),
  },
  {
    name: "create_branch",
    needs: "write",
    description: "Create a branch (chi/nhánh). Assign people with update_person { branch_id }.",
    inputSchema: obj(
      { name: { type: "string" }, head_person_id: { type: ["string", "null"] }, ancestral_house: { type: ["string", "null"] }, notes: { type: ["string", "null"] } },
      ["name"],
    ),
  },
  {
    name: "update_branch",
    needs: "write",
    description: "Change a branch; only the fields you pass change (null clears optional ones).",
    inputSchema: obj(
      { branch_id: { type: "string" }, name: { type: "string" }, head_person_id: { type: ["string", "null"] }, ancestral_house: { type: ["string", "null"] }, notes: { type: ["string", "null"] } },
      ["branch_id"],
    ),
  },
  {
    name: "delete_branch",
    needs: "write",
    description: "Soft-delete a branch. confirm=true only after the user explicitly asked.",
    inputSchema: obj({ branch_id: { type: "string" }, confirm: { type: "boolean" } }, ["branch_id", "confirm"]),
  },
  {
    name: "create_event",
    needs: "write",
    description:
      "Create a clan event. Give EXACTLY ONE of date_solar (YYYY-MM-DD) or lunar_month (+ lunar_day, optional lunar_year / lunar_is_leap). is_yearly defaults true.",
    inputSchema: obj(
      {
        title: { type: "string" },
        event_type: { type: "string", enum: ["custom", "reunion", "memorial", "tomb_visit"] },
        date_solar: { type: ["string", "null"] },
        lunar_year: { type: ["integer", "null"] },
        lunar_month: { type: ["integer", "null"] },
        lunar_day: { type: ["integer", "null"] },
        lunar_is_leap: { type: "boolean" },
        is_yearly: { type: "boolean" },
        related_person_id: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
      },
      ["title"],
    ),
  },
  {
    name: "update_event",
    needs: "write",
    description: "Change an event; only the fields you pass change. To switch between solar and lunar dating set the other group to null.",
    inputSchema: obj(
      {
        event_id: { type: "string" },
        title: { type: "string" },
        event_type: { type: "string", enum: ["custom", "reunion", "memorial", "tomb_visit"] },
        date_solar: { type: ["string", "null"] },
        lunar_year: { type: ["integer", "null"] },
        lunar_month: { type: ["integer", "null"] },
        lunar_day: { type: ["integer", "null"] },
        lunar_is_leap: { type: "boolean" },
        is_yearly: { type: "boolean" },
        related_person_id: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
      },
      ["event_id"],
    ),
  },
  {
    name: "delete_event",
    needs: "write",
    description: "Delete an event. confirm=true only after the user explicitly asked.",
    inputSchema: obj({ event_id: { type: "string" }, confirm: { type: "boolean" } }, ["event_id", "confirm"]),
  },
  {
    name: "update_clan_info",
    needs: "write",
    description:
      "Change the clan's name, description or generation_offset (admin only). Visibility, public flags, limits and feature toggles are deliberately NOT editable here.",
    inputSchema: obj({ name: { type: "string" }, description: { type: ["string", "null"] }, generation_offset: { type: "integer", minimum: 0, maximum: 3 } }),
  },
  {
    name: "update_book_texts",
    needs: "write",
    description:
      "Update the clan book (Sổ gia phả): the info block printed on the cover/first page (Thông tin cho sổ gia phả) and the four written parts. Only passed fields change; null clears. Editors and admins can write. Clan name/description: update_clan_info. Branches: create/update_branch.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        (
          [
            ["place_line", "Địa danh dưới tựa sách — place line under the book title (village/commune/district/province)", 300],
            ["origin_place", "Nguyên quán / tổ quán — the clan's place of origin", 300],
            ["ancestral_hall", "Nhà thờ họ — name and address of the ancestral hall", 300],
            ["ancestor_anniversary", "Ngày giỗ tổ — ancestor memorial day, free text, e.g. '10 tháng 3 âm lịch'", 300],
            ["chief_name", "Trưởng họ / người chủ trì — clan chief", 200],
            ["compilers", "Ban biên soạn — compilers' names", 500],
            ["compiled_year", "Năm biên soạn — year compiled, e.g. '2026'", 50],
            ["contact", "Liên hệ — phone/email of the book keeper", 300],
            ["preface", "Lời nói đầu — preface", 50000],
            ["phaky", "Phả ký — the clan chronicle", 50000],
            ["ngoai_pha", "Ngoại phả — maternal / in-law records", 50000],
            ["phu_khao", "Phụ khảo — appendices / notes", 50000],
          ] as const
        ).map(([k, d, max]) => [k, { type: ["string", "null"], maxLength: max, description: d }]),
      ),
      required: [],
    },
  },
  // Bảng tin, Phòng ký ức, Ảnh ghép, Di sản, Mộ phần, Quỹ họ, Bảng vàng, Bản đồ — xem resourceDefs.ts.
  ...resourceSpecs(),
  ...EXTRA_SPECS,
];

// ─── Token ADMIN HỆ THỐNG ──────────────────────────────────────────────────


const clanProp = {
  type: "string",
  description:
    "Which clan to work in: its NAME as the user says it (e.g. \"Huỳnh\" or \"Dòng họ Huỳnh\") or its id. Not sure → call list_my_clans. " +
    "If several clans match, ask the user which one — never guess and never ask the user for an id.",
};

/** Token admin / kết nối nhiều họ không gắn một dòng họ: mọi tool theo dòng họ nhận thêm `clan` (bắt buộc), nhận tên hoặc mã. */
export function withClanId(t: McpToolSpec): McpToolSpec {
  if (t.global) return t;
  const schema = t.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
  return {
    ...t,
    inputSchema: {
      ...t.inputSchema,
      properties: { clan: clanProp, ...(schema.properties ?? {}) },
      required: ["clan", ...(schema.required ?? [])],
    },
  };
}

const uuidProp = (d: string) => ({ type: "string", description: d });
const dangerous = {
  confirm: { type: "boolean", description: "Must be true — only after the human explicitly asked for this exact action" },
  reason: { type: "string", description: "Why (min 5 chars). Recorded in the admin log." },
};

export const MCP_ADMIN_TOOLS: McpToolSpec[] = [
  { name: "admin_platform_stats", needs: "admin", description: "Platform-wide DB statistics (counts, sizes, recent failed notifications).", inputSchema: obj({}) },
  {
    name: "admin_list_users",
    needs: "admin",
    description: "List user accounts (name, email, limits, suspended / platform-admin flags). Filter by name or email text; paginate with offset.",
    inputSchema: obj({ q: { type: "string" }, limit: { type: "integer", description: "1-100, default 30" }, offset: { type: "integer" } }),
  },
  {
    name: "admin_set_user_limits",
    needs: "admin",
    description: "Set how many clans a user may create (max_clans).",
    inputSchema: obj({ user_id: uuidProp("User id"), max_clans: { type: "integer", minimum: 0, maximum: 1000 } }, ["user_id", "max_clans"]),
  },
  {
    name: "admin_user_action",
    needs: "admin",
    description:
      "Account action: suspend, unsuspend or signout (drop sessions). suspend needs confirm=true and a reason; you cannot suspend yourself. Deleting accounts and granting/revoking platform admin are NOT available over MCP — do them in the admin UI.",
    inputSchema: obj(
      {
        user_id: uuidProp("Target user id"),
        action: { type: "string", enum: ["suspend", "unsuspend", "signout"] },
        ...dangerous,
      },
      ["user_id", "action"],
    ),
  },
  {
    name: "admin_list_clans",
    needs: "admin",
    description: "List every clan with owner, headcount and limits. Filter by name text; sort by newest|name|members|updated; paginate with offset.",
    inputSchema: obj({
      q: { type: "string" },
      sort: { type: "string", enum: ["newest", "name", "members", "updated"] },
      limit: { type: "integer", description: "1-100, default 30" },
      offset: { type: "integer" },
    }),
  },
  {
    name: "admin_set_clan_limits",
    needs: "admin",
    description: "Set a clan's person and account limits.",
    inputSchema: obj({ clan_id: { type: "string", description: "Clan id (UUID) — from admin_list_clans." }, max_persons: { type: "integer", minimum: 1 }, max_users: { type: "integer", minimum: 1 } }, ["clan_id"]),
  },
  {
    name: "admin_list_contributions",
    needs: "admin",
    description: "Contribution proposals across ALL clans (default status pending). Each shows clan, type, target person and the proposed data.",
    inputSchema: obj({
      clan_id: { type: "string" },
      status: { type: "string", enum: ["pending", "approved", "rejected", "needs_info"] },
      limit: { type: "integer", description: "1-50, default 20" },
    }),
  },
  {
    name: "admin_review_contribution",
    needs: "admin",
    description: "Approve (applies the change to the tree), reject, or mark needs_info for a pending contribution. Approving writes real data.",
    inputSchema: obj(
      { contribution_id: uuidProp("Contribution id"), decision: { type: "string", enum: ["approve", "reject", "needs_info"] }, note: { type: "string", description: "Reviewer note shown to the submitter" } },
      ["contribution_id", "decision"],
    ),
  },
  {
    name: "admin_list_feedback",
    needs: "admin",
    description: "User feedback / bug reports (newest first), optionally by status.",
    inputSchema: obj({ status: { type: "string", enum: ["new", "seen", "resolved", "spam"] }, limit: { type: "integer", description: "1-100, default 30" } }),
  },
  {
    name: "admin_update_feedback",
    needs: "admin",
    description: "Update a feedback item: status, category, internal admin_note, or admin_reply shown to the sender.",
    inputSchema: obj(
      {
        feedback_id: uuidProp("Feedback id"),
        status: { type: "string", enum: ["new", "seen", "resolved", "spam"] },
        category: { type: "string", enum: ["bug", "idea", "question", "other"] },
        admin_note: { type: ["string", "null"] },
        admin_reply: { type: ["string", "null"] },
      },
      ["feedback_id"],
    ),
  },
  {
    name: "admin_list_articles",
    needs: "admin",
    description: "List Sổ tay / Blog articles stored as files in the content repo: slug · status · category · title. Optional q filters slugs.",
    inputSchema: obj({ q: { type: "string", description: "Text to match in the slug" } }),
  },
  {
    name: "admin_get_article",
    needs: "admin",
    description: "Read one article's Markdown file (frontmatter + body) by slug, e.g. to review or revise it before overwriting.",
    inputSchema: obj({ slug: { type: "string", description: "Article slug (from admin_list_articles)" } }, ["slug"]),
  },
  {
    name: "admin_publish_article",
    needs: "admin",
    description:
      "Write a Sổ tay / Blog article (Markdown body) into the content repo as the platform admin. status=needs_review (default) only saves it, nothing goes public. status=published makes it public and triggers a full site deploy — requires confirm=true + reason, only after the human explicitly asked to publish. Existing slugs need overwrite=true; articles with infobox/images/faq/sources cannot be overwritten (edit the file directly). Body is plain Markdown: no HTML script/iframe/onclick.",
    inputSchema: obj(
      {
        title: { type: "string", description: "1-140 chars" },
        description: { type: "string", description: "20-320 chars, shown in search results and cards" },
        category: { type: "string", enum: [...CATEGORIES] },
        body: { type: "string", description: "Markdown article body" },
        status: { type: "string", enum: ["needs_review", "published"], description: "default needs_review" },
        slug: { type: "string", description: "Optional; derived from the title when omitted" },
        tags: { type: "array", items: { type: "string" } },
        aliases: { type: "array", items: { type: "string" } },
        regions: { type: "array", items: { type: "string" } },
        timing: { type: "string" },
        overwrite: { type: "boolean", description: "Replace an existing article with the same slug" },
        ...dangerous,
      },
      ["title", "description", "category", "body"],
    ),
  },
  { name: "admin_list_announcements", needs: "admin", description: "All announcements including drafts and expired ones.", inputSchema: obj({}) },
  {
    name: "admin_create_announcement",
    needs: "admin",
    description: "Create an announcement. Omit published_at for a draft; is_public=true shows it on the public changelog page.",
    inputSchema: obj(
      {
        title: { type: "string" },
        body: { type: "string" },
        level: { type: "string", enum: ["info", "update", "warning", "critical"] },
        is_public: { type: "boolean" },
        published_at: { type: ["string", "null"], description: "ISO datetime; null = draft" },
        publish_now: { type: "boolean", description: "true = publish immediately (published_at = now) when published_at is not given" },
        expires_at: { type: ["string", "null"], description: "ISO datetime; null = never" },
      },
      ["title", "body"],
    ),
  },
  {
    name: "admin_update_announcement",
    needs: "admin",
    description: "Change an announcement; only the fields you pass change.",
    inputSchema: obj(
      {
        announcement_id: uuidProp("Announcement id"),
        title: { type: "string" },
        body: { type: "string" },
        level: { type: "string", enum: ["info", "update", "warning", "critical"] },
        is_public: { type: "boolean" },
        published_at: { type: ["string", "null"] },
        expires_at: { type: ["string", "null"] },
      },
      ["announcement_id"],
    ),
  },
  {
    name: "admin_delete_announcement",
    needs: "admin",
    description: "Delete an announcement permanently.",
    inputSchema: obj({ announcement_id: uuidProp("Announcement id"), ...dangerous }, ["announcement_id", "confirm", "reason"]),
  },
  {
    name: "admin_get_settings",
    needs: "admin",
    description: "Platform settings (key/value). Pass key for one value, or omit to list all keys.",
    inputSchema: obj({ key: { type: "string" } }),
  },
  {
    name: "admin_list_failed_notifications",
    needs: "admin",
    description: "Recently failed email/push notifications from the platform stats.",
    inputSchema: obj({}),
  },
  {
    name: "admin_clear_failed_notification",
    needs: "admin",
    description: "Dismiss one failed-notification entry.",
    inputSchema: obj({ notification_id: uuidProp("Failed notification id") }, ["notification_id"]),
  },
  { name: "admin_list_api_tokens", needs: "admin", description: "Every MCP token on the platform (never the secret): owner, clan, scope, expiry, last use.", inputSchema: obj({}) },
  {
    name: "admin_revoke_api_token",
    needs: "admin",
    description: "Revoke any MCP token immediately (use when a leak is suspected). You cannot revoke the token you are using.",
    inputSchema: obj({ token_id: uuidProp("Token id from admin_list_api_tokens"), ...dangerous }, ["token_id", "confirm", "reason"]),
  },
  {
    name: "admin_audit_log",
    needs: "admin",
    description: "Log of what admin MCP tokens did (tool, clan, arguments, result). Newest first.",
    inputSchema: obj({ limit: { type: "integer", description: "1-100, default 30" }, tool: { type: "string", description: "Filter by exact tool name" } }),
  },
];

/** Danh sách tool một gói được thấy; token admin thấy tool theo dòng họ (kèm clan_id) và tool quản trị. */
export function toolsForScope(scope: Scope): McpToolSpec[] {
  if (scope === "admin") {
    return [...MCP_TOOLS.filter((t) => t.needs === "read" || t.needs === "write").map(withClanId), ...MCP_ADMIN_TOOLS];
  }
  return MCP_TOOLS.filter((t) => scopeAllows(scope, t.needs));
}
