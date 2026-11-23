import { UpcomingEventRow } from "@/components/UpcomingEventRow";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

/**
 * Danh sách sự kiện sắp tới — MỘT chỗ vẽ duy nhất cho màn Sự kiện của dòng họ và tab "Sự kiện & giỗ"
 * của trang chia sẻ công khai. Muốn đổi kiểu hiển thị / thêm thông tin vào dòng sự kiện thì sửa
 * `UpcomingEventRow`; muốn thêm nguồn sự kiện mới thì sửa `computeClanUpcoming`. Không sửa ở màn nào khác.
 */
export function UpcomingEventList({
  events,
  clanId,
  view = "list",
  readOnly,
  onOpenEvent,
  onCreateCard,
}: {
  events: UpcomingEvent[];
  clanId: string;
  view?: "list" | "grid";
  /** Trang chia sẻ công khai: chỉ xem, không link / nút thao tác. */
  readOnly?: boolean;
  onOpenEvent?: (eventId: string) => void;
  onCreateCard?: (ev: UpcomingEvent) => void;
}) {
  return (
    <ul
      className={
        view === "grid" ? "grid grid-cols-2 lg:grid-cols-3 gap-2" : "space-y-2"
      }
    >
      {events.map((e) => (
        <li key={e.key}>
          <UpcomingEventRow
            event={e}
            clanId={clanId}
            variant={view === "grid" ? "card" : "row"}
            readOnly={readOnly}
            onOpenEvent={onOpenEvent}
            onCreateCard={onCreateCard}
          />
        </li>
      ))}
    </ul>
  );
}
