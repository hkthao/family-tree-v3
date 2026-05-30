import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type AuditAction = "insert" | "update" | "delete";
export type AuditEntity = "person" | "family" | "branch";

export interface AuditRow {
  id: string;
  clan_id: string;
  entity_type: AuditEntity;
  entity_id: string;
  action: AuditAction;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
}

export interface ListAuditParams {
  page: number; // 1-based
  pageSize: number;
  entityType?: AuditEntity | null;
  action?: AuditAction | null;
}

export interface ListAuditResult {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listAudit(
  clanId: string,
  params: ListAuditParams,
  client: Client = defaultClient,
): Promise<ListAuditResult> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let q = client
    .from("audit_log")
    .select(
      "id, clan_id, entity_type, entity_id, action, before, after, changed_by, changed_at",
      { count: "exact" },
    )
    .eq("clan_id", clanId)
    .order("changed_at", { ascending: false })
    .range(from, to);

  if (params.entityType) q = q.eq("entity_type", params.entityType);
  if (params.action) q = q.eq("action", params.action);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []) as AuditRow[],
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

/**
 * Restore an audit entry via the RPC. Soft-delete model means:
 *   delete → clear deleted_at; insert → set deleted_at; update → write
 *   the before-row jsonb back.
 *
 * The RPC trips the audit trigger again with the restoration as a new
 * row, so the timeline shows both the original change and the undo.
 */
export async function restoreAuditEntry(
  auditId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.rpc("restore_audit_entry", {
    audit_id: auditId,
  });
  if (error) throw new Error(error.message);
}
