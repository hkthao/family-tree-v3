/**
 * Chữ ký webhook Zalo Mini App (`X-ZEvent-Signature`) — tách riêng, không
 * đụng Deno.env, để test chạy được trên Node.
 *
 * Theo hướng dẫn "verify signature" của Zalo: xếp TÊN TRƯỜNG của body a→z,
 * nối liền các giá trị (giá trị object thì JSON.stringify), rồi
 * sha256(nội dung + API Key) dạng hex.
 */
export function signatureContent(body: Record<string, unknown>): string {
  return Object.keys(body)
    .sort()
    .map((k) => {
      const v = body[k];
      return v !== null && typeof v === "object" ? JSON.stringify(v) : String(v);
    })
    .join("");
}

export async function zaloSignature(body: Record<string, unknown>, apiKey: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signatureContent(body) + apiKey));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** So sánh không lộ thời gian. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
