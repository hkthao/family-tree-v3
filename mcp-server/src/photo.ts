/**
 * Ảnh đại diện từ AI: nhận URL https hoặc base64, nén về đúng chuẩn của app
 * (≤ 512×512, JPEG, ≤ ~80 KB — xem src/lib/photoUpload.ts) rồi trả buffer để tải lên Storage.
 *
 * Bảo mật (SSRF): server này nằm CÙNG mạng docker với nginx/Umami/FE, nên tải URL do AI đưa vào là
 * đường dễ chạm dịch vụ nội bộ. Nên:
 *  - chỉ https, cổng 443 mặc định hoặc cổng do URL nêu — không cho IP thuần nội bộ;
 *  - kiểm địa chỉ ĐÚNG LÚC KẾT NỐI (`lookup` tuỳ biến), không kiểm trước rồi để thư viện tự phân giải
 *    lại — nếu không, DNS rebinding vẫn lọt;
 *  - theo redirect thủ công (≤ 3) và kiểm lại từng bước;
 *  - giới hạn dung lượng, thời gian, và chỉ nhận ảnh JPEG/PNG/WebP (kiểm bằng nội dung, không tin header).
 */

import dns from "node:dns";
import https from "node:https";
import net from "node:net";

import sharp, { type Metadata, type Sharp } from "sharp";

import { UserError } from "./fields.ts";

const MAX_DOWNLOAD = 10 * 1024 * 1024; // khớp giới hạn bucket person-photos
const MAX_BASE64_BYTES = 6 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const TARGET_BYTES = 80 * 1024;

/** Địa chỉ không được phép kết nối tới (loopback, riêng tư, link-local, CGNAT, multicast, metadata cloud…). */
export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === "::1" || l === "::") return true;
    if (l.startsWith("::ffff:")) return isBlockedIp(l.slice(7)); // IPv4-mapped
    return l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe8") || l.startsWith("fe9") || l.startsWith("fea") || l.startsWith("feb") || l.startsWith("ff");
  }
  return true;
}

const safeLookup: https.RequestOptions["lookup"] = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isBlockedIp(a.address));
    if (bad || list.length === 0) return callback(new Error("Địa chỉ không được phép."), "", 0);
    const first = list[0];
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, first.address, first.family);
  });
};

function fetchOnce(url: URL): Promise<{ status: number; location?: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { lookup: safeLookup, timeout: TIMEOUT_MS, headers: { "User-Agent": "dong-ho-viet-mcp/1", Accept: "image/jpeg,image/png,image/webp,*/*;q=0.1" } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, body: Buffer.alloc(0) });
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > MAX_DOWNLOAD) {
          res.destroy();
          return reject(new UserError("Ảnh quá lớn (tối đa 10 MB)."));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_DOWNLOAD) {
            res.destroy();
            reject(new UserError("Ảnh quá lớn (tối đa 10 MB)."));
          } else chunks.push(c);
        });
        res.on("end", () => resolve({ status, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new UserError("Tải ảnh quá lâu.")));
    req.on("error", (e) => reject(e instanceof UserError ? e : new UserError(`Không tải được ảnh: ${e.message}`)));
  });
}

async function downloadImage(rawUrl: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UserError("image_url không phải URL hợp lệ.");
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "https:") throw new UserError("image_url phải là https.");
    // IPv6 literal có dấu ngoặc ("[::1]") nên PHẢI bỏ ngoặc trước khi hỏi net.isIP; và với IP literal Node
    // không gọi `lookup`, nên đây là chỗ DUY NHẤT chặn được chúng.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(host) && isBlockedIp(host)) throw new UserError("Địa chỉ ảnh không được phép.");
    const r = await fetchOnce(url);
    if (r.status >= 300 && r.status < 400) {
      if (!r.location) throw new UserError("Chuyển hướng không hợp lệ.");
      url = new URL(r.location, url);
      continue;
    }
    if (r.status !== 200) throw new UserError(`Máy chủ ảnh trả về ${r.status}.`);
    return r.body;
  }
  throw new UserError("Quá nhiều lần chuyển hướng.");
}

/** Nén về chuẩn ảnh đại diện của app. Trả JPEG buffer. */
export async function toAvatarJpeg(input: Buffer): Promise<Buffer> {
  let img: Sharp;
  let meta: Metadata;
  try {
    img = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 });
    meta = await img.metadata();
  } catch {
    throw new UserError("Không đọc được ảnh (chỉ nhận JPEG, PNG, WebP).");
  }
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) {
    throw new UserError("Chỉ nhận ảnh JPEG, PNG hoặc WebP.");
  }
  let quality = 82;
  let out: Buffer = Buffer.alloc(0);
  for (; quality >= 50; quality -= 8) {
    out = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate() // theo EXIF
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }) // PNG trong suốt → nền trắng
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.length <= TARGET_BYTES) break;
  }
  return out;
}

export async function loadAvatar(args: { image_url?: unknown; image_base64?: unknown }): Promise<Buffer> {
  const hasUrl = typeof args.image_url === "string" && args.image_url.trim() !== "";
  const hasB64 = typeof args.image_base64 === "string" && args.image_base64.trim() !== "";
  if (hasUrl === hasB64) throw new UserError("Truyền đúng MỘT trong image_url hoặc image_base64.");
  let raw: Buffer;
  if (hasUrl) raw = await downloadImage((args.image_url as string).trim());
  else {
    const b64 = (args.image_base64 as string).replace(/^data:image\/[a-z+]+;base64,/i, "").replace(/\s+/g, "");
    if (b64.length > Math.ceil((MAX_BASE64_BYTES * 4) / 3) + 8) throw new UserError("Ảnh base64 quá lớn (tối đa 6 MB).");
    raw = Buffer.from(b64, "base64");
    if (raw.length === 0) throw new UserError("image_base64 rỗng hoặc sai.");
  }
  return toAvatarJpeg(raw);
}
