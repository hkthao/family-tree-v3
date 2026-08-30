/**
 * Mã hoá tiêu đề email theo RFC 2047 — tự làm, không tin thư viện.
 *
 * Vì sao: denomailer nhét cả tiêu đề tiếng Việt vào MỘT "encoded-word"
 * quoted-printable duy nhất. RFC 2047 giới hạn mỗi encoded-word **75 ký
 * tự**, tiêu đề dài hơn thì phải cắt thành nhiều encoded-word nối bằng
 * xuống dòng + khoảng trắng. Vượt giới hạn là Gmail bỏ cuộc và in ra
 * nguyên chuỗi thô:
 *
 *   =?utf-8?Q?[D=c3=b2ng H=e1=bb=8d Vi=e1=bb=87t] C=c3=b2n 7 ng=c3=a0y…
 *
 * Người nhận thấy đúng cái đó trong hộp thư — trông như thư rác.
 *
 * Cách sửa: tự mã hoá sẵn thành chuỗi THUẦN ASCII rồi mới đưa cho thư
 * viện. Nó thấy toàn ASCII nên để nguyên, không mã hoá lại lần nữa.
 *
 * Dùng Base64 chứ không quoted-printable: độ dài đoán được nên cắt khúc
 * an toàn dễ hơn nhiều.
 */

/**
 * Số BYTE tối đa mỗi khúc.
 *
 * 75 = tổng giới hạn một encoded-word. Trừ `=?UTF-8?B?` (10) và `?=` (2)
 * còn 63 cho phần base64. Base64 dài 4·⌈n/3⌉ nên n ≤ 45 byte là chắc
 * chắn không vượt (4·15 = 60).
 */
const MAX_BYTES = 45;

const isAscii = (s: string) => !/[^\x20-\x7E]/.test(s);

function base64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Cắt chuỗi thành các khúc ≤ MAX_BYTES byte, **không bao giờ cắt giữa
 * một ký tự**.
 *
 * Cắt giữa chừng một ký tự UTF-8 là hỏng theo kiểu tệ nhất: vẫn gửi
 * được, vẫn hiện được, chỉ có một chữ biến thành ô vuông — và chỉ người
 * nhận thấy.
 */
export function chunkByBytes(text: string, maxBytes = MAX_BYTES): string[] {
  const enc = new TextEncoder();
  const chunks: string[] = [];
  let cur = "";
  let curBytes = 0;

  // Duyệt theo ĐIỂM MÃ (spread), không theo chỉ số — tiếng Việt có dấu
  // nằm ngoài BMP thì chỉ số sẽ cắt đôi cặp surrogate.
  for (const ch of text) {
    const n = enc.encode(ch).length;
    if (curBytes + n > maxBytes && cur) {
      chunks.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += n;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/**
 * Tiêu đề đã mã hoá, sẵn sàng đưa vào header `Subject:`.
 *
 * Tiêu đề toàn ASCII thì trả nguyên — không có lý do gì mã hoá, và giữ
 * nguyên thì đọc log dễ hơn.
 */
export function encodeSubject(subject: string): string {
  const s = subject.replace(/[\r\n]+/g, " ").trim();
  if (isAscii(s)) return s;

  const enc = new TextEncoder();
  return chunkByBytes(s)
    .map((part) => `=?UTF-8?B?${base64(enc.encode(part))}?=`)
    // Nối bằng CRLF + khoảng trắng: đó là cách RFC 2047 nói "vẫn là một
    // tiêu đề, chỉ xuống dòng cho vừa".
    .join("\r\n ");
}
