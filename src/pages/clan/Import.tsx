import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
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
  const qc = useQueryClient();

  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

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

  const importM = useMutation({
    mutationFn: () => {
      if (!plan?.payload) throw new Error("Không có payload để nhập.");
      return bulkImportPersons(clanId!, plan.payload);
    },
    onSuccess: async () => {
      await invalidateClanData(qc, clanId!);
    },
  });

  const errorCount = plan?.issues.filter((i) => i.severity === "error").length ?? 0;
  const warningCount = plan?.issues.filter((i) => i.severity === "warning").length ?? 0;
  const canSubmit = !!plan?.payload && errorCount === 0 && !importM.isPending && !importM.isSuccess;

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-6">
        <nav className="text-sm text-muted-foreground">
          <Link to={`/clans/${clanId}`} className="hover:underline">
            ← {clan.name}
          </Link>
        </nav>
        <h1 className="text-3xl font-semibold">Nhập từ Excel</h1>

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
                ↓ Tải file mẫu (.xlsx)
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
                <IssueList issues={plan.issues} />
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
                <Alert>
                  <AlertDescription>
                    Đã nhập {importM.data.imported_persons} người,{" "}
                    {importM.data.imported_families} gia đình,{" "}
                    {importM.data.imported_branches} chi.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <Button
                  size="lg"
                  disabled={!canSubmit}
                  onClick={() => importM.mutate()}
                >
                  {importM.isPending
                    ? "Đang nhập…"
                    : importM.isSuccess
                      ? "Đã nhập"
                      : "Nhập vào dòng họ"}
                </Button>
                {importM.isSuccess && (
                  <Button asChild variant="outline" size="lg">
                    <Link to={`/clans/${clanId}/people`}>Xem danh bạ</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function IssueList({ issues }: { issues: ImportIssue[] }) {
  return (
    <ul className="space-y-2">
      {issues.slice(0, 50).map((iss, i) => (
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
      {issues.length > 50 && (
        <li className="text-sm text-muted-foreground italic">
          (còn {issues.length - 50} vấn đề khác — sửa file rồi tải lại)
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
