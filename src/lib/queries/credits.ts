import { supabase } from "../supabase";

/**
 * Sổ cái quyền lợi — **cố tình đặt tên chung, không phải `ai*`**.
 *
 * Trợ lý AI chỉ là thứ đầu tiên bán được; còn dung lượng ảnh,
 * `profiles.max_clans`, xuất sách PDF… Nếu đặt tên theo AI thì bán thứ
 * thứ hai là phải đẻ ra bảng mới, màn hình mới, doanh thu cộng tay. Xem
 * docs/plan-ai-tro-ly.md §Không đặt tiền tố `ai_`.
 */

/** Loại quyền lợi. Thêm loại mới không phải sửa bảng, chỉ thêm hằng số. */
export const RESOURCE_AI = "ai_request";

export interface CreditQuota {
  balance: number;
  freeThisMonth: number;
  usedThisMonth: number;
}

/**
 * Hạn mức của chính mình.
 *
 * Lời gọi này cũng là chỗ **cấp lượt free của tháng** (RPC tự thêm nếu
 * tháng này chưa có), nên gọi luôn lúc mở khung chat: mở ra là đã có lượt,
 * không phải hỏi câu đầu tiên mới được cấp. Nếu để tới lúc hỏi thì màn
 * hình hiện "còn 0 lượt" ngay khi người dùng chưa làm gì — trông như đã hết.
 *
 * Chưa áp migration (self-host áp tay, có thể chậm hơn bản deploy) thì trả
 * null, và giao diện im lặng bỏ qua phần hạn mức thay vì báo lỗi đỏ.
 */
export async function loadMyQuota(
  resource: string = RESOURCE_AI,
): Promise<CreditQuota | null> {
  const { data, error } = await supabase.rpc("credit_my_quota", {
    p_resource: resource,
  });
  if (error || !data) return null;
  const row = data as {
    balance: number;
    free_this_month: number;
    used_this_month: number;
  };
  return {
    balance: row.balance,
    freeThisMonth: row.free_this_month,
    usedThisMonth: row.used_this_month,
  };
}

export type CreditReason =
  | "monthly_free"
  | "purchase"
  | "consume"
  | "refund"
  | "admin_grant";

export interface CreditEntry {
  id: string;
  resource: string;
  delta: number;
  reason: CreditReason;
  expires_at: string | null;
  at: string;
}

/** Nhãn tiếng Việt cho từng loại bút toán. Người dùng không đọc enum. */
export const CREDIT_REASON_LABEL: Record<CreditReason, string> = {
  monthly_free: "Lượt tặng hằng tháng",
  purchase: "Mua thêm",
  consume: "Hỏi trợ lý",
  refund: "Hoàn lại do lỗi",
  admin_grant: "Quản trị cấp thêm",
};

/**
 * Sổ của chính mình, mới nhất trước.
 *
 * RLS của credit_ledger là `owner_id = auth.uid()` nên đọc thẳng bảng là
 * đủ, không cần endpoint riêng. Bảng này **không chứa nội dung câu hỏi** —
 * đó là lý do trưởng họ và admin xem được sổ mà không đọc được hội thoại.
 */
export async function loadMyLedger(limit = 100): Promise<CreditEntry[]> {
  const { data, error } = await supabase
    .from("credit_ledger")
    .select("id, resource, delta, reason, expires_at, at")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CreditEntry[];
}

/**
 * Số dư sau mỗi bút toán, tính từ dưới lên.
 *
 * Vì sao cần: sổ hiện mới-nhất-trước, mà số dư thì cộng dồn từ cũ tới
 * mới. Không có cột này thì người dùng thấy một dãy "+10, -1, -1" và tự
 * cộng tay — đúng thứ mà một cuốn sổ phải làm thay họ.
 *
 * Hàm thuần, nhận danh sách đã sắp mới→cũ và trả về mảng cùng thứ tự.
 */
export function runningBalances(entries: CreditEntry[]): number[] {
  const out: number[] = new Array(entries.length);
  let running = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    running += entries[i].delta;
    out[i] = running;
  }
  return out;
}
