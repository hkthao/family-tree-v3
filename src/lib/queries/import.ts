import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { ImportPayload } from "@/lib/importPersons";

type Client = SupabaseClient<Database>;

export interface ImportResult {
  imported_branches: number;
  imported_families: number;
  imported_persons: number;
}

/**
 * Call the bulk_import_persons RPC with a pre-resolved payload. The RPC
 * does everything in one transaction with FK constraints deferred so
 * persons can reference families that don't yet exist in the same call.
 */
export async function bulkImportPersons(
  clanId: string,
  payload: ImportPayload,
  client: Client = defaultClient,
): Promise<ImportResult> {
  const { data, error } = await client.rpc("bulk_import_persons", {
    target_clan: clanId,
    payload: payload as unknown as Database["public"]["Functions"]["bulk_import_persons"]["Args"]["payload"],
  });
  if (error) throw new Error(error.message);
  return data as unknown as ImportResult;
}
