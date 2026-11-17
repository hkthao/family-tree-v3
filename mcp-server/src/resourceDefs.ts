/**
 * Khai báo CRUD cho các mục "ngoài cây gia phả" của dòng họ: Bảng tin, Phòng ký ức, Ảnh ghép, Di sản, Mộ phần,
 * Quỹ họ, Bảng vàng (+ số liệu Bản đồ). CHỈ dữ liệu, không import gì ngoài kiểu — test được độc lập (xem specs.ts).
 *
 * Mỗi "tài nguyên" khai báo các trường một lần; `resourceSpecs()` sinh schema tool (list/create/update/delete) và
 * `resources.ts` dùng CHÍNH khai báo này để kiểm đầu vào và ghi. Thêm một trường = sửa đúng một chỗ.
 *
 * Quyền: mọi lệnh ghi chạy bằng JWT của chủ token nên RLS của app áp dụng nguyên (đa số mục cần quyền biên tập/quản trị
 * dòng họ). Chỉ gói `write`/`admin` ghi được; tool đọc dùng cho mọi gói.
 */

import type { McpToolSpec } from "./specs.ts";

export type FieldDef =
  | { k: "str"; max: number; req?: boolean; d?: string }
  | { k: "enum"; v: readonly string[]; req?: boolean; d?: string }
  | { k: "int"; min: number; max: number; req?: boolean; d?: string }
  | { k: "num"; min: number; max?: number; gt?: boolean; req?: boolean; d?: string }
  | { k: "bool"; d?: string }
  | { k: "date"; d?: string }
  | { k: "person"; d?: string }
  | { k: "uuid"; d?: string }
  | { k: "url"; max: number; d?: string };

export interface ResourceDef {
  /** Tên số ít trong tên tool: create_<key>, update_<key>, delete_<key>. */
  key: string;
  /** Tên số nhiều: list_<plural>. */
  plural: string;
  table: string;
  /** Mô tả ngắn (tiếng Anh) cho AI. */
  label: string;
  /** Xoá mềm bằng cột `deleted_at` (true) hay xoá hẳn (false). */
  soft: boolean;
  /** Cột sắp xếp danh sách: [cột, tăng dần?]. */
  order: [string, boolean][];
  /** Cột tìm theo chữ (ilike) cho tham số `q`. */
  searchCol?: string;
  /** Trường enum dùng làm bộ lọc của list_*. */
  filters?: string[];
  fields: Record<string, FieldDef>;
  /** Cột có sẵn khi đọc (ngoài `id` và các trường ở `fields`). */
  extraCols?: string[];
  /** Không sinh tool create_* / delete_* chung (có bản riêng ở resources.ts). */
  customCreate?: boolean;
  customDelete?: boolean;
  /** Mô tả thêm cho tool tạo. */
  createHint?: string;
  /** Cột chỉ ghi qua tool riêng, không có trong update chung (vd show_on_dashboard). */
  needs?: "write";
}

const PROVINCE = { k: "str", max: 20, d: "Province code (leave unset if unknown)" } as const;
const WARD = { k: "str", max: 20, d: "Ward/commune code" } as const;
const LAT = { k: "num", min: -90, max: 90, d: "Latitude" } as const;
const LNG = { k: "num", min: -180, max: 180, d: "Longitude" } as const;
const YEAR = { k: "int", min: 1, max: 2100, d: "Year built" } as const;

export const RESOURCES: ResourceDef[] = [
  {
    key: "honor_entry",
    plural: "honor_entries",
    table: "honor_entries",
    label: "Honor-board entry (Bảng vàng công đức): a contribution or achievement recorded for a person",
    soft: true,
    order: [["occurred_on", false], ["created_at", false]],
    searchCol: "honoree_name",
    filters: ["category"],
    extraCols: ["created_at"],
    fields: {
      honoree_name: { k: "str", max: 200, req: true, d: "Name of the person being honored" },
      category: { k: "enum", v: ["donation_money", "donation_labor", "academic", "other"], req: true },
      amount: { k: "num", min: 0, d: "Amount in VND (donation_money)" },
      note: { k: "str", max: 2000 },
      occurred_on: { k: "date", d: "YYYY-MM-DD" },
      person_id: { k: "person", d: "Link to a person in the tree (optional)" },
    },
  },
  {
    key: "fund_transaction",
    plural: "fund_transactions",
    table: "fund_transactions",
    label: "Clan fund transaction (Quỹ họ ledger): money in or out. Every change is audit-logged by the app",
    soft: true,
    order: [["occurred_on", false], ["created_at", false]],
    searchCol: "note",
    filters: ["direction"],
    extraCols: ["created_at"],
    fields: {
      direction: { k: "enum", v: ["in", "out"], req: true, d: "in = money received, out = money spent" },
      amount: { k: "num", min: 0, gt: true, req: true, d: "Amount in VND, > 0" },
      fund: { k: "str", max: 100, req: true, d: "Fund name, e.g. \"Quỹ khuyến học\"" },
      category: { k: "str", max: 100 },
      occurred_on: { k: "date", d: "YYYY-MM-DD; defaults to today" },
      note: { k: "str", max: 2000 },
    },
  },
  {
    key: "heritage_item",
    plural: "heritage_items",
    table: "heritage_items",
    label: "Clan heritage item (Di sản): ancestral hall, custom, story or artifact",
    soft: true,
    order: [["sort", true], ["created_at", false]],
    searchCol: "title",
    filters: ["category", "status"],
    extraCols: ["created_at"],
    fields: {
      category: { k: "enum", v: ["place", "custom", "story", "artifact"], req: true },
      title: { k: "str", max: 300, req: true },
      summary: { k: "str", max: 1000 },
      body: { k: "str", max: 50000, d: "Full text" },
      location_name: { k: "str", max: 300 },
      address: { k: "str", max: 500 },
      latitude: LAT,
      longitude: LNG,
      built_year: YEAR,
      status: { k: "enum", v: ["active", "draft", "archived"] },
      province_code: PROVINCE,
      ward_code: WARD,
    },
  },
  {
    key: "resting_place",
    plural: "resting_places",
    table: "resting_places",
    label: "Resting place (Mộ phần & tro cốt): a grave, ashes temple, columbarium…",
    soft: true,
    order: [["created_at", false]],
    searchCol: "name",
    filters: ["kind", "status"],
    extraCols: ["created_at"],
    fields: {
      kind: { k: "enum", v: ["grave", "ashes_temple", "columbarium", "scattered", "other"], req: true },
      name: { k: "str", max: 300 },
      location_name: { k: "str", max: 300 },
      location_detail: { k: "str", max: 1000, d: "How to find it" },
      address: { k: "str", max: 500 },
      latitude: LAT,
      longitude: LNG,
      orientation: { k: "str", max: 100 },
      status: { k: "enum", v: ["existing", "relocated", "lost"] },
      built_year: YEAR,
      material: { k: "str", max: 200 },
      notes: { k: "str", max: 5000 },
      province_code: PROVINCE,
      ward_code: WARD,
    },
  },
  {
    key: "post",
    plural: "posts",
    table: "clan_posts",
    label: "Clan bulletin post (Bảng tin): news, event, birth, death or notice",
    soft: false,
    order: [["pinned", false], ["created_at", false]],
    searchCol: "title",
    filters: ["type", "status"],
    extraCols: ["status", "pinned", "author_id", "created_at"],
    customCreate: true,
    customDelete: true,
    fields: {
      type: { k: "enum", v: ["news", "event", "birth", "death", "notice"], req: true },
      title: { k: "str", max: 200 },
      body: { k: "str", max: 20000, req: true },
      person_id: { k: "person", d: "Related person (optional)" },
      event_id: { k: "uuid", d: "Related event id from list_events (optional)" },
      event_date: { k: "date", d: "YYYY-MM-DD, for event posts" },
    },
  },
  {
    key: "memory_room",
    plural: "memory_rooms",
    table: "memory_rooms",
    label: "Memory room (Phòng ký ức): a 3D photo gallery. Fill it with add_memory_room_item",
    soft: true,
    order: [["sort", true], ["created_at", false]],
    searchCol: "name",
    extraCols: ["created_at"],
    fields: {
      name: { k: "str", max: 200, req: true },
      description: { k: "str", max: 2000 },
      theme: { k: "str", max: 40, d: "Visual theme id, default \"white\"" },
      cover_image_url: { k: "url", max: 1000, d: "https image link" },
    },
  },
  {
    key: "mosaic",
    plural: "mosaics",
    table: "clan_mosaics",
    label: "Photo mosaic (Ảnh ghép): each member contributes one tile. Members add tiles in the app; here you manage the mosaic and moderate tiles",
    soft: false,
    order: [["created_at", false]],
    searchCol: "title",
    filters: ["status"],
    extraCols: ["show_on_dashboard", "created_at"],
    customDelete: false,
    fields: {
      title: { k: "str", max: 200, req: true },
      description: { k: "str", max: 2000 },
      status: { k: "enum", v: ["open", "closed"], d: "open = members can still add tiles" },
      max_per_member: { k: "int", min: 1, max: 50 },
      cols: { k: "int", min: 2, max: 12, d: "Grid columns" },
      slots: { k: "int", min: 4, max: 150, d: "Total tiles" },
    },
  },
];

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

function jsonType(f: FieldDef): Record<string, unknown> {
  const d = f.d ? { description: f.d } : {};
  switch (f.k) {
    case "str":
    case "url":
      return { type: "string", maxLength: f.max, ...d };
    case "enum":
      return { type: "string", enum: [...f.v], ...d };
    case "int":
      return { type: "integer", minimum: f.min, maximum: f.max, ...d };
    case "num":
      return { type: "number", minimum: f.min, ...(f.max !== undefined ? { maximum: f.max } : {}), ...d };
    case "bool":
      return { type: "boolean", ...d };
    case "date":
      return { type: "string", description: f.d ?? "YYYY-MM-DD" };
    case "person":
    case "uuid":
      return { type: "string", description: f.d ?? "id (UUID)" };
  }
}

/** Cho phép null (xoá trống) với trường không bắt buộc khi cập nhật. */
function nullable(schema: Record<string, unknown>): Record<string, unknown> {
  const t = schema.type as string;
  return { ...schema, type: [t, "null"] };
}

const cap = (s: string) => s.replace(/_/g, " ");

export function resourceSpecs(): McpToolSpec[] {
  const out: McpToolSpec[] = [];
  for (const r of RESOURCES) {
    const filterProps: Record<string, unknown> = {};
    for (const f of r.filters ?? []) filterProps[f] = jsonType(r.fields[f] ?? { k: "str", max: 50 });
    out.push({
      name: `list_${r.plural}`,
      needs: "read",
      description:
        `List ${cap(r.plural)}: ${r.label}. Newest/most relevant first. Pass id to read ONE item in full (list rows truncate long text).`,
      inputSchema: obj({
        id: { type: "string", description: "Return only this item, full text" },
        ...(r.searchCol ? { q: { type: "string", description: `Search ${r.searchCol}` } } : {}),
        ...filterProps,
        limit: { type: "integer", minimum: 1, maximum: 50 },
        offset: { type: "integer", minimum: 0 },
      }),
    });
    if (!r.customCreate) {
      out.push({
        name: `create_${r.key}`,
        needs: "write",
        description: `Create a ${cap(r.key)}. ${r.createHint ?? ""}`.trim(),
        inputSchema: obj(
          Object.fromEntries(Object.entries(r.fields).map(([k, f]) => [k, jsonType(f)])),
          Object.entries(r.fields).filter(([, f]) => "req" in f && f.req).map(([k]) => k),
        ),
      });
    }
    out.push({
      name: `update_${r.key}`,
      needs: "write",
      description: `Change a ${cap(r.key)}; only the fields you pass change (null clears optional ones).`,
      inputSchema: obj(
        {
          [`${r.key}_id`]: { type: "string", description: `Id from list_${r.plural}` },
          ...Object.fromEntries(Object.entries(r.fields).map(([k, f]) => [k, "req" in f && f.req ? jsonType(f) : nullable(jsonType(f))])),
        },
        [`${r.key}_id`],
      ),
    });
    if (!r.customDelete) {
      out.push({
        name: `delete_${r.key}`,
        needs: "write",
        description: `${r.soft ? "Soft-delete" : "Delete"} a ${cap(r.key)}. confirm=true only after the user explicitly asked.`,
        inputSchema: obj({ [`${r.key}_id`]: { type: "string" }, confirm: { type: "boolean" } }, [`${r.key}_id`, "confirm"]),
      });
    }
  }
  return out;
}

const id = (d: string) => ({ type: "string", description: d });

/** Tool riêng (không sinh chung được): bài đăng, mục con, thống kê, quỹ, bản đồ. */
export const EXTRA_SPECS: McpToolSpec[] = [
  // Bảng tin
  {
    name: "create_post",
    needs: "write",
    description:
      "Publish a bulletin post. Clan admins publish immediately; other members' posts go to the moderation queue (status pending) until an admin publishes them.",
    inputSchema: obj(
      Object.fromEntries(Object.entries(RESOURCES.find((r) => r.key === "post")!.fields).map(([k, f]) => [k, jsonType(f)])),
      ["type", "body"],
    ),
  },
  {
    name: "moderate_post",
    needs: "write",
    description: "Moderate a bulletin post (clan admin only): publish a pending post, hide/reject, unhide, pin or unpin.",
    inputSchema: obj(
      { post_id: id("Id from list_posts"), action: { type: "string", enum: ["publish", "reject", "hide", "unhide", "pin", "unpin"] }, note: { type: "string", maxLength: 500 } },
      ["post_id", "action"],
    ),
  },
  {
    name: "delete_post",
    needs: "write",
    description: "Remove a post from the bulletin (it is hidden, not erased, and the moderation log keeps it). Clan admin only. confirm=true only after the user explicitly asked.",
    inputSchema: obj({ post_id: id("Id from list_posts"), confirm: { type: "boolean" } }, ["post_id", "confirm"]),
  },
  // Quỹ họ
  {
    name: "fund_summary",
    needs: "read",
    description: "Clan fund totals: money in, out and balance, overall and per fund. Optional date range on occurred_on.",
    inputSchema: obj({ from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" } }),
  },
  // Di sản
  {
    name: "add_heritage_person",
    needs: "write",
    description: "Link a person from the tree to a heritage item (e.g. who built or is remembered by it).",
    inputSchema: obj({ heritage_item_id: id("Id from list_heritage_items"), person_id: id("Person id from search_person"), role_note: { type: "string", maxLength: 300 } }, ["heritage_item_id", "person_id"]),
  },
  {
    name: "remove_heritage_person",
    needs: "write",
    description: "Unlink a person from a heritage item. confirm=true only after the user explicitly asked.",
    inputSchema: obj({ heritage_item_id: id("Id from list_heritage_items"), person_id: id("Person id"), confirm: { type: "boolean" } }, ["heritage_item_id", "person_id", "confirm"]),
  },
  // Mộ phần
  {
    name: "add_resting_place_occupant",
    needs: "write",
    description: "Record that a person rests at this resting place.",
    inputSchema: obj({ resting_place_id: id("Id from list_resting_places"), person_id: id("Person id from search_person"), note: { type: "string", maxLength: 300 } }, ["resting_place_id", "person_id"]),
  },
  {
    name: "remove_resting_place_occupant",
    needs: "write",
    description: "Remove a person from a resting place's occupants. confirm=true only after the user explicitly asked.",
    inputSchema: obj({ resting_place_id: id("Id from list_resting_places"), person_id: id("Person id"), confirm: { type: "boolean" } }, ["resting_place_id", "person_id", "confirm"]),
  },
  {
    name: "add_resting_place_relocation",
    needs: "write",
    description: "Log that a grave was moved (from where, when). Also set status=relocated with update_resting_place if appropriate.",
    inputSchema: obj(
      { resting_place_id: id("Id from list_resting_places"), from_label: { type: "string", maxLength: 300, description: "Where it was before" }, moved_on: { type: "string", description: "YYYY-MM-DD" }, note: { type: "string", maxLength: 1000 } },
      ["resting_place_id"],
    ),
  },
  {
    name: "list_resting_place_occupants",
    needs: "read",
    description: "Who rests at a resting place, with their names.",
    inputSchema: obj({ resting_place_id: id("Id from list_resting_places") }, ["resting_place_id"]),
  },
  // Phòng ký ức
  {
    name: "list_memory_room_items",
    needs: "read",
    description: "Frames in a memory room: photos (of a member or a https link) and 3D models.",
    inputSchema: obj({ memory_room_id: id("Id from list_memory_rooms") }, ["memory_room_id"]),
  },
  {
    name: "add_memory_room_item",
    needs: "write",
    description:
      "Add a frame to a memory room. kind=photo needs person_id (uses that member's photo) or image_url (https link); kind=model needs model_url (https link to a GLB/GLTF).",
    inputSchema: obj(
      {
        memory_room_id: id("Id from list_memory_rooms"),
        kind: { type: "string", enum: ["photo", "model"] },
        person_id: id("Member whose photo to show (photo)"),
        image_url: { type: "string", maxLength: 1000, description: "https link (photo)" },
        model_url: { type: "string", maxLength: 1000, description: "https link (model)" },
        caption: { type: "string", maxLength: 300 },
        subtitle: { type: "string", maxLength: 300 },
      },
      ["memory_room_id", "kind"],
    ),
  },
  {
    name: "update_memory_room_item",
    needs: "write",
    description: "Change a frame's caption/subtitle (null clears).",
    inputSchema: obj({ item_id: id("Id from list_memory_room_items"), caption: { type: ["string", "null"], maxLength: 300 }, subtitle: { type: ["string", "null"], maxLength: 300 } }, ["item_id"]),
  },
  {
    name: "remove_memory_room_item",
    needs: "write",
    description: "Remove a frame from a memory room. confirm=true only after the user explicitly asked.",
    inputSchema: obj({ item_id: id("Id from list_memory_room_items"), confirm: { type: "boolean" } }, ["item_id", "confirm"]),
  },
  // Ảnh ghép
  {
    name: "set_mosaic_dashboard",
    needs: "write",
    description: "Show (or stop showing) this mosaic on the clan Overview page. Only one mosaic is shown at a time.",
    inputSchema: obj({ mosaic_id: id("Id from list_mosaics"), on: { type: "boolean" } }, ["mosaic_id", "on"]),
  },
  {
    name: "list_mosaic_tiles",
    needs: "read",
    description: "Tiles contributed to a mosaic, with who added them and moderation status.",
    inputSchema: obj({ mosaic_id: id("Id from list_mosaics") }, ["mosaic_id"]),
  },
  {
    name: "set_mosaic_tile_status",
    needs: "write",
    description: "Approve or hide a mosaic tile (moderation).",
    inputSchema: obj({ tile_id: id("Id from list_mosaic_tiles"), status: { type: "string", enum: ["approved", "hidden"] } }, ["tile_id", "status"]),
  },
  {
    name: "delete_mosaic_tile",
    needs: "write",
    description: "Delete a mosaic tile. confirm=true only after the user explicitly asked.",
    inputSchema: obj({ tile_id: id("Id from list_mosaic_tiles"), confirm: { type: "boolean" } }, ["tile_id", "confirm"]),
  },
  // Bản đồ
  {
    name: "map_stats",
    needs: "read",
    description: "Map overview: counts of people, graves and heritage by province code, plus how many have no province yet. No names or addresses.",
    inputSchema: obj({ include_deceased: { type: "boolean", description: "Include deceased people in the people layer (default true)" } }),
  },
];
