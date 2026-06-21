import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import { deletePersonPhoto } from "@/lib/photoUpload";

type Client = SupabaseClient<Database>;

export type RestingPlaceKind =
  | "grave"
  | "ashes_temple"
  | "columbarium"
  | "scattered"
  | "other";
export type RestingPlaceStatus = "existing" | "relocated" | "lost";

export const RESTING_PLACE_KIND_LABEL: Record<RestingPlaceKind, string> = {
  grave: "Mộ / chôn cất",
  ashes_temple: "Gửi tro cốt ở chùa",
  columbarium: "Nhà lưu tro / tháp cốt",
  scattered: "Rải tro",
  other: "Khác",
};
export const RESTING_PLACE_STATUS_LABEL: Record<RestingPlaceStatus, string> = {
  existing: "Hiện hữu",
  relocated: "Đã cải táng",
  lost: "Thất lạc",
};

/** Per-kind labels for the two adaptive location inputs. */
export const KIND_LOCATION_LABELS: Record<
  RestingPlaceKind,
  { name: string; detail: string | null }
> = {
  grave: { name: "Nghĩa trang / khu", detail: "Lô – hàng – số" },
  ashes_temple: { name: "Tên chùa", detail: "Vị trí hũ (ngăn/tầng/số)" },
  columbarium: { name: "Cơ sở lưu tro / tháp họ", detail: "Ngăn / kệ / số hũ" },
  scattered: { name: "Nơi rải tro", detail: null },
  other: { name: "Nơi an nghỉ", detail: "Chi tiết vị trí" },
};

export interface RestingPlace {
  id: string;
  clan_id: string;
  kind: RestingPlaceKind;
  name: string | null;
  location_name: string | null;
  location_detail: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  orientation: string | null;
  status: RestingPlaceStatus;
  built_year: number | null;
  material: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OccupantBrief {
  occupant_id: string;
  person_id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  note: string | null;
}
export interface RestingPlacePhoto {
  id: string;
  path: string;
  caption: string | null;
  sort: number;
}
export interface RestingPlaceListItem extends RestingPlace {
  occupant_count: number;
  first_photo_path: string | null;
}
export interface RestingPlaceDetail extends RestingPlace {
  occupants: OccupantBrief[];
  photos: RestingPlacePhoto[];
}

const COLS =
  "id, clan_id, kind, name, location_name, location_detail, address, latitude, longitude, orientation, status, built_year, material, notes, created_at, updated_at";

export async function listRestingPlaces(
  clanId: string,
  opts: { search?: string; kind?: RestingPlaceKind | null } = {},
  client: Client = defaultClient,
): Promise<RestingPlaceListItem[]> {
  let q = client
    .from("resting_places")
    .select(
      `${COLS}, resting_place_occupants(id), resting_place_photos(path, sort)`,
    )
    .eq("clan_id", clanId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (opts.kind) q = q.eq("kind", opts.kind);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const needle = (opts.search ?? "").trim().toLowerCase();
  return (data ?? [])
    .map((r) => {
      const photos = (r.resting_place_photos ?? []) as { path: string; sort: number }[];
      photos.sort((a, b) => a.sort - b.sort);
      const { resting_place_occupants, resting_place_photos, ...rest } = r;
      return {
        ...(rest as RestingPlace),
        occupant_count: (resting_place_occupants ?? []).length,
        first_photo_path: photos[0]?.path ?? null,
      };
    })
    .filter((r) => {
      if (!needle) return true;
      const hay = `${r.name ?? ""} ${r.location_name ?? ""} ${r.location_detail ?? ""} ${r.address ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
}

export async function getRestingPlace(
  id: string,
  client: Client = defaultClient,
): Promise<RestingPlaceDetail | null> {
  const { data, error } = await client
    .from("resting_places")
    .select(
      `${COLS},
       resting_place_occupants(id, note, person:persons(id, full_name, gender, is_living)),
       resting_place_photos(id, path, caption, sort)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { resting_place_occupants, resting_place_photos, ...rest } = data;
  // deno-lint shape: person may be object or null
  const occupants: OccupantBrief[] = (resting_place_occupants ?? [])
    .map((o) => {
      const p = (o as { person: { id: string; full_name: string; gender: "M" | "F"; is_living: boolean } | null }).person;
      if (!p) return null;
      return {
        occupant_id: o.id as string,
        person_id: p.id,
        full_name: p.full_name,
        gender: p.gender,
        is_living: p.is_living,
        note: (o.note as string | null) ?? null,
      };
    })
    .filter((x): x is OccupantBrief => x !== null);
  const photos = ((resting_place_photos ?? []) as RestingPlacePhoto[]).sort(
    (a, b) => a.sort - b.sort,
  );
  return { ...(rest as RestingPlace), occupants, photos };
}

export type RestingPlaceInput = Partial<
  Omit<RestingPlace, "id" | "clan_id" | "created_at" | "updated_at">
> & { kind: RestingPlaceKind };

export async function createRestingPlace(
  clanId: string,
  input: RestingPlaceInput,
  client: Client = defaultClient,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("resting_places")
    .insert({ clan_id: clanId, ...input })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function updateRestingPlace(
  id: string,
  patch: Partial<RestingPlaceInput>,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("resting_places").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Soft-delete (filtered out of reads by `deleted_at is null`). */
export async function deleteRestingPlace(
  id: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("resting_places")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addOccupant(
  restingPlaceId: string,
  personId: string,
  note: string | null = null,
  client: Client = defaultClient,
): Promise<void> {
  // clan_id is set by the BEFORE INSERT sync trigger; send a placeholder.
  const { error } = await client.from("resting_place_occupants").insert({
    resting_place_id: restingPlaceId,
    person_id: personId,
    clan_id: "00000000-0000-0000-0000-000000000000",
    note,
  });
  if (error) throw new Error(error.message);
}
export async function removeOccupant(
  occupantId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("resting_place_occupants")
    .delete()
    .eq("id", occupantId);
  if (error) throw new Error(error.message);
}

export async function addPhoto(
  restingPlaceId: string,
  path: string,
  caption: string | null = null,
  sort = 0,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("resting_place_photos").insert({
    resting_place_id: restingPlaceId,
    clan_id: "00000000-0000-0000-0000-000000000000", // synced by trigger
    path,
    caption,
    sort,
  });
  if (error) throw new Error(error.message);
}
export async function removePhoto(
  photoId: string,
  path: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("resting_place_photos")
    .delete()
    .eq("id", photoId);
  if (error) throw new Error(error.message);
  await deletePersonPhoto(path).catch(() => {}); // best-effort storage cleanup
}

/** Resting places a given person is recorded in — for the PersonDetail link. */
export async function getRestingPlacesForPerson(
  personId: string,
  client: Client = defaultClient,
): Promise<{ id: string; kind: RestingPlaceKind; name: string | null; location_name: string | null }[]> {
  const { data, error } = await client
    .from("resting_place_occupants")
    .select("resting_place:resting_places(id, kind, name, location_name, deleted_at)")
    .eq("person_id", personId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((o) => (o as { resting_place: { id: string; kind: RestingPlaceKind; name: string | null; location_name: string | null; deleted_at: string | null } | null }).resting_place)
    .filter((r): r is { id: string; kind: RestingPlaceKind; name: string | null; location_name: string | null; deleted_at: string | null } => !!r && !r.deleted_at)
    .map(({ deleted_at, ...rest }) => rest);
}

/** Build a "chỉ đường" Google Maps URL from coordinates (null if no GPS). */
export function directionsUrl(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
