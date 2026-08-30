import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useToast } from "@/components/Toast";
import {
  IconBuildings,
  IconDownload,
  IconFlame,
  IconLink,
  IconPlay,
  IconTrash,
  IconX,
} from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  giaPhaImportFinalize,
  giaPhaImportStart,
  giaPhaImportStep,
  listAllClans,
  wipeClanDirectory,
} from "@/lib/queries/admin";
import { queryKeys } from "@/lib/queries/keys";

export function GiaPhaImportTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const clansQ = useQuery({ queryKey: queryKeys.adminClans(), queryFn: () => listAllClans() });
  const clans = clansQ.data ?? [];

  // import section
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [sourceUrl, setSourceUrl] = useState("");
  const [newClanName, setNewClanName] = useState("");
  const [targetClanId, setTargetClanId] = useState("");
  const [replace, setReplace] = useState(false);

  // staged-job state: drive start → step×N → finalize, with progress.
  const LS_KEY = "giapha-import-job";
  const [running, setRunning] = useState(false);
  const [prog, setProg] = useState<{ scraped: number; total: number; phase: string } | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof giaPhaImportFinalize>> | null>(null);
  const [resultClanName, setResultClanName] = useState<string | undefined>(undefined);
  const [resumeJob, setResumeJob] = useState<{ jobId: string; total: number; clanName?: string } | null>(null);
  const cancelRef = useRef(false);

  // On mount, surface an unfinished job (e.g. tab was closed) so it can resume.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setResumeJob(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Loop steps until 'ready', then finalize. `jobId` already exists.
  async function runJob(jobId: string, total: number, clanName?: string) {
    setRunning(true);
    cancelRef.current = false;
    try {
      let status = "scraping";
      let scraped = prog?.scraped ?? 0;
      while (status === "scraping") {
        if (cancelRef.current) {
          toast.info("Đã tạm dừng — có thể tiếp tục sau.");
          setRunning(false);
          return;
        }
        const r = await giaPhaImportStep(jobId);
        status = r.status;
        scraped = r.scraped;
        setProg({ scraped, total: r.total, phase: "Đang tải dữ liệu" });
      }
      setProg({ scraped, total, phase: "Đang ghi vào dòng họ" });
      const res = await giaPhaImportFinalize(jobId);
      setResult(res);
      setResultClanName(clanName);
      localStorage.removeItem(LS_KEY);
      setResumeJob(null);
      setProg(null);
      qc.invalidateQueries({ queryKey: queryKeys.adminClans() });
      toast.success("Đã nhập gia phả", {
        description: `${res.counts.persons} người · ${res.counts.families} gia đình`,
      });
    } catch (e) {
      toast.error("Nhập thất bại", { description: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  async function startImport() {
    setResult(null);
    setRunning(true);
    cancelRef.current = false;
    try {
      const job = await giaPhaImportStart({
        sourceUrl: sourceUrl.trim(),
        clanId: mode === "existing" ? targetClanId : undefined,
        clanName: mode === "new" ? newClanName.trim() || undefined : undefined,
        replace: mode === "existing" ? replace : undefined,
      });
      const ls = { jobId: job.jobId, total: job.total, clanName: job.clanName };
      localStorage.setItem(LS_KEY, JSON.stringify(ls));
      setProg({ scraped: 0, total: job.total, phase: "Đang tải dữ liệu" });
      await runJob(job.jobId, job.total, job.clanName);
    } catch (e) {
      toast.error("Không bắt đầu được", { description: (e as Error).message });
      setRunning(false);
    }
  }

  function dismissResume() {
    localStorage.removeItem(LS_KEY);
    setResumeJob(null);
  }

  // wipe section
  const [wipeClanId, setWipeClanId] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const wipeClan = clans.find((c) => c.id === wipeClanId);
  const canWipe = !!wipeClan && confirmText.trim() === wipeClan.name;
  const wipeM = useMutation({
    mutationFn: () => wipeClanDirectory(wipeClanId),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: queryKeys.adminClans() });
      toast.success("Đã xoá toàn bộ danh bạ", {
        description: `${r.deleted_persons} người · ${r.deleted_families} gia đình`,
      });
      setConfirmText("");
    },
    onError: (e) => toast.error("Xoá thất bại", { description: (e as Error).message }),
  });

  return (
    <section className="space-y-4">
      {/* ── Import ── */}
      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-lg font-semibold">Nhập từ vietnamgiapha.com</h2>
        <p className="text-sm text-muted-foreground">
          Dán link gia phả (vd <code>https://vietnamgiapha.com/XemGiaPha/1691/giapha.html</code>)
          rồi bấm Tạo. Hệ thống tự tải, bóc tách và tạo danh bạ. Quá trình
          có thể mất 30–60 giây.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {(["new", "existing"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 h-9 rounded-md border text-sm ${mode === m ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/40"}`}
            >
              {m === "new" ? "Tạo dòng họ mới" : "Nhập vào dòng họ có sẵn"}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="src-url">Link gia phả</Label>
          <Input
            id="src-url"
            icon={<IconLink />}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://vietnamgiapha.com/XemGiaPha/…"
          />
        </div>

        {mode === "new" ? (
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Tên dòng họ (bỏ trống = tự lấy từ nguồn)</Label>
            <Input
              id="new-name"
              icon={<IconBuildings />}
              value={newClanName}
              onChange={(e) => setNewClanName(e.target.value)}
              placeholder="vd: Chi họ Cao Minh Triết"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="target-clan">Dòng họ đích</Label>
              <Select
                id="target-clan"
                icon={<IconBuildings />}
                value={targetClanId}
                onChange={(e) => setTargetClanId(e.target.value)}
              >
                <option value="">— Chọn dòng họ —</option>
                {clans.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.person_count} người)
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                Xoá toàn bộ danh bạ hiện tại của dòng họ này <strong>trước khi</strong> nhập
                (tránh trùng lặp khi nhập lại).
              </span>
            </label>
          </div>
        )}

        {resumeJob && !running && (
          <Alert>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span>
                Có lần nhập đang dở{resumeJob.clanName ? ` (${resumeJob.clanName})` : ""} —
                {resumeJob.total} người. Tiếp tục?
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runJob(resumeJob.jobId, resumeJob.total, resumeJob.clanName)}
              >
                <IconPlay className="h-4 w-4 mr-1.5" />
                Tiếp tục nhập
              </Button>
              <Button size="sm" variant="ghost" onClick={dismissResume}>
                Bỏ qua
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!running ? (
          <Button
            variant="outline"
            disabled={!sourceUrl.trim() || (mode === "existing" && !targetClanId)}
            onClick={startImport}
          >
            <IconDownload className="h-4 w-4 mr-1.5" />
            Tạo
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {prog?.phase ?? "Đang xử lý"}
                {prog ? ` — ${prog.scraped}/${prog.total} người` : "…"}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                <IconX className="h-4 w-4 mr-1.5" />
                Tạm dừng
              </Button>
            </div>
            {prog && prog.total > 0 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round((prog.scraped / prog.total) * 100)}%` }}
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Gia phả lớn có thể mất vài phút. Có thể tạm dừng rồi tiếp tục sau —
              tiến độ được lưu trên máy chủ.
            </p>
          </div>
        )}

        {result && (
          <Alert>
            <AlertDescription>
              ✓ Đã nhập <strong>{result.counts.persons}</strong> người ·{" "}
              <strong>{result.counts.families}</strong> gia đình vào{" "}
              <Link to={`/clans/${result.clanId}`} className="text-primary underline">
                {resultClanName ?? "dòng họ"}
              </Link>
              .
              {(result.warnings.ambiguousMothers > 0 || result.warnings.missingGender > 0) && (
                <span className="block mt-1 text-muted-foreground">
                  Cần rà lại: {result.warnings.ambiguousMothers} con mẹ chưa chắc
                  (mặc định vợ cả)
                  {result.warnings.missingGender > 0 && `, ${result.warnings.missingGender} thiếu giới tính`}
                  . {result.warnings.note}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* ── Danger: wipe directory ── */}
      <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <h2 className="text-lg font-semibold text-destructive">
          Xoá toàn bộ danh bạ (nguy hiểm)
        </h2>
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Hành động không thể hoàn tác.</strong> Xoá vĩnh viễn{" "}
            <strong>tất cả người và quan hệ gia đình</strong> trong dòng họ đã
            chọn — KHÔNG khôi phục được từ nhật ký. Dòng họ, thành viên và cài
            đặt vẫn giữ nguyên. Chỉ dùng khi muốn nhập lại từ đầu.
          </AlertDescription>
        </Alert>

        <div className="space-y-1.5">
          <Label htmlFor="wipe-clan">Dòng họ cần xoá danh bạ</Label>
          <Select
            id="wipe-clan"
            icon={<IconBuildings />}
            value={wipeClanId}
            onChange={(e) => {
              setWipeClanId(e.target.value);
              setConfirmText("");
            }}
          >
            <option value="">— Chọn dòng họ —</option>
            {clans.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.person_count} người)
              </option>
            ))}
          </Select>
        </div>

        {wipeClan && (
          <div className="space-y-1.5">
            <Label htmlFor="wipe-confirm">
              Gõ đúng tên dòng họ <strong>“{wipeClan.name}”</strong> để xác nhận
              xoá {wipeClan.person_count} người:
            </Label>
            <Input
              id="wipe-confirm"
              icon={<IconFlame />}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={wipeClan.name}
              autoComplete="off"
            />
          </div>
        )}

        <Button
          variant="destructive"
          disabled={!canWipe || wipeM.isPending}
          onClick={() => wipeM.mutate()}
        >
          <IconTrash className="h-4 w-4 mr-1.5" />
          {wipeM.isPending ? "Đang xoá…" : "Xoá toàn bộ danh bạ"}
        </Button>
      </div>
    </section>
  );
}
