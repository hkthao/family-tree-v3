import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { useToast } from "@/components/Toast";
import {
  IconCheck,
  IconCopy,
  IconList,
  IconUpload,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import { buildAiPrompt, type PromptFormat } from "@/lib/aiPrompt";
import { invalidateClanData } from "@/lib/cache";
import { parseCsvText } from "@/lib/excel";
import { parseGedcom } from "@/lib/gedcom/parse";
import { importGedcomIntoClan } from "@/lib/gedcom/import";
import {
  planImport,
  type ImportPlan,
} from "@/lib/importPersons";
import { bulkImportPersons } from "@/lib/queries/import";

const EXAMPLE_NARRATIVE = `Họ Nguyễn ở Hà Nam. Thuỷ tổ là cụ Nguyễn Văn An, sinh 1900, mất 1970, vợ là cụ Trần Thị Bình (1905-1980). Hai cụ sinh được 3 người con:
- Nguyễn Văn Cường, sinh 1930, làm nông, lấy bà Lê Thị Dung (sinh 1932). Anh Cường có 2 con: Nguyễn Văn Dũng (1960) và Nguyễn Thị Em (1962).
- Nguyễn Thị Hoa, sinh 1932, lấy chồng họ Trần.
- Nguyễn Văn Lực, sinh 1935, mất sớm năm 1955.`;

export default function AiGenerate() {
  const { clanId } = useParams<{ clanId: string }>();
  const { clan } = useClanContext();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [format, setFormat] = useState<PromptFormat>("csv");
  const [narrative, setNarrative] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // AI-response paste-back state: textarea content + parsed plan (CSV
  // path) + GEDCOM parse + error. Lets the user round-trip through AI
  // entirely inside one page — no save-to-file step, which is the
  // sticking point on mobile.
  const [aiResponse, setAiResponse] = useState("");
  const [csvPlan, setCsvPlan] = useState<ImportPlan | null>(null);
  const [gedcomText, setGedcomText] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const canEdit = canEditClan(clan);
  if (!canEdit) return <Navigate to={`/clans/${clanId}`} replace />;

  function generate() {
    if (!narrative.trim()) {
      toast.error("Cần mô tả gia đình trước", {
        description: "Gõ vào ô bên trên ai có quan hệ gì, sinh năm nào…",
      });
      return;
    }
    setPrompt(buildAiPrompt({ format, narrative, clanName: clan.name }));
    setCopied(false);
  }

  async function copyToClipboard() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Đã chép prompt", {
        description: "Mở ChatGPT / Gemini / Claude và paste vào.",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      toast.error("Không chép được", { description: (e as Error).message });
    }
  }

  function parseAiResponse() {
    setParseError(null);
    setCsvPlan(null);
    setGedcomText(null);
    const text = aiResponse.trim();
    if (!text) {
      setParseError("Dán nội dung AI trả về vào ô bên trên trước.");
      return;
    }
    try {
      if (format === "csv") {
        const rows = parseCsvText(text);
        if (rows.length === 0) {
          setParseError(
            "Không đọc được dòng nào. Kiểm tra lại có đúng định dạng CSV không.",
          );
          return;
        }
        setCsvPlan(planImport(rows));
      } else {
        // Strip markdown fence if present so the parser sees pure GEDCOM.
        const fence = text.match(/^```(?:gedcom|ged|txt)?\s*\n([\s\S]*?)\n?```\s*$/i);
        const cleaned = fence ? fence[1] : text;
        // Quick sanity check — every GEDCOM starts with "0 HEAD" line.
        if (!/^0\s+HEAD/m.test(cleaned)) {
          setParseError(
            'Nội dung không giống GEDCOM (phải bắt đầu bằng "0 HEAD"). Có thể AI trả về CSV — đổi định dạng ở mục 1.',
          );
          return;
        }
        // Validate by parsing — discard result, we re-parse during import.
        parseGedcom(cleaned);
        setGedcomText(cleaned);
      }
    } catch (e) {
      setParseError((e as Error).message);
    }
  }

  const importM = useMutation({
    mutationFn: async () => {
      if (!clanId) throw new Error("Thiếu clan id");
      if (format === "csv") {
        if (!csvPlan?.payload) throw new Error("Chưa có payload để nhập.");
        return bulkImportPersons(clanId, csvPlan.payload);
      }
      if (!gedcomText) throw new Error("Chưa có GEDCOM để nhập.");
      const parsed = parseGedcom(gedcomText);
      const res = await importGedcomIntoClan(clanId, parsed);
      return {
        imported_persons: res.personsCreated,
        imported_families: res.familiesCreated,
        imported_branches: res.branchesCreated,
      };
    },
    onSuccess: async (res) => {
      await invalidateClanData(qc, clanId!);
      toast.success(`Đã tạo ${res.imported_persons} người`, {
        description: `${res.imported_families} gia đình, ${res.imported_branches} chi.`,
      });
      navigate(`/clans/${clanId}/people`);
    },
    onError: (e) =>
      toast.error("Không tạo được", { description: (e as Error).message }),
  });

  const csvErrorCount =
    csvPlan?.issues.filter((i) => i.severity === "error").length ?? 0;
  const csvWarningCount =
    csvPlan?.issues.filter((i) => i.severity === "warning").length ?? 0;
  const canImport =
    format === "csv"
      ? !!csvPlan?.payload && csvErrorCount === 0
      : !!gedcomText;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: "Nhập từ Excel", to: `/clans/${clanId}/import` },
          { label: "Sinh dữ liệu bằng AI" },
        ]}
      />
      <div>
        <h2 className="text-2xl font-semibold">Sinh dữ liệu bằng AI</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Mô tả gia đình bằng lời, ta sinh prompt mẫu — paste vào ChatGPT
          / Gemini / Claude, AI trả về file CSV hoặc GEDCOM, sau đó nhập
          file qua trang <Link to={`/clans/${clanId}/import`} className="underline">Nhập từ Excel</Link>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Định dạng đầu ra</CardTitle>
          <CardDescription>
            CSV nhập qua "Nhập từ Excel" (cùng 9 cột với mẫu). GEDCOM
            nhập qua "Nhập GEDCOM" trong Cài đặt — giữ thêm chi, ngày
            âm lịch, tên tự / húy nếu AI điền.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
                className="h-4 w-4 accent-primary"
              />
              <span>CSV (9 cột — đơn giản, đủ dùng)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={format === "gedcom"}
                onChange={() => setFormat("gedcom")}
                className="h-4 w-4 accent-primary"
              />
              <span>GEDCOM 5.5.1 (chuẩn phả hệ, giữ nhiều trường hơn)</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Mô tả gia đình</CardTitle>
          <CardDescription>
            Viết tự do — ai là thuỷ tổ, sinh năm nào, vợ/chồng là ai,
            có bao nhiêu con và tên gì. AI sẽ tự đánh số ID + kết nối
            quan hệ cha/mẹ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder={EXAMPLE_NARRATIVE}
            rows={10}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          {!narrative && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNarrative(EXAMPLE_NARRATIVE)}
            >
              Dùng ví dụ mẫu
            </Button>
          )}
        </CardContent>
      </Card>

      <Button onClick={generate} disabled={!narrative.trim()}>
        Sinh prompt
      </Button>

      {prompt && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>3. Copy prompt + paste vào AI</CardTitle>
                <CardDescription>
                  Mở ChatGPT (chat.openai.com), Gemini (gemini.google.com)
                  hoặc Claude (claude.ai), paste prompt → AI trả về nội
                  dung file → save thành <code>.{format}</code> → nhập vào hệ thống.
                </CardDescription>
              </div>
              <Button onClick={copyToClipboard} size="sm">
                {copied ? (
                  <>
                    <IconCheck className="h-4 w-4 mr-1.5" />
                    Đã chép
                  </>
                ) : (
                  <>
                    <IconCopy className="h-4 w-4 mr-1.5" />
                    Chép prompt
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={prompt}
              readOnly
              rows={14}
              className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm font-mono outline-none resize-y"
              onFocus={(e) => e.currentTarget.select()}
            />

            <Alert>
              <AlertDescription className="text-sm">
                Copy toàn bộ nội dung AI trả về rồi dán vào ô ở mục 4
                bên dưới — không cần tạo file. (Hoặc lưu thành file{" "}
                <code>.{format}</code> rồi nhập qua{" "}
                {format === "csv" ? (
                  <Link
                    to={`/clans/${clanId}/import`}
                    className="underline"
                  >
                    Nhập từ Excel
                  </Link>
                ) : (
                  <Link
                    to={`/clans/${clanId}/settings`}
                    className="underline"
                  >
                    Cài đặt → GEDCOM
                  </Link>
                )}{" "}
                nếu bạn muốn.)
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {prompt && (
        <Card>
          <CardHeader>
            <CardTitle>4. Dán kết quả AI vào đây</CardTitle>
            <CardDescription>
              Copy toàn bộ phản hồi của ChatGPT/Gemini/Claude và dán
              thẳng vào ô này — bao gồm cả markdown ``` cũng được, app
              tự bỏ. Không cần lưu thành file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={aiResponse}
              onChange={(e) => {
                setAiResponse(e.target.value);
                // Invalidate previous parse so the user re-validates
                // after editing.
                if (csvPlan || gedcomText || parseError) {
                  setCsvPlan(null);
                  setGedcomText(null);
                  setParseError(null);
                }
              }}
              placeholder={
                format === "csv"
                  ? "Dán nội dung CSV ở đây — ID,Họ tên,Giới tính,…"
                  : "Dán nội dung GEDCOM ở đây — bắt đầu bằng 0 HEAD…"
              }
              rows={10}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring resize-y"
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={parseAiResponse}
                disabled={!aiResponse.trim() || importM.isPending}
              >
                Phân tích & xem trước
              </Button>
              {(csvPlan || gedcomText) && (
                <Button
                  type="button"
                  onClick={() => importM.mutate()}
                  disabled={!canImport || importM.isPending}
                >
                  <IconUpload className="h-4 w-4 mr-1.5" />
                  {importM.isPending
                    ? "Đang tạo…"
                    : format === "csv"
                      ? `Tạo ${csvPlan?.payload?.persons.length ?? 0} người`
                      : "Tạo thành viên từ GEDCOM"}
                </Button>
              )}
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {format === "csv" && csvPlan && (
              <Alert variant={csvErrorCount > 0 ? "destructive" : "default"}>
                <AlertDescription>
                  {csvPlan.rows.length} dòng • {csvErrorCount} lỗi •{" "}
                  {csvWarningCount} cảnh báo
                  {csvPlan.payload && (
                    <>
                      {" "}
                      → sẽ tạo {csvPlan.payload.persons.length} người,{" "}
                      {csvPlan.payload.families.length} gia đình,{" "}
                      {csvPlan.payload.branches.length} chi.
                    </>
                  )}
                  {csvErrorCount > 0 && (
                    <>
                      {" "}
                      <Link
                        to={`/clans/${clanId}/import`}
                        className="underline"
                      >
                        Sửa qua trang Nhập từ Excel
                      </Link>{" "}
                      để xem chi tiết lỗi.
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {format === "gedcom" && gedcomText && (
              <Alert>
                <AlertDescription>
                  GEDCOM hợp lệ. Bấm "Tạo thành viên từ GEDCOM" để nhập.
                </AlertDescription>
              </Alert>
            )}

            {importM.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(importM.error as Error).message}
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground">
              Hoặc nếu muốn nhập theo cách truyền thống, lưu file rồi
              mở{" "}
              <Link
                to={`/clans/${clanId}/import`}
                className="underline inline-flex items-center gap-1"
              >
                <IconList className="h-3.5 w-3.5" />
                Nhập từ Excel
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
