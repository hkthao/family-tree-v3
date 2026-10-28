import { useEffect, useState } from "react";

import { IconArrowRight, IconCheck } from "@/components/icons";
import type { ClanSummary } from "@/lib/queries/clans";
import {
  getClanCompletion,
  getClanTodoItems,
  getClanTodoSummary,
  setPersonTodoExcluded,
  TODO_CATEGORIES,
  type TodoCategory,
  type TodoItemRow,
} from "@/lib/queries/todo";

import { usePhotoUrls } from "../photos";
import { useRev } from "../rev";
import { toast } from "../toast";
import { useAsync } from "../useAsync";

/**
 * Việc cần làm — CÙNG CHỨC NĂNG với trang /todo của web: % hoàn thiện, bốn
 * nhóm chỗ thiếu kèm số đếm, danh sách người, bỏ qua từng người hoặc chọn
 * nhiều người để loại khỏi danh sách. Dùng nguyên các hàm trong
 * `@/lib/queries/todo` (máy chủ tính, chỉ thành viên gọi được).
 *
 * Khác về trình bày cho điện thoại: phân trang thành nút "Xem thêm"; bấm
 * một người thì mở thẳng màn phù hợp — thiếu cha/mẹ → Thêm cha/mẹ, còn lại
 * → Sửa hồ sơ (web mở hộp sửa nhanh). Người chỉ xem thì mở hồ sơ.
 */
const PAGE_SIZE = 15;

const CATEGORY_META: Record<TodoCategory, { label: string; description: string }> = {
  missing_parents: {
    label: "Thiếu cha/mẹ",
    description: "Người chưa có bố/mẹ trong cây — bổ sung để gắn vào đúng đời và nhánh.",
  },
  missing_dates: {
    label: "Thiếu năm sinh/mất",
    description: "Không có cả dương lẫn âm lịch năm sinh, hoặc đã mất mà chưa biết năm mất/giỗ.",
  },
  dead_end: {
    label: "Nhánh nghi sót",
    description: "Đã có vợ/chồng và đủ tuổi (30+) nhưng chưa ghi con — nhiều khả năng còn thiếu.",
  },
  missing_media: {
    label: "Thiếu ảnh / âm lịch",
    description: "Người chưa có ảnh, hoặc đã có ngày dương nhưng chưa quy đổi âm lịch.",
  },
};

const MISSING_LABEL: Record<string, string> = {
  parents: "thiếu cha/mẹ",
  birth_year: "thiếu năm sinh",
  death_year: "thiếu năm mất",
  dead_end: "chưa ghi con",
  photo: "thiếu ảnh",
  birth_lunar: "thiếu âm lịch ngày sinh",
  death_lunar: "thiếu âm lịch ngày mất",
};

export function TodoScreen({
  clan,
  canEdit,
  openPerson,
  editPerson,
  addParent,
}: {
  clan: ClanSummary;
  canEdit: boolean;
  openPerson: (id: string) => void;
  editPerson: (id: string) => void;
  addParent: (id: string) => void;
}) {
  const rev = useRev();
  // Tăng sau mỗi lần "bỏ qua" để tải lại số đếm và danh sách.
  const [bump, setBump] = useState(0);
  const [category, setCategory] = useState<TodoCategory>("missing_parents");
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const summary = useAsync(async () => {
    const [rows, completion] = await Promise.all([getClanTodoSummary(clan.id), getClanCompletion(clan.id)]);
    return { counts: new Map(rows.map((r) => [r.category, r.count])), completion };
  }, [clan.id, rev, bump]);

  const items = useAsync(
    () => getClanTodoItems(clan.id, category, PAGE_SIZE * pages, 0),
    [clan.id, category, pages, rev, bump],
  );
  const rows = items.data ?? [];
  const photo = usePhotoUrls(rows.map((r) => r.photo_path));

  // Lựa chọn chỉ có nghĩa trong nhóm đang xem (như web).
  useEffect(() => {
    setSelected(new Set());
    setConfirmBulk(false);
  }, [category]);

  const counts = summary.data?.counts;
  const total = counts?.get(category) ?? 0;
  const loadBearing =
    (counts?.get("missing_parents") ?? 0) + (counts?.get("missing_dates") ?? 0) + (counts?.get("dead_end") ?? 0);
  const completion = summary.data?.completion;

  const open = (row: TodoItemRow) => {
    if (!canEdit) openPerson(row.person_id);
    else if (category === "missing_parents") addParent(row.person_id);
    else editPerson(row.person_id);
  };

  const exclude = async (ids: string[]) => {
    setBusy(true);
    try {
      // Tuần tự như web: tránh dồn cả loạt yêu cầu cùng lúc.
      for (const id of ids) await setPersonTodoExcluded(id, true);
      toast(ids.length === 1 ? "Đã loại khỏi danh sách" : `Đã loại ${ids.length} người khỏi danh sách`);
      setSelected(new Set());
      setConfirmBulk(false);
      setBump((n) => n + 1);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="page">
      <p className="note" style={{ margin: "2px 4px 10px" }}>
        App tự dò chỗ thiếu trong gia phả — cả họ cùng bổ sung. Bấm vào một người để{" "}
        {canEdit ? "sửa thẳng" : "xem hồ sơ"}.
        {counts && <> Tổng <b>{loadBearing.toLocaleString("vi-VN")}</b> mục cần xử lý.</>}
      </p>

      {completion && completion.total > 0 && completion.percent !== null && (
        <section className="card pane">
          <div className="frow">
            <b>Họ ta đã hoàn thành</b>
            <span className="todo-pct">{completion.percent}%</span>
          </div>
          <div className="todo-bar" role="progressbar" aria-valuenow={completion.percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${completion.percent}%` }} />
          </div>
          <p className="note">
            <b>{completion.complete.toLocaleString("vi-VN")}</b> / {completion.total.toLocaleString("vi-VN")} người
            có đủ năm sinh và quan hệ cha/mẹ. Cùng nhau bổ sung để kéo lên 100%.
          </p>
        </section>
      )}
      {summary.error && <p className="error">{summary.error}</p>}

      <div className="todo-cats" role="tablist" aria-label="Nhóm việc cần làm">
        {TODO_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={cat === category}
            onClick={() => {
              setCategory(cat);
              setPages(1);
            }}
          >
            {CATEGORY_META[cat].label}
            <span className="n">{summary.loading && !counts ? "…" : (counts?.get(cat) ?? 0).toLocaleString("vi-VN")}</span>
          </button>
        ))}
      </div>
      <p className="note" style={{ margin: "0 4px 10px" }}>{CATEGORY_META[category].description}</p>

      {items.error && <p className="error">{items.error}</p>}
      {items.loading && !items.data && <div className="sk" style={{ height: 220 }} />}
      {items.data && rows.length === 0 && (
        <div className="card empty">
          <div className="icon"><IconCheck /></div>
          <p className="muted">Sạch sẽ ở nhóm này — không còn ai thiếu.</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="card group">
          {rows.map((row) => (
            <div key={row.person_id} className="grow todo-row">
              {canEdit && (
                <input
                  type="checkbox"
                  className="todo-check"
                  checked={selected.has(row.person_id)}
                  onChange={() => toggle(row.person_id)}
                  aria-label={`Chọn ${row.full_name}`}
                />
              )}
              <button type="button" className="todo-main" onClick={() => open(row)}>
                <img src={photo(row.photo_path, row.gender)} width={36} height={36} alt="" />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b className="ell">
                    {row.full_name}
                    {row.generation !== null && (
                      <span className="todo-gen">Đời {row.generation - (clan.generation_offset ?? 0)}</span>
                    )}
                  </b>
                  <span className="tiny" style={{ margin: 0 }}>
                    {[
                      row.birth_year && `Sinh ${row.birth_year}`,
                      row.death_year && `Mất ${row.death_year}`,
                      !row.is_living && !row.death_year && !row.birth_year && "Đã mất, chưa rõ năm",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {row.missing.map((m) => (
                      <span key={m} className="todo-miss"> • {MISSING_LABEL[m] ?? m}</span>
                    ))}
                  </span>
                </span>
                <span className="go"><IconArrowRight /></span>
              </button>
              {canEdit && (
                <button type="button" className="btn text todo-skip" disabled={busy} onClick={() => exclude([row.person_id])}>
                  Bỏ qua
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {rows.length < total && (
        <button type="button" className="btn ghost block" style={{ marginTop: 10 }} disabled={items.loading} onClick={() => setPages((p) => p + 1)}>
          {items.loading ? "Đang tải…" : `Xem thêm (còn ${(total - rows.length).toLocaleString("vi-VN")})`}
        </button>
      )}

      {canEdit && selected.size > 0 && (
        <div className="cta">
          {confirmBulk ? (
            <section className="card pane dangerpane" style={{ margin: 0 }}>
              <b style={{ display: "block", fontSize: 15 }}>Loại {selected.size} người khỏi danh sách?</b>
              <p className="note" style={{ marginTop: 4 }}>
                Họ sẽ không hiện trong Việc cần làm nữa và không tính vào % hoàn thành. Có thể đổi lại từng người
                ở màn Sửa hồ sơ.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="btn neutral" style={{ flex: 1 }} disabled={busy} onClick={() => setConfirmBulk(false)}>Huỷ</button>
                <button type="button" className="btn danger" style={{ flex: 1 }} disabled={busy} onClick={() => exclude([...selected])}>
                  {busy ? "Đang loại…" : "Loại"}
                </button>
              </div>
            </section>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn neutral" style={{ flex: 1 }} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
              <button type="button" className="btn danger2" style={{ flex: 2 }} onClick={() => setConfirmBulk(true)}>
                Loại {selected.size} người khỏi DS
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
