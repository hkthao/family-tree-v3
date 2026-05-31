import { supabase } from "@/lib/supabase";

export interface MergeResult {
  winner: string;
  loser: string;
  familiesUpdated: number;
  subsUpdated: number;
  eventsUpdated: number;
}

/**
 * Collapse a duplicate `loser` person into `winner`. Calls the
 * SECURITY DEFINER RPC `merge_persons` which:
 *   - copies any null fields on the winner from the loser
 *   - re-points families.husband_id / wife_id from loser to winner
 *   - re-points event_subscriptions.target_id (person-scope)
 *   - re-points events.related_person_id
 *   - soft-deletes the loser (BEFORE-DELETE trigger sets deleted_at)
 *
 * The caller must be an editor of the clan; both persons must belong
 * to the same clan. Both are uuid strings.
 */
export async function mergePersons(
  winnerId: string,
  loserId: string,
): Promise<MergeResult> {
  const { data, error } = await supabase.rpc("merge_persons", {
    p_winner: winnerId,
    p_loser: loserId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as MergeResult;
}
