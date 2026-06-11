import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queries/keys";
import { getClanCompletion } from "@/lib/queries/todo";

import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageHeader";
import {
  IconCheck,
  IconDownload,
  IconList,
  IconUpload,
} from "@/components/icons";
import { downloadIssuesCsv } from "@/lib/csv/exportImportIssues";
import { useToast } from "@/components/Toast";
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
import { invalidateClanData } from "@/lib/cache";
import { downloadTemplate, parseSpreadsheet } from "@/lib/excel";
import {
  planImport,
  type ImportIssue,
  type ImportPlan,
  type NormalisedRow,
} from "@/lib/importPersons";
import { bulkImportPersons } from "@/lib/queries/import";

export default function Import() {
  const { clanId } = useParams<{ clanId: string }>();
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();

  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  // Captured at the moment of mutation so we can show "+12%" in the
  // success card. Null when completion wasn't in cache yet (first
  // visit before query loads).
  const [prePercent, setPrePercent] = useState<number | null>(null);

  const canEdit = canEditClan(clan);
  if (!canEdit) return <Navigate to={`/clans/${clanId}`} replace />;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setParseError(null);
    setPlan(null);
    setParsing(true);
    try {
      const rows = await parseSpreadsheet(f);
      const p = planImport(rows);
      setPlan(p);
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setParsing(false);
    }
  }

  const { data: completion } = useQuery({
    queryKey: queryKeys.clanCompletion(clanId!, userId),
    queryFn: () => getClanCompletion(clanId!),
    enabled: !!userId && !!clanId,
    staleTime: 60_000,
  });

  const importM = useMutation({
    mutationFn: () => {
      if (!plan?.payload) throw new Error("Không có payload để nhập.");
      return bulkImportPersons(clanId!, plan.payload);
    },
    onMutate: () => {
      setPrePercent(completion?.percent ?? null);
    },
    onSuccess: async (res) => {
      await invalidateClanData(qc, clanId!);
      toast.success("Đã nhập từ Excel", {
        description: `${res.imported_persons} người, ${res.imported_families} gia đình`,
      });
    },
    onError: (e) =>
      toast.error("Không nhập được", { description: (e as Error).message }),
  });

  const errorCount = plan?.issues.filter((i) => i.severity === "error").length ?? 0;
  const warningCount = plan?.issues.filter((i) => i.severity === "warning").length ?? 0;
  const canSubmit = !!plan?.payload && errorCount === 0 && !importM.isPending && !importM.isSuccess;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: "Nhập từ Excel" },
        ]}
      />
      <PageHeader
        icon={<IconUpload className="h-7 w-7" />}
        title="Nhập từ Excel"
        description="Import gia phả lớn từ file .xlsx hoặc .csv."
        actions={
          <Button asChild variant="outline" size="sm" className="h-10">
            <Link to={`/clans/${clanId}/ai-generate`}>
              Sinh file bằng AI →
            </Link>
          </Button>
        }
      />

        <Card>
          <CardHeader>
            <CardTitle>1. Chọn file</CardTitle>
            <CardDescription>
              Định dạng .xlsx hoặc .csv. Các cột cần có:
              <code className="block mt-2 p-2 bg-muted rounded text-sm overflow-x-auto">
                ID | Họ tên | Giới tính | Năm sinh | Năm mất | ID Cha | ID Mẹ | Chi | Ghi chú
              </code>
              Cột <code>ID</code> là mã tạm bạn đặt (vd P001, P002…) — cha/mẹ
              được nối theo ID này, không phải theo tên.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => downloadTemplate()}
              >
                <IconDownload className="h-4 w-4 mr-1.5" />
                Tải file mẫu (.xlsx)
              </Button>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={onPickFile}
              disabled={importM.isPending}
              className="block w-full text-base file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-4 file:py-2 file:font-medium file:cursor-pointer"
            />
            {fileName && (
              <p className="mt-2 text-sm text-muted-foreground">{fileName}</p>
            )}
            {parsing && (
              <p className="mt-2 text-sm text-muted-foreground">Đang phân tích file…</p>
            )}
            {parseError && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {plan && (
          <Card>
            <CardHeader>
              <CardTitle>2. Kiểm tra dữ liệu</CardTitle>
              <CardDescription>
                {plan.rows.length} dòng • {errorCount} lỗi • {warningCount} cảnh báo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {plan.issues.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Không có lỗi hay cảnh báo. Bạn có thể nhập ngay.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => downloadIssuesCsv(fileName, plan.issues)}
                      title="Tải toàn bộ lỗi và cảnh báo về CSV để mở trong Excel cùng file gốc và sửa hàng loạt"
                    >
                      <IconDownload className="h-4 w-4 mr-1.5" />
                      Tải file lỗi ({plan.issues.length})
                    </Button>
                  </div>
                  <IssueList issues={plan.issues} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {plan?.payload && (
          <Card>
            <CardHeader>
              <CardTitle>3. Xem trước (10 dòng đầu)</CardTitle>
              <CardDescription>
                Tổng: {plan.payload.persons.length} người •{" "}
                {plan.payload.families.length} gia đình •{" "}
                {plan.payload.branches.length} chi sẽ được tạo mới.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PreviewTable rows={plan.rows.slice(0, 10)} />
            </CardContent>
          </Card>
        )}

        {plan?.payload && (
          <Card>
            <CardHeader>
              <CardTitle>4. Nhập vào dòng họ</CardTitle>
              <CardDescription>
                Mọi dòng được nhập trong một giao dịch — nếu lỗi, không có ai bị thêm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {importM.error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {(importM.error as Error).message}
                  </AlertDescription>
                </Alert>
              )}
              {importM.isSuccess && importM.data && (
                <ImportSuccessCard
                  result={importM.data}
                  completion={completion}
                  prePercent={prePercent}
                />
              )}
              <div className="flex gap-3">
                <Button
                  className="flex-1 sm:flex-none"
                  disabled={!canSubmit}
                  onClick={() => importM.mutate()}
                >
                  {importM.isPending ? (
                    "Đang nhập…"
                  ) : importM.isSuccess ? (
                    <>
                      <IconCheck className="h-4 w-4 mr-1.5" />
                      Đã nhập
                    </>
                  ) : (
                    <>
                      <IconUpload className="h-4 w-4 mr-1.5" />
                      Nhập vào dòng họ
                    </>
                  )}
                </Button>
                {importM.isSuccess && (
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1 sm:flex-none"
                  >
                    <Link to={`/clans/${clanId}/people`}>
                      <IconList className="h-4 w-4 mr-1.5" />
                      Xem danh bạ
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const ISSUE_PREVIEW_CAP = 200;

function IssueList({ issues }: { issues: ImportIssue[] }) {
  return (
    <ul className="space-y-2">
      {issues.slice(0, ISSUE_PREVIEW_CAP).map((iss, i) => (
        <li
          key={i}
          className={`p-2 rounded border-l-4 text-sm ${
            iss.severity === "error"
              ? "border-destructive bg-destructive/5"
              : "border-accent bg-accent/5"
          }`}
        >
          <span className="font-medium">
            {iss.severity === "error" ? "Lỗi" : "Cảnh báo"}
            {iss.rowIndex > 0 ? ` (dòng ${iss.rowIndex})` : ""}:
          </span>{" "}
          {iss.message}
        </li>
      ))}
      {issues.length > ISSUE_PREVIEW_CAP && (
        <li className="text-sm text-muted-foreground italic">
          (còn {issues.length - ISSUE_PREVIEW_CAP} vấn đề khác — bấm{" "}
          <strong>Tải file lỗi</strong> ở trên để xem hết)
        </li>
      )}
    </ul>
  );
}

function PreviewTable({ rows }: { rows: NormalisedRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="px-2 py-2">ID</th>
            <th className="px-2 py-2">Họ tên</th>
            <th className="px-2 py-2">GT</th>
            <th className="px-2 py-2">Sinh</th>
            <th className="px-2 py-2">Mất</th>
            <th className="px-2 py-2">Cha</th>
            <th className="px-2 py-2">Mẹ</th>
            <th className="px-2 py-2">Chi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rowIndex} className="border-b last:border-0">
              <td className="px-2 py-1.5 font-mono">{r.tempId}</td>
              <td className="px-2 py-1.5">{r.fullName}</td>
              <td className="px-2 py-1.5">{r.gender ?? "—"}</td>
              <td className="px-2 py-1.5">{r.birthYear ?? "—"}</td>
              <td className="px-2 py-1.5">{r.deathYear ?? "—"}</td>
              <td className="px-2 py-1.5 font-mono">{r.fatherTempId ?? "—"}</td>
              <td className="px-2 py-1.5 font-mono">{r.motherTempId ?? "—"}</td>
              <td className="px-2 py-1.5">{r.branch ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ImportSuccessCard({
  result,
  completion,
  prePercent,
}: {
  result: {
    imported_persons: number;
    imported_families: number;
    imported_branches: number;
  };
  completion: import("@/lib/queries/todo").ClanCompletion | undefined;
  prePercent: number | null;
}) {
  const post = completion?.percent ?? null;
  const delta = prePercent !== null && post !== null ? post - prePercent : null;
  const tone =
    post === null
      ? "bg-primary"
      : post >= 90
        ? "bg-emerald-500"
        : post >= 50
          ? "bg-primary"
          : "bg-amber-500";
  return (
    <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/30 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <IconCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-sm">
          Đã nhập <strong>{result.imported_persons}</strong> người,{" "}
          {result.imported_families} gia đình, {result.imported_branches} chi.
        </p>
      </div>
      {post !== null && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              Họ ta giờ đã hoàn thành
            </span>
            <span className="text-xl font-semibold tabular-nums">
              {post}%
              {delta !== null && delta > 0 && (
                <span className="ml-1.5 text-sm font-medium text-emerald-600">
                  +{delta}%
                </span>
              )}
            </span>
          </div>
          <div
            className="h-2 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={post}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full ${tone} transition-[width] duration-700`}
              style={{ width: `${post}%` }}
            />
          </div>
          {delta !== null && delta < 0 && (
            // Imports with gaps drag the percentage down. Reframe it
            // as the next step instead of a regret.
            <p className="text-xs text-muted-foreground">
              Hồ sơ mới có chỗ chưa đầy đủ — bấm <em>Việc cần làm</em>{" "}
              để bổ sung dần.
            </p>
          )}
        </>
      )}
    </div>
  );
}
