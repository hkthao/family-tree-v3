import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface EventRow {
  id: string;
  clan_id: string;
  title: string;
  event_type: "custom" | "reunion" | "memorial";
  date_solar: string | null;
  lunar_year: number | null;
  lunar_month: number | null;
  lunar_day: number | null;
  lunar_is_leap: boolean;
  is_yearly: boolean;
  related_person_id: string | null;
  notes: string | null;
  created_at: string;
}

export async function listEvents(
  clanId: string,
  client: Client = defaultClient,
): Promise<EventRow[]> {
  const { data, error } = await client
    .from("events")
    .select(
      "id, clan_id, title, event_type, date_solar, lunar_year, lunar_month, lunar_day, lunar_is_leap, is_yearly, related_person_id, notes, created_at",
    )
    .eq("clan_id", clanId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EventRow[];
}

export interface CreateEventInput {
  clan_id: string;
  title: string;
  event_type?: "custom" | "reunion" | "memorial";
  /** Exactly one of date_solar OR lunar_month is required (CHECK constraint). */
  date_solar?: string | null;
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_is_leap?: boolean;
  is_yearly?: boolean;
  related_person_id?: string | null;
  notes?: string | null;
}

export async function createEvent(
  input: CreateEventInput,
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("events")
    .insert({
      clan_id: input.clan_id,
      title: input.title,
      event_type: input.event_type ?? "custom",
      date_solar: input.date_solar ?? null,
      lunar_year: input.lunar_year ?? null,
      lunar_month: input.lunar_month ?? null,
      lunar_day: input.lunar_day ?? null,
      lunar_is_leap: input.lunar_is_leap ?? false,
      is_yearly: input.is_yearly ?? true,
      related_person_id: input.related_person_id ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function deleteEvent(
  eventId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("events").delete().eq("id", eventId);
  if (error) throw new Error(error.message);
}

export interface AnniversaryCandidate {
  id: string;
  full_name: string;
  generation: number | null;
  branch_id: string | null;
  death_anniv_lunar_month: number | null;
  death_anniv_lunar_day: number | null;
  death_anniv_lunar_is_leap: boolean;
}

/**
 * Deceased persons in this clan with a recurring lunar anniversary
 * (ngày giỗ) recorded. Powers the "Sắp tới" list on the Events page
 * + the notification cron in milestone D.
 */
export async function listAnniversaryCandidates(
  clanId: string,
  client: Client = defaultClient,
): Promise<AnniversaryCandidate[]> {
  const { data, error } = await client
    .from("persons")
    .select(
      "id, full_name, generation, branch_id, death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap",
    )
    .eq("clan_id", clanId)
    .eq("is_living", false)
    .not("death_anniv_lunar_month", "is", null)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as AnniversaryCandidate[];
}
