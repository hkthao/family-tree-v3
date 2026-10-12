import { useEffect, useRef } from "react";

import "family-chart/styles/family-chart.css";

import { toFamilyChart } from "@/lib/familyChartAdapter";
import type { TreeData } from "@/lib/queries/tree";

import femaleAvatar from "../../../public/avatars/female.png";
import maleAvatar from "../../../public/avatars/male.png";

/**
 * Cây 2D — cùng thư viện (family-chart) và cùng bộ chuyển dữ liệu
 * (`toFamilyChart`) với bản web, nên hình cây ra giống nhau. Chỉ lược các
 * phần web làm cho việc SỬA (nút thêm nhanh trên thẻ, kéo thả…): Mini App
 * bản đầu chỉ xem.
 *
 * Khung cây chiếm trọn phần màn hình còn lại và nhận thẳng cử chỉ kéo /
 * chụm ngón, nên không cần lớp "chạm để di chuyển" như web (ở web trang
 * còn phải cuộn dọc, ở đây thì không).
 */
interface F3Card {
  setCardDisplay: (lines: ((d: { data?: Record<string, unknown> }) => string)[]) => F3Card;
  setCardDim: (dim: Record<string, number>) => F3Card;
}
interface F3Chart {
  setSingleParentEmptyCard: (v: boolean) => F3Chart;
  setCardSvg: () => F3Card;
  setTransitionTime: (ms: number) => F3Chart;
  setOrientationVertical?: () => F3Chart;
  setCardXSpacing: (n: number) => F3Chart;
  setCardYSpacing: (n: number) => F3Chart;
  setProgenyDepth?: (n: number) => F3Chart;
  setAncestryDepth?: (n: number) => F3Chart;
  updateMainId?: (id: string) => F3Chart;
  updateTree: (o: { initial: boolean }) => F3Chart;
}

export function Tree2D({
  data,
  focalId,
  depth,
  onFocus,
}: {
  data: TreeData;
  focalId: string | null;
  /** Số đời hiển thị quanh người trung tâm; 0 = tất cả. */
  depth: number;
  /** Người dùng chạm một thẻ → thẻ đó thành trung tâm. */
  onFocus: (personId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<F3Chart | null>(null);
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  // Dựng lại biểu đồ khi dữ liệu hoặc số đời đổi.
  useEffect(() => {
    const node = ref.current;
    if (!node || data.persons.length === 0) return;
    let disposed = false;

    (async () => {
      const f3 = await import("family-chart");
      if (disposed) return;
      node.innerHTML = "";
      const chart = (
        f3 as unknown as { createChart: (el: HTMLElement, d: unknown) => F3Chart }
      ).createChart(
        node,
        // Bộ chuyển của web trỏ ảnh mặc định tới "/avatars/…" — đường dẫn
        // chỉ có trên trang web. Mini App đóng gói ảnh riêng nên đổi sang
        // địa chỉ đã đóng gói, không thì mọi thẻ hiện ô ảnh vỡ.
        toFamilyChart(data.persons, data.families).map((d) =>
          d.data.avatar?.startsWith("/avatars/")
            ? { ...d, data: { ...d.data, avatar: d.data.gender === "M" ? maleAvatar : femaleAvatar } }
            : d,
        ),
      );

      // Gia phả Việt thường không ghi vợ — tắt ô "?" giữ chỗ (như web).
      chart.setSingleParentEmptyCard(false);
      chart
        .setCardSvg()
        .setCardDisplay([
          (d) => String(d.data?.["full name"] ?? ""),
          (d) => {
            const f = d.data ?? {};
            const living = f["is_living"] !== false;
            const b = (f["birthday"] as string) || "?";
            const death = (f["death_year"] as string) || (living ? "" : "?");
            return death ? `${b} - ${death}` : b;
          },
        ])
        .setCardDim({ w: 220, h: 70, text_x: 75, text_y: 15, img_w: 60, img_h: 60, img_x: 5, img_y: 5 });
      chart.setTransitionTime(200);
      chart.setOrientationVertical?.();
      chart.setCardXSpacing(250).setCardYSpacing(150);
      const d = depth === 0 ? 999 : depth - 1;
      chart.setProgenyDepth?.(d);
      chart.setAncestryDepth?.(d);
      if (focalId) chart.updateMainId?.(focalId);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (disposed) return;
      chart.updateTree({ initial: true });
      chartRef.current = chart;
    })().catch((e) => console.error("family-chart init failed:", e));

    return () => {
      disposed = true;
      chartRef.current = null;
      node.innerHTML = "";
    };
    // focalId cố ý KHÔNG nằm trong deps: đổi tâm xử lý ở effect dưới, không
    // phải dựng lại cả biểu đồ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, depth]);

  // Đổi người trung tâm (từ ô tìm) mà không dựng lại.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !focalId) return;
    chart.updateMainId?.(focalId);
    chart.updateTree({ initial: false });
  }, [focalId]);

  // Thư viện tự đổi tâm khi chạm thẻ; ta chỉ nghe xem thẻ nào vừa được
  // chạm (d3 gắn dữ liệu vào `__data__` của phần tử) để báo ra ngoài.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onClick = (e: Event) => {
      const g = (e.target as Element | null)?.closest?.("g.card_cont, .card_cont");
      const id = (g as unknown as { __data__?: { data?: { id?: string } } } | null)
        ?.__data__?.data?.id;
      if (id) onFocusRef.current(id);
    };
    node.addEventListener("click", onClick);
    return () => node.removeEventListener("click", onClick);
  }, []);

  return (
    <div
      ref={ref}
      className="f3 canvas"
      // Đặt biến màu NGAY trên khung (như web): tệp CSS của thư viện cũng
      // khai các biến này và nạp sau, khai ở CSS ngoài sẽ bị nó đè.
      style={
        {
          "--male-color": "var(--tree-male)",
          "--female-color": "var(--tree-female)",
          "--genderless-color": "var(--tree-neutral)",
          "--background-color": "var(--surface)",
          "--text-color": "var(--tree-text)",
        } as React.CSSProperties
      }
    />
  );
}
