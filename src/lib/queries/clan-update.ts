import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export interface UpdateClanInput {
  name?: string;
  description?: string | null;
  visibility?: "private" | "public";
  hide_living_for_nonmembers?: boolean;
  hide_photos_in_share?: boolean;
  display_death_details?: boolean;
  display_living_full_dob?: boolean;
  /** 0 = Thủy tổ là Đời 1 (default); 1 = Thủy tổ là Đời 0. */
  generation_offset?: number;
  /** Người xem công khai được xem phần nào (chỉ hiệu lực khi public). */
  public_show_tree?: boolean;
  public_show_heritage?: boolean;
  public_show_graves?: boolean;
  public_show_events?: boolean;
}

/**
 * Update editable clan fields. RLS restricts to clan admin; trigger
 * protect_clan_privileged_cols additionally blocks any attempt to touch
 * max_persons / max_users / owner_id from this code path.
 */
export async function updateClan(
  clanId: string,
  input: UpdateClanInput,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("clans").update(input).eq("id", clanId);
  if (error) throw new Error(error.message);
}
