import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultClient } from "@/lib/supabase";
import type { Draft } from "@/lib/customs/compose";

export interface PublishResult {
  slug: string;
  path: string;
  commitUrl: string;
  /** true khi đã yêu cầu chạy deploy (bài hiện ra web/app sau vài phút). */
  deploying: boolean;
  deployError?: string;
}

/** Lỗi có mã (vd "exists" = trùng bài, cần xác nhận ghi đè). */
export class PublishError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

const split = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Gọi Edge Function publish-so-tay: commit bài vào repo (và chạy deploy khi `publish`). Chỉ platform admin gọi được.
 * functions.invoke gói mọi phản hồi lỗi thành thông báo chung, nên đọc lại phần thân để hiện đúng lý do tiếng Việt.
 */
export async function publishSoTay(
  draft: Draft,
  opts: { publish: boolean; overwrite?: boolean },
  client: SupabaseClient = defaultClient,
): Promise<PublishResult> {
  const body = {
    title: draft.title,
    description: draft.description,
    category: draft.category,
    tags: split(draft.tags),
    aliases: split(draft.aliases),
    regions: split(draft.regions),
    timing: draft.timing,
    body: draft.body,
    status: opts.publish ? "published" : "needs_review",
    overwrite: opts.overwrite === true,
  };
  const { data, error } = await client.functions.invoke<PublishResult>("publish-so-tay", { body });
  if (!error) return data as PublishResult;

  const ctx = (error as { context?: Response }).context;
  if (ctx instanceof Response) {
    try {
      const parsed = (await ctx.json()) as { error?: string; code?: string };
      if (typeof parsed.error === "string") throw new PublishError(parsed.error, parsed.code);
    } catch (e) {
      if (e instanceof PublishError) throw e;
    }
  }
  throw new PublishError(error.message);
}
