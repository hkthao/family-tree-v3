/**
 * Khai báo bộ tool — CHỈ dữ liệu, không import gì ngoài kiểu.
 *
 * Tách khỏi `tools.ts` để **unit test chạy được ngoài Deno**: phần thực
 * thi tool kéo theo `npm:`/`jsr:` specifier và client Supabase, những thứ
 * vitest không nạp nổi. Mà chính mấy cái schema này mới là chỗ từng làm
 * OpenAI trả 400 — nên nó cần test hơn cả phần thực thi.
 */

import type { ToolSpec } from "../_shared/llm/types.ts";

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: "search_person",
    description:
      "Tìm người trong dòng họ theo tên (không dấu cũng được). Dùng khi câu hỏi nhắc tới một người mà chưa biết id. Trả về tối đa 25 người.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Tên hoặc một phần tên" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_person",
    description:
      "Lấy chi tiết một người: năm sinh, năm mất, ngày giỗ âm lịch, đời thứ mấy, cha mẹ, vợ/chồng, con.",
    parameters: {
      type: "object",
      properties: {
        person_id: { type: "string", description: "id lấy từ search_person" },
      },
      required: ["person_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_kinship",
    description:
      "Tra cách xưng hô giữa hai người trong dòng họ: người A gọi người B là gì và ngược lại. LUÔN dùng tool này cho câu hỏi xưng hô, KHÔNG được tự suy luận chú/bác/cô/cậu/dì.",
    parameters: {
      type: "object",
      properties: {
        person_a_id: { type: "string" },
        person_b_id: { type: "string" },
      },
      required: ["person_a_id", "person_b_id"],
      additionalProperties: false,
    },
  },
  {
    name: "upcoming_anniversaries",
    description:
      "Danh sách ngày giỗ sắp tới, đã quy đổi từ âm lịch sang dương lịch. LUÔN dùng tool này cho câu hỏi về ngày giỗ, KHÔNG được tự tính lịch âm.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Số ngày tới cần xem, mặc định 60, tối đa 400",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "search_book",
    description:
      "Tìm trong tư liệu chữ của dòng họ: phả ký, lời nói đầu, ngoại phả, phụ khảo, di sản (từ đường, tục lệ, giai thoại, kỷ vật) và tiểu sử từng người. Dùng cho câu hỏi về LỊCH SỬ, nguồn gốc, quê quán, di cư, tục lệ, nhà thờ, ý nghĩa tên/chữ lót, hành trạng một người. Truyền vào vài từ khoá chính của câu hỏi.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Từ khoá chính, vd: \"di cư vào Nam chi thứ ba\", \"nhà thờ họ\", \"chữ lót Đức\"",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "clan_stats",
    description:
      "Thống kê nhanh dòng họ: tổng số người, số người còn sống, số đời.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
];
