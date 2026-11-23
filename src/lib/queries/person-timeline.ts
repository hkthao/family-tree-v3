/**
 * Kiểu một mốc dựng tạm từ tiểu sử (dòng họ lịch sử). Dòng thời gian của từng người nay nằm CHUNG trong
 * `clan_timeline_milestones` (cột `person_id`) — xem lib/queries/timeline.ts; bảng cũ `person_timeline` đã ngừng dùng.
 */
export interface TimelineRow {
  year: number;
  /** Can chi của năm, vd "Nhâm Thìn". */
  era: string | null;
  body: string;
}
