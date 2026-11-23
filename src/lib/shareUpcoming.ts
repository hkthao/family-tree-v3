import type { EventRow, EventType } from "@/lib/queries/events";
import type { ShareViewPayload } from "@/lib/queries/share-view";
import type { PersonForTree } from "@/lib/queries/tree";
import {
  computeClanUpcoming,
  type PersonAnniversary,
  type UpcomingEvent,
} from "@/lib/upcomingEvents";

/**
 * Đưa payload của trang chia sẻ công khai về đúng đầu vào của `computeClanUpcoming` — để tab
 * "Sự kiện & giỗ" ở Share và màn Sự kiện trong app dùng CHUNG một logic tính + một component vẽ.
 * Payload thiếu trường nào thì điền giá trị trung tính; thêm loại sự kiện mới KHÔNG cần sửa file này
 * miễn là nó đi qua `computeClanUpcoming`.
 */
export function shareUpcoming(
  data: ShareViewPayload,
  daysAhead = 365,
  today = new Date(),
): UpcomingEvent[] {
  const persons = data.persons.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    is_living: p.is_living,
    birth_date: p.birth_date,
    birth_date_precision: p.birth_date_precision,
    branch_id: p.branch_id,
    generation: p.generation,
  })) as unknown as PersonForTree[];

  const events: EventRow[] = (data.events ?? []).map((e) => ({
    id: e.id,
    clan_id: "",
    title: e.title,
    event_type: e.event_type as EventType,
    date_solar: e.date_solar,
    lunar_year: null,
    lunar_month: e.lunar_month,
    lunar_day: e.lunar_day,
    lunar_is_leap: !!e.lunar_is_leap,
    is_yearly: e.is_yearly,
    related_person_id: e.related_person_id,
    resting_place_id: null,
    notes: e.notes,
    created_at: "",
    updated_at: "",
  }));

  const anniversaries: PersonAnniversary[] = data.persons
    .filter((p) => !p.is_living)
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      death_anniv_lunar_month: p.death_anniv_lunar_month ?? null,
      death_anniv_lunar_day: p.death_anniv_lunar_day ?? null,
      death_anniv_lunar_is_leap: false,
      generation: p.generation,
      branch_id: p.branch_id,
    }));

  return computeClanUpcoming({ today, daysAhead, persons, events, anniversaries });
}
