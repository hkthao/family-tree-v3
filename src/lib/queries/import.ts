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

/** Ngưỡng số người để chuyển sang nhập theo batch (dưới ngưỡng: 1 lần gọi). */
const BATCH_THRESHOLD = 400;
/** Số người mỗi batch khi nhập file lớn. */
const BATCH_SIZE = 300;

type RpcPayload =
  Database["public"]["Functions"]["bulk_import_persons"]["Args"]["payload"];

async function callRpc(
  client: Client,
  clanId: string,
  payload: Partial<ImportPayload>,
  finalize: boolean,
): Promise<void> {
  const { error } = await client.rpc("bulk_import_persons", {
    target_clan: clanId,
    payload: payload as unknown as RpcPayload,
    p_finalize: finalize,
  });
  if (error) throw new Error(error.message);
}

/**
 * Nhập payload đã resolve vào dòng họ.
 *
 * - Payload nhỏ (< {@link BATCH_THRESHOLD} người): gọi RPC MỘT lần.
 * - Payload lớn: chia batch để không dính statement_timeout —
 *   1) branches + families (để trống vợ/chồng) — persons chưa có cũng OK;
 *   2) persons theo từng batch (birth_family_id trỏ về families đã có);
 *   3) batch cuối gửi lại families KÈM vợ/chồng (persons đã có) + finalize
 *      (tính lại đời + person_count MỘT lần).
 * RPC tự tắt các trigger nặng theo dòng nên tổng thể là O(n), không O(n²).
 */
export async function bulkImportPersons(
  clanId: string,
  payload: ImportPayload,
  client: Client = defaultClient,
): Promise<ImportResult> {
  const { persons, families, branches } = payload;

  if (persons.length < BATCH_THRESHOLD) {
    const { error } = await client.rpc("bulk_import_persons", {
      target_clan: clanId,
      payload: payload as unknown as RpcPayload,
      p_finalize: true,
    });
    if (error) throw new Error(error.message);
  } else {
    // 1) branches + families với vợ/chồng để trống (persons chưa tồn tại).
    const familiesNoSpouse = families.map((f) => ({
      ...f,
      husband_id: null,
      wife_id: null,
    }));
    await callRpc(client, clanId, { branches, families: familiesNoSpouse, persons: [] }, false);

    // 2) persons theo batch.
    for (let i = 0; i < persons.length; i += BATCH_SIZE) {
      await callRpc(client, clanId, { persons: persons.slice(i, i + BATCH_SIZE) }, false);
    }

    // 3) families kèm vợ/chồng (upsert) + finalize.
    await callRpc(client, clanId, { families, persons: [] }, true);
  }

  return {
    imported_branches: branches.length,
    imported_families: families.length,
    imported_persons: persons.length,
  };
}
