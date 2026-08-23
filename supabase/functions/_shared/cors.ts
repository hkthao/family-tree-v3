/**
 * CORS + response helpers dùng chung cho mọi Edge Function.
 *
 * Trước đây mỗi function tự khai lại khối CORS và hàm json/err giống hệt
 * nhau (submit-contribution, share-view, admin-action…). Tách ra đây để
 * function mới không phải chép lại, và để sửa một chỗ là áp cho tất cả.
 */

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
} as const;

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/**
 * Lỗi trả về cho client. `message` đi thẳng ra giao diện nên viết bằng
 * tiếng Việt, câu ngắn, nói được người dùng nên làm gì tiếp.
 */
export function err(message: string, status = 400): Response {
  return json({ error: message }, { status });
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response(null, { headers: CORS }) : null;
}
