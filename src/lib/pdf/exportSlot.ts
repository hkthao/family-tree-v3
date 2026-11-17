import { supabase } from "@/lib/supabase";

/** Quá hạn chờ thì báo bận thay vì chờ mãi. */
const MAX_WAIT_MS = 5 * 60_000;
const POLL_MS = 3000;

export class ExportBusyError extends Error {
  constructor() {
    super("Hệ thống đang có nhiều người xuất sổ. Vui lòng thử lại sau ít phút.");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Xin một "chỗ" xuất sổ (tối đa vài lượt cùng lúc trên toàn hệ thống, xem migration export_slots)
 * rồi chạy `fn` — phần tốn server (lấy dữ liệu cả dòng họ + tải ảnh). Đủ chỗ thì chạy ngay, hết chỗ thì
 * chờ (báo `onQueued`) và hỏi lại mỗi vài giây. Trả chỗ ngay khi `fn` xong; chỗ cũng tự hết hạn phía
 * server nên đóng tab giữa chừng không giữ chỗ mãi.
 *
 * Lỗi hạ tầng (mạng, hàm chưa có ở máy chủ) thì chạy luôn không cần chỗ: giới hạn này để bảo vệ server,
 * không nên làm hỏng tính năng. Riêng không phải thành viên dòng họ thì dừng.
 */
export async function withExportSlot<T>(
  clanId: string,
  onQueued: (() => void) | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const slot = await acquire(clanId, onQueued);
  try {
    return await fn();
  } finally {
    if (slot) {
      void supabase.rpc("release_export_slot", { p_slot: slot }).then(
        () => undefined,
        () => undefined,
      );
    }
  }
}

async function acquire(clanId: string, onQueued?: () => void): Promise<string | null> {
  const deadline = Date.now() + MAX_WAIT_MS;
  let queued = false;
  for (;;) {
    const { data, error } = await supabase.rpc("acquire_export_slot", { p_clan: clanId });
    if (error) {
      if (error.code === "42501") throw new Error(error.message);
      return null;
    }
    const r = data as { granted?: boolean; slot_id?: string } | null;
    if (r?.granted && r.slot_id) return r.slot_id;
    if (!r) return null;
    if (Date.now() > deadline) throw new ExportBusyError();
    if (!queued) {
      queued = true;
      onQueued?.();
    }
    await sleep(POLL_MS + Math.random() * 1000);
  }
}
