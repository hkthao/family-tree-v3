/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TimelinePoster, type PosterMilestone } from "@/components/timeline/TimelinePoster";
import { buildMilestones, type TimelineRow } from "@/lib/timeline/mergeTimeline";
import { TIMELINE_ICON_KEYS } from "@/components/timeline/TimelineIcon";
import { getPosterThemes } from "@/lib/timeline/themes";

const row = (o: Partial<TimelineRow>): TimelineRow => ({
  id: "r",
  clan_id: "c",
  person_id: null,
  on_clan: true,
  era: null,
  year: 1950,
  sort_order: 0,
  title: "Mốc",
  body: null,
  icon_key: null,
  photo_person_id: null,
  image_url: null,
  context_title: null,
  context_body: null,
  source_key: null,
  ...o,
});

const items = (rows: TimelineRow[]): PosterMilestone[] =>
  buildMilestones(rows, TIMELINE_ICON_KEYS).map((c) => ({ c }));

const SAMPLE = items([
  row({ id: "a", year: 1945, title: "Độc lập", body: "Ngày 2/9", era: "Ất Dậu" }),
  row({ id: "b", year: 1975, title: "Thống nhất", icon_key: "banner" }),
  row({ id: "c", year: 1990, title: "Con đầu lòng", image_url: "lib:con-dau-long" }),
]);

describe("TimelinePoster — dựng được ở mọi kiểu", () => {
  it.each(["horizontal", "vertical"] as const)("kiểu %s: có tiêu đề, năm trong con triện, tiêu đề mốc và thẻ bối cảnh", (layout) => {
    render(<TimelinePoster clanName="Họ Hồ" items={SAMPLE} layout={layout} />);
    // "Họ" đầu tên bị bỏ để không thành "Dòng họ Họ Hồ"
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Dòng họ Hồ");
    for (const y of ["1945", "1975", "1990"]) expect(screen.getByText(y)).toBeInTheDocument();
    expect(screen.getByText("Ất Dậu")).toBeInTheDocument(); // can chi trong con triện
    expect(screen.getByText("Thống nhất")).toBeInTheDocument();
    // bối cảnh mặc định theo năm: 1975 → thời kỳ "Đất nước chia hai miền"
    expect(screen.getAllByText(/Đất nước chia hai miền/).length).toBeGreaterThan(0);
  });

  it("bấm mốc gọi onSelect với đúng mốc (chỉ khi truyền onSelect)", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<TimelinePoster clanName="X" items={SAMPLE} layout="vertical" onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText(/Thống nhất/));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ year: 1975, title: "Thống nhất" });
    rerender(<TimelinePoster clanName="X" items={SAMPLE} layout="vertical" />);
    expect(screen.queryByLabelText(/Thống nhất/)).toBeNull(); // không có onSelect → không bấm được
  });

  it("tiêu đề / câu chốt tuỳ biến (dòng thời gian của một người)", () => {
    render(<TimelinePoster clanName="X" items={SAMPLE} title="Hồ Anh Quang" subtitle="Dòng đời" quote="Một đời người" layout="vertical" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Hồ Anh Quang");
    expect(screen.getByText("Dòng đời")).toBeInTheDocument();
    expect(screen.getByText("Một đời người")).toBeInTheDocument();
  });

  it("chế độ nhúng (bare): không tiêu đề, không câu chốt", () => {
    render(<TimelinePoster clanName="X" items={SAMPLE} bare layout="vertical" />);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.queryByText(/Mỗi thế hệ một hành trình/)).toBeNull();
  });

  it("mốc ẩn thẻ bối cảnh (context rỗng) vẫn dựng được, không vỡ", () => {
    const hidden = items([row({ id: "h1", year: 1960, title: "Chỉ có chữ", context_title: "", context_body: "" })]);
    render(<TimelinePoster clanName="X" items={hidden} layout="vertical" />);
    expect(screen.getByText("Chỉ có chữ")).toBeInTheDocument();
    expect(screen.queryByText(/Đất nước chia hai miền/)).toBeNull();
  });

  it("danh sách rỗng không làm hỏng poster", () => {
    render(<TimelinePoster clanName="X" items={[]} layout="horizontal" />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });

  it("mọi mẫu nền đều dựng được", () => {
    for (const th of getPosterThemes()) {
      const { unmount } = render(<TimelinePoster clanName="X" items={SAMPLE} themeId={th.id} layout="vertical" />);
      expect(screen.getByText("Thống nhất")).toBeInTheDocument();
      unmount();
    }
  });
});
