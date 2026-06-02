/**
 * Builds the prompt template a user copies into ChatGPT / Gemini /
 * Claude. The AI then returns a file the user can save and feed to
 * /clans/:id/import (CSV via "Nhập từ Excel") or paste into the
 * GEDCOM import flow.
 *
 * Two formats, both produce a single complete file as the AI's
 * full response — instructions are explicit about "no markdown
 * fences, no commentary" so the user can copy-paste verbatim.
 */

export type PromptFormat = "csv" | "gedcom";

export interface PromptInput {
  format: PromptFormat;
  narrative: string;
  clanName?: string;
}

export function buildAiPrompt(input: PromptInput): string {
  if (input.format === "csv") return buildCsvPrompt(input);
  return buildGedcomPrompt(input);
}

function buildCsvPrompt({ narrative, clanName }: PromptInput): string {
  return `Bạn là trợ lý nhập liệu phả hệ. Đọc đoạn mô tả gia đình của tôi bên dưới và xuất ra file CSV chuẩn 9 cột để nhập vào hệ thống phả hệ.

Định dạng output BẮT BUỘC:
- Header dòng 1: \`ID,Họ tên,Giới tính,Năm sinh,Năm mất,ID Cha,ID Mẹ,Chi,Ghi chú\`
- Mỗi người 1 dòng tiếp theo
- UTF-8, comma-separated, RFC 4180 quoting cho ô chứa dấu phẩy hoặc xuống dòng
- KHÔNG bao bằng markdown fences \`\`\`
- KHÔNG giải thích thêm, KHÔNG ghi tiêu đề hay lời mở đầu — chỉ xuất CSV thuần

Quy tắc từng cột:
- **ID**: bạn tự đặt mã tạm P001, P002, P003… (3 chữ số). Cha/mẹ tham chiếu qua ID này, KHÔNG dùng tên.
- **Họ tên**: họ + tên đệm + tên, viết hoa đúng quy tắc tiếng Việt.
- **Giới tính**: viết "M" cho nam, "F" cho nữ.
- **Năm sinh / Năm mất**: 4 chữ số (vd 1950) hoặc để trống nếu không rõ.
- **ID Cha / ID Mẹ**: tham chiếu ID người trong cùng file. Để trống nếu cha/mẹ không có trong dữ liệu.
- **Chi**: tên nhánh/chi họ (vd "Chi cả", "Chi hai") hoặc để trống.
- **Ghi chú**: nghề nghiệp, biệt danh, nơi sinh, thông tin tự do.

Ví dụ output đúng định dạng:
ID,Họ tên,Giới tính,Năm sinh,Năm mất,ID Cha,ID Mẹ,Chi,Ghi chú
P001,Nguyễn Văn An,M,1900,1970,,,Chi cả,Thuỷ tổ - làm nông
P002,Trần Thị Bình,F,1905,1980,,,Chi cả,Vợ của An
P003,Nguyễn Văn Cường,M,1930,,P001,P002,Chi cả,Lập trình viên
P004,"Lê Thị Dung, biệt danh Bé",F,1932,,,,,"Vợ của Cường, sinh tại Hà Nội"

---

Mô tả gia đình tôi${clanName ? ` (${clanName})` : ""}:

${narrative.trim()}

---

Bây giờ hãy xuất CSV ngay, không kèm thêm bất cứ gì khác.`;
}

function buildGedcomPrompt({ narrative, clanName }: PromptInput): string {
  return `Bạn là trợ lý nhập liệu phả hệ. Đọc đoạn mô tả gia đình của tôi bên dưới và xuất ra file GEDCOM 5.5.1 hợp lệ để nhập vào hệ thống phả hệ.

Định dạng output BẮT BUỘC:
- Bắt đầu bằng \`0 HEAD\` … kết thúc bằng \`0 TRLR\`
- Encoding UTF-8 (\`1 CHAR UTF-8\` trong HEAD)
- Mỗi người: \`0 @I<n>@ INDI\` với các tag NAME / SEX / BIRT / DEAT / FAMC / FAMS
- Mỗi gia đình: \`0 @F<n>@ FAM\` với HUSB / WIFE / CHIL
- Tên Việt: dùng quy ước slash \`1 NAME <tên đệm> <tên> /<HỌ>/\` (vd \`1 NAME Văn An /Nguyễn/\`)
- Ngày tháng: \`2 DATE YYYY\` hoặc \`2 DATE DD MMM YYYY\` (tháng tiếng Anh viết tắt JAN/FEB/MAR/…)
- SEX: M hoặc F
- KHÔNG bao bằng markdown fences \`\`\`
- KHÔNG giải thích thêm — chỉ xuất nội dung GEDCOM thuần từ dòng \`0 HEAD\` đến \`0 TRLR\`

Ví dụ output đúng định dạng:
0 HEAD
1 SOUR Family Tree v3
1 GEDC
2 VERS 5.5.1
2 FORM LINEAGE-LINKED
1 CHAR UTF-8
0 @I1@ INDI
1 NAME Văn An /Nguyễn/
1 SEX M
1 BIRT
2 DATE 1900
1 DEAT
2 DATE 1970
1 FAMS @F1@
0 @I2@ INDI
1 NAME Thị Bình /Trần/
1 SEX F
1 BIRT
2 DATE 1905
1 FAMS @F1@
0 @I3@ INDI
1 NAME Văn Cường /Nguyễn/
1 SEX M
1 BIRT
2 DATE 1930
1 FAMC @F1@
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 TRLR

---

Mô tả gia đình tôi${clanName ? ` (${clanName})` : ""}:

${narrative.trim()}

---

Bây giờ hãy xuất GEDCOM ngay, không kèm thêm bất cứ gì khác.`;
}
