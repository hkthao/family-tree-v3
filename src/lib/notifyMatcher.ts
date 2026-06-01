/**
 * Pure notification-matching logic for the `notify-events` cron.
 *
 * Given a snapshot of today's subscriptions + the upcoming events
 * already computed by `computeUpcomingEvents`/`computeUpcomingAnniversaries`,
 * produces the exact list of (subscription × event × lead-day) tuples
 * that should fire today. The Edge Function then dispatches emails
 * for each tuple and records to `notification_log`.
 *
 * The matcher is deliberately stateless — all inputs are passed in,
 * nothing is fetched here — so it can be unit-tested with
 * deterministic fixtures.
 */

import type { SubChannel, SubEventType } from "@/lib/queries/subscriptions";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

export interface SubscriptionLite {
  id: string;
  user_id: string;
  clan_id: string;
  scope: "clan" | "branch" | "person";
  target_id: string | null;
  event_types: SubEventType[];
  channels: SubChannel[];
  lead_days: number[];
  is_enabled: boolean;
}

export interface FireItem {
  subscriptionId: string;
  userId: string;
  clanId: string;
  channel: SubChannel;
  kind: UpcomingEvent["kind"];
  title: string;
  eventDate: string; // yyyy-mm-dd
  leadDays: number;
  /**
   * Stable key for idempotency. Same person + same anniversary + same
   * channel + same lead must collapse to the same row in
   * notification_log so a re-run never re-sends.
   */
  eventKey: string;
  personId?: string;
}

interface ComputeInput {
  /** Today's date as yyyy-mm-dd (server clock, Vietnam timezone). */
  today: string;
  subscriptions: SubscriptionLite[];
  /**
   * All upcoming events in the lookahead window (max of any
   * subscription's lead_days). Pre-computed by the caller using the
   * same `computeUpcomingEvents` helper the UI uses.
   */
  events: UpcomingEvent[];
  /**
   * Set of `${userId}:${eventKey}:${channel}` already in
   * notification_log. The matcher skips these for idempotency.
   */
  alreadySent: Set<string>;
}

const KIND_TO_EVENT_TYPE: Record<UpcomingEvent["kind"], SubEventType> = {
  birthday: "birthday",
  anniversary: "death_anniversary",
  custom: "custom",
};

function daysBetween(fromIso: string, toIso: string): number {
  const f = new Date(fromIso + "T00:00:00Z").getTime();
  const t = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((t - f) / 86_400_000);
}

function makeEventKey(
  kind: UpcomingEvent["kind"],
  sourceId: string,
  eventDate: string,
  leadDays: number,
): string {
  return `${kind}:${sourceId}:${eventDate}:lead${leadDays}`;
}

/**
 * Returns the list of (subscription × event × lead × channel) tuples
 * that should fire on `today`. The Edge Function will iterate over
 * this list and dispatch emails.
 */
export function computeFireList(input: ComputeInput): FireItem[] {
  const { today, subscriptions, events, alreadySent } = input;
  const out: FireItem[] = [];

  for (const sub of subscriptions) {
    if (!sub.is_enabled) continue;
    if (sub.channels.length === 0 || sub.lead_days.length === 0) continue;

    for (const evt of events) {
      // Scope filter
      if (sub.scope === "clan") {
        if (sub.target_id !== null) continue;
      } else if (sub.scope === "person") {
        if (sub.target_id !== evt.personId) continue;
      } else if (sub.scope === "branch") {
        // Match when the event's person is a member of the target chi.
        // Events without a known branch (no related person, person not
        // assigned to any chi) never fire for a branch-scope sub.
        if (!evt.branchId || sub.target_id !== evt.branchId) continue;
      }

      // Event-type filter
      const eventType = KIND_TO_EVENT_TYPE[evt.kind];
      if (!sub.event_types.includes(eventType)) continue;

      // Lead-day match
      const lead = daysBetween(today, evt.date);
      if (lead < 0) continue;
      if (!sub.lead_days.includes(lead)) continue;

      // Stable source id: personId for birthdays + anniversaries; key
      // suffix for custom events (the part after "custom:").
      const sourceId =
        evt.personId ??
        evt.key.split(":")[1] ??
        evt.key;
      const eventKey = makeEventKey(evt.kind, sourceId, evt.date, lead);

      for (const channel of sub.channels) {
        const dedup = `${sub.user_id}:${eventKey}:${channel}`;
        if (alreadySent.has(dedup)) continue;
        out.push({
          subscriptionId: sub.id,
          userId: sub.user_id,
          clanId: sub.clan_id,
          channel,
          kind: evt.kind,
          title: evt.title,
          eventDate: evt.date,
          leadDays: lead,
          eventKey,
          personId: evt.personId,
        });
        alreadySent.add(dedup); // also skip duplicates within this run
      }
    }
  }

  return out;
}
