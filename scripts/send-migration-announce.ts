/**
 * Send migration-announcement emails via Hostinger SMTP
 * (noreply@thaohk.com → 4 newly-imported clan admins).
 *
 * Dry-run by default — prints subject + to + a short preview to
 * stdout without contacting SMTP. Set SEND=true to actually send.
 *
 * Required env (.env.deploy or shell):
 *   SMTP_HOST       — default smtp.hostinger.com
 *   SMTP_PORT       — default 465
 *   SMTP_USER       — default noreply@thaohk.com
 *   SMTP_PASSWORD   — REQUIRED only when SEND=true
 *   SMTP_FROM_NAME  — default "Gia phả"
 *   SEND=true       — flip to actually send
 *   ONLY_TO=email   — optional: only send to this address
 *                     (template still rendered for all assignments)
 *   TEST_TO=email   — optional: override the `to:` of the FIRST recipient
 *                     (content still rendered with that recipient's data
 *                     so you preview a realistic email). Sends exactly 1.
 */
import { readFileSync } from "node:fs";
import { createTransport } from "nodemailer";
import { config } from "dotenv";

config({ path: ".env.deploy" });

const RECIPIENTS_FILE =
  process.env.RECIPIENTS_FILE ?? "scripts/.migration-recipients.json";

const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.hostinger.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_USER = process.env.SMTP_USER ?? "noreply@thaohk.com";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD ?? "";
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME ?? "Gia phả";
const SEND = process.env.SEND === "true";
const ONLY_TO = process.env.ONLY_TO?.trim() || null;
const TEST_TO = process.env.TEST_TO?.trim() || null;

const SUBJECT =
  "Gia phả đã chuyển sang hệ thống mới — tài khoản của bạn đã sẵn sàng";

interface Recipient {
  email: string;
  clanName: string;
  clanUrl: string;
  password: string;
  memberCount: number;
}

function loadRecipients(): Recipient[] {
  const raw = readFileSync(RECIPIENTS_FILE, "utf8");
  return JSON.parse(raw) as Recipient[];
}

const RECIPIENTS: Recipient[] = loadRecipients();

function render(template: string, r: Recipient): string {
  return template
    .replaceAll("{{CLAN_NAME}}", r.clanName)
    .replaceAll("{{CLAN_URL}}", r.clanUrl)
    .replaceAll("{{EMAIL}}", r.email)
    .replaceAll("{{PASSWORD}}", r.password)
    .replaceAll("{{MEMBER_COUNT}}", String(r.memberCount));
}

function plainText(r: Recipient): string {
  return [
    `Kính gửi quản trị dòng họ "${r.clanName}",`,
    "",
    "Hệ thống Gia phả đã chuyển sang nền tảng mới tại https://giapha.thaohk.com với giao diện gọn nhẹ hơn và nhiều tính năng mới.",
    "",
    `Toàn bộ dữ liệu dòng họ (${r.memberCount} thành viên) đã được chuyển sang. Tài khoản quản trị của quý vị đã sẵn sàng:`,
    "",
    `  Email:        ${r.email}`,
    `  Mật khẩu tạm: ${r.password}`,
    "",
    "Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên (Tài khoản → Đổi mật khẩu).",
    "",
    `Đăng nhập: ${r.clanUrl}`,
    "",
    "Tính năng mới đáng chú ý:",
    "  • Cây gia phả tương tác nhiều đời",
    "  • Ngày giỗ & sinh nhật âm lịch — tự nhắc trước 7/3/1 ngày",
    "  • Thông gia & chi nhánh",
    "  • Bài đăng dòng họ, mời người thân, quyền riêng tư linh hoạt",
    "",
    "Việc nên làm ngay sau khi đăng nhập:",
    "  1. Đổi mật khẩu tạm",
    "  2. Kiểm tra cây gia phả, bổ sung ảnh / ngày tháng còn thiếu",
    "  3. Thiết lập ngày giỗ âm lịch cho tổ tiên",
    "  4. Mời thêm con cháu tham gia",
    "",
    "Nếu gặp khó khăn khi đăng nhập hoặc phát hiện dữ liệu chưa chính xác, vui lòng phản hồi email này.",
    "",
    "—",
    "Gia phả — nền tảng lưu giữ phả hệ dòng họ Việt",
    "Hệ thống cũ tại family.thaohk.com sẽ ngừng cập nhật và chỉ giữ ở chế độ tham khảo.",
  ].join("\n");
}

async function main(): Promise<void> {
  const tpl = readFileSync("scripts/migration-announce.html", "utf8");

  const transporter = SEND
    ? createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      })
    : null;

  if (SEND && !SMTP_PASSWORD) {
    console.error("SEND=true but SMTP_PASSWORD is empty. Aborting.");
    process.exit(1);
  }

  if (SEND) {
    await transporter!.verify();
    console.log(`✓ SMTP verified ${SMTP_HOST}:${SMTP_PORT} as ${SMTP_USER}\n`);
  } else {
    console.log("DRY-RUN (no email sent). Set SEND=true to actually deliver.\n");
  }

  let filtered: Recipient[];
  let overrideTo: string | null = null;
  if (TEST_TO) {
    filtered = [RECIPIENTS[0]];
    overrideTo = TEST_TO;
    console.log(
      `TEST mode — sending 1 email to ${TEST_TO}, content rendered for "${filtered[0].clanName}".\n`,
    );
  } else if (ONLY_TO) {
    filtered = RECIPIENTS.filter(
      (r) => r.email.toLowerCase() === ONLY_TO.toLowerCase(),
    );
    if (filtered.length === 0) {
      console.error(`ONLY_TO=${ONLY_TO} did not match any recipient. Aborting.`);
      process.exit(1);
    }
  } else {
    filtered = RECIPIENTS;
  }

  for (const r of filtered) {
    const html = render(tpl, r);
    const text = plainText(r);
    const to = overrideTo ?? r.email;

    console.log(`── ${to}${overrideTo ? `  (test, real admin: ${r.email})` : ""} ──`);
    console.log(`  Subject : ${SUBJECT}`);
    console.log(`  Clan    : ${r.clanName} (${r.memberCount} members)`);
    console.log(`  Login   : ${r.email} / ${r.password}`);
    console.log(`  URL     : ${r.clanUrl}`);
    console.log(`  HTML    : ${html.length} bytes  Plain: ${text.length} bytes`);

    if (SEND) {
      const info = await transporter!.sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
        to,
        subject: SUBJECT,
        text,
        html,
      });
      console.log(`  ✓ sent  : ${info.messageId}`);
    }
    console.log();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
