import { describe, expect, it } from "vitest";

import {
  computeFireList,
  type SubscriptionLite,
} from "@/lib/notifyMatcher";
import type { UpcomingEvent } from "@/lib/upcomingEvents";

const baseClanSub: SubscriptionLite = {
  id: "s1",
  user_id: "u1",
  clan_id: "c1",
  scope: "clan",
  target_id: null,
  event_types: ["birthday", "death_anniversary"],
  channels: ["email"],
  lead_days: [7, 1],
  is_enabled: true,
};

const birthday = (over: Partial<UpcomingEvent>): UpcomingEvent => ({
  key: "birthday:p1:2024-06-15",
  kind: "birthday",
  title: "Sinh nhật Nguyễn Văn A",
  date: "2024-06-15",
  daysUntil: 7,
  personId: "p1",
  ...over,
});

describe("computeFireList", () => {
  it("fires when an event matches an enabled subscription's lead_day", () => {
    const fires = computeFireList({
      today: "2024-06-08",
      subscriptions: [baseClanSub],
      events: [birthday({})],
      alreadySent: new Set(),
    });
    expect(fires).toHaveLength(1);
    expect(fires[0].channel).toBe("email");
    expect(fires[0].leadDays).toBe(7);
    expect(fires[0].eventKey).toMatch(/^birthday:p1:2024-06-15:lead7$/);
  });

  it("skips events outside the configured lead_days", () => {
    const fires = computeFireList({
      today: "2024-06-13", // 2 days before — not in [7, 1]
      subscriptions: [baseClanSub],
      events: [birthday({})],
      alreadySent: new Set(),
    });
    expect(fires).toHaveLength(0);
  });

  it("skips disabled subscriptions", () => {
    const fires = computeFireList({
      today: "2024-06-08",
      subscriptions: [{ ...baseClanSub, is_enabled: false }],
      events: [birthday({})],
      alreadySent: new Set(),
    });
    expect(fires).toHaveLength(0);
  });

  it("skips events whose type isn't in the subscription", () => {
    const fires = computeFireList({
      today: "2024-06-08",
      subscriptions: [{ ...baseClanSub, event_types: ["death_anniversary"] }],
      events: [birthday({})],
      alreadySent: new Set(),
    });
    expect(fires).toHaveLength(0);
  });

  it("respects the idempotency set (notification_log already)", () => {
    const fires = computeFireList({
      today: "2024-06-08",
      subscriptions: [baseClanSub],
      events: [birthday({})],
      alreadySent: new Set(["u1:birthday:p1:2024-06-15:lead7:email"]),
    });
    expect(fires).toHaveLength(0);
  });

  it("branch-scope sub only fires when the event's person belongs to the target chi", () => {
    const branchSub: SubscriptionLite = {
      ...baseClanSub,
      scope: "branch",
      target_id: "bA",
    };
    // Same person, no branch on the event → no fire.
    const fires0 = computeFireList({
      today: "2024-06-08",
      subscriptions: [branchSub],
      events: [birthday({ branchId: null })],
      alreadySent: new Set(),
    });
    expect(fires0).toHaveLength(0);

    // Event belongs to a different chi → no fire.
    const fires1 = computeFireList({
      today: "2024-06-08",
      subscriptions: [branchSub],
      events: [birthday({ branchId: "bB" })],
      alreadySent: new Set(),
    });
    expect(fires1).toHaveLength(0);

    // Event belongs to the target chi → fire.
    const fires2 = computeFireList({
      today: "2024-06-08",
      subscriptions: [branchSub],
      events: [birthday({ branchId: "bA" })],
      alreadySent: new Set(),
    });
    expect(fires2).toHaveLength(1);
    expect(fires2[0].personId).toBe("p1");
  });

  it("branch-scope sub coexists with a clan-scope sub without double-firing", () => {
    const fires = computeFireList({
      today: "2024-06-08",
      subscriptions: [
        baseClanSub,
        { ...baseClanSub, id: "s-branch", scope: "branch", target_id: "bA" },
      ],
      events: [birthday({ branchId: "bA" })],
      alreadySent: new Set(),
    });
    // Same user × eventKey × channel → matcher dedups
    expect(fires).toHaveLength(1);
  });

  it("person-scope sub only fires when the event's person matches", () => {
    const personSub: SubscriptionLite = {
      ...baseClanSub,
      scope: "person",
      target_id: "pX",
    };
    const fires = computeFireList({
      today: "2024-06-08",
      subscriptions: [personSub],
      events: [birthday({})],
      alreadySent: new Set(),
    });
    expect(fires).toHaveLength(0);

    const fires2 = computeFireList({
      today: "2024-06-08",
      subscriptions: [personSub],
      events: [birthday({ personId: "pX" })],
      alreadySent: new Set(),
    });
    expect(fires2).toHaveLength(1);
  });

  it("fires once per channel when a subscription has multiple channels", () => {
    const fires = computeFireList({
      today: "2024-06-08",
      subscriptions: [{ ...baseClanSub, channels: ["email", "sms"] }],
      events: [birthday({})],
      alreadySent: new Set(),
    });
    expect(fires.map((f) => f.channel).sort()).toEqual(["email", "sms"]);
  });

  it("deduplicates within a single run (same user × eventKey × channel)", () => {
    const twoOverlappingSubs: SubscriptionLite[] = [
      baseClanSub,
      { ...baseClanSub, id: "s2" }, // same user, same scope — should dedupe
    ];
    const fires = computeFireList({
      today: "2024-06-08",
      subscriptions: twoOverlappingSubs,
      events: [birthday({})],
      alreadySent: new Set(),
    });
    expect(fires).toHaveLength(1);
  });

  it("computes a stable event_key suitable for the notification_log unique index", () => {
    const fires = computeFireList({
      today: "2024-06-08",
      subscriptions: [baseClanSub],
      events: [birthday({})],
      alreadySent: new Set(),
    });
    expect(fires[0].eventKey).toBe("birthday:p1:2024-06-15:lead7");
  });
});
