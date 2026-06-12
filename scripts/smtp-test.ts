/**
 * Quick SMTP diagnostic — only verifies the connection + auth,
 * then sends one minimal email. Run with:
 *   SMTP_PASSWORD='...' TEST_TO=thao.hk90@gmail.com npx tsx scripts/smtp-test.ts
 */
import { createTransport } from "nodemailer";
import { config } from "dotenv";

config({ path: ".env.deploy" });

const HOST = process.env.SMTP_HOST ?? "smtp.hostinger.com";
const PORT = Number(process.env.SMTP_PORT ?? 465);
const USER = process.env.SMTP_USER ?? "noreply@thaohk.com";
const PASS = process.env.SMTP_PASSWORD ?? "";
const TO = process.env.TEST_TO ?? "";

if (!PASS) {
  console.error("Missing SMTP_PASSWORD");
  process.exit(1);
}
if (!TO) {
  console.error("Missing TEST_TO");
  process.exit(1);
}

const t = createTransport({
  host: HOST,
  port: PORT,
  secure: PORT === 465,
  auth: { user: USER, pass: PASS },
  logger: true,
  debug: true,
});

console.log(`Verifying ${HOST}:${PORT} as ${USER}...`);
await t.verify();
console.log("✓ verified — sending test...");

const info = await t.sendMail({
  from: `"Gia phả test" <${USER}>`,
  to: TO,
  subject: "SMTP diagnostic test from giapha.thaohk.com",
  text: "If you can read this, Hostinger SMTP is working. Reply if received.",
  html: '<p>If you can read this, Hostinger SMTP is working. Reply if received.</p>',
});

console.log(`✓ sent: ${info.messageId}`);
console.log(`  accepted: ${JSON.stringify(info.accepted)}`);
console.log(`  rejected: ${JSON.stringify(info.rejected)}`);
console.log(`  response: ${info.response}`);
