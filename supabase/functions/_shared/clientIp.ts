/**
 * Địa chỉ IP của khách phía edge function. Sau Traefik / Kong, nếu cổng Docker dùng userland-proxy thì IP thật bị thay bằng địa chỉ
 * cổng mạng nội bộ (vd. 172.18.0.1) → MỌI khách trông như CÙNG MỘT IP. Khi đó trần "theo IP" thực chất là trần TOÀN HỆ THỐNG và sẽ chặn
 * người thật. `isPrivateIp` giúp function nhận ra tình huống này để nới / bỏ trần theo IP thay vì khoá cả hệ thống.
 * Không import Deno-only nên test được bằng vitest.
 */

/** IP đầu của X-Forwarded-For, rồi X-Real-IP, không có thì "unknown". */
export function clientIp(headers: {
  get(name: string): string | null;
}): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** true = không phải IP công khai của một khách cụ thể (nội bộ / loopback / link-local / không biết). */
export function isPrivateIp(ip: string): boolean {
  const s = ip.trim().toLowerCase();
  if (!s || s === "unknown") return true;
  const v4 = s.match(
    /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (s.includes(":"))
    return (
      s === "::1" ||
      s === "::" ||
      s.startsWith("fc") ||
      s.startsWith("fd") ||
      s.startsWith("fe80")
    );
  return true; // không nhận ra định dạng → coi như không định danh được
}
