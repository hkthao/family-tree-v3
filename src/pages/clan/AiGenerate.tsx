import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { useToast } from "@/components/Toast";
import { IconCheck, IconCopy, IconList } from "@/components/icons";
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

const EXAMPLE_NARRATIVE = `Họ Nguyễn ở Hà Nam. Thuỷ tổ là cụ Nguyễn Văn An, sinh 1900, mất 1970, vợ là cụ Trần Thị Bình (1905-1980). Hai cụ sinh được 3 người con:
- Nguyễn Văn Cường, sinh 1930, làm nông, lấy bà Lê Thị Dung (sinh 1932). Anh Cường có 2 con: Nguyễn Văn Dũng (1960) và Nguyễn Thị Em (1962).
- Nguyễn Thị Hoa, sinh 1932, lấy chồng họ Trần.
- Nguyễn Văn Lực, sinh 1935, mất sớm năm 1955.`;

export default function AiGenerate() {
  const { clanId } = useParams<{ clanId: string }>();
  const { clan } = useClanContext();
  const toast = useToast();

  const [format, setFormat] = useState<PromptFormat>("csv");
  const [narrative, setNarrative] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="space-y-6">
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

      <Button size="lg" onClick={generate} disabled={!narrative.trim()}>
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
              <AlertDescription className="space-y-1.5 text-sm">
                <p className="font-medium">Sau khi AI trả về:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Copy toàn bộ nội dung AI trả về (từ dòng đầu tới dòng cuối).</li>
                  <li>
                    Tạo file mới <code>.{format}</code> trên máy (vd notepad / TextEdit) → paste vào → save.
                  </li>
                  <li>
                    {format === "csv" ? (
                      <>Mở <Link to={`/clans/${clanId}/import`} className="underline">Nhập từ Excel</Link> → chọn file <code>.csv</code> → review → nhập.</>
                    ) : (
                      <>Mở <Link to={`/clans/${clanId}/settings`} className="underline">Cài đặt → GEDCOM</Link> → bấm "Nhập GEDCOM" → chọn file.</>
                    )}
                  </li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="flex gap-3 flex-wrap">
              <Button asChild variant="outline" size="sm">
                <Link to={`/clans/${clanId}/import`}>
                  <IconList className="h-4 w-4 mr-1.5" />
                  Mở trang Nhập từ Excel
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
