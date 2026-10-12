import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import femaleAvatar from "../../public/avatars/female.png";
import maleAvatar from "../../public/avatars/male.png";

/**
 * URL ảnh đã ký, nhớ theo đường dẫn trong suốt phiên mở app.
 *
 * Không dùng `@/lib/photoUpload` của web: file đó kéo theo thư viện nén
 * ảnh cho phần TẢI LÊN, mà Mini App bản đầu chỉ xem.
 */
const cache = new Map<string, string>();
const ONE_DAY = 24 * 60 * 60;

async function sign(paths: string[]): Promise<void> {
  const need = [...new Set(paths)].filter((p) => !cache.has(p));
  if (need.length === 0) return;
  const { data } = await supabase.storage
    .from("person-photos")
    .createSignedUrls(need, ONE_DAY);
  for (const e of data ?? []) {
    if (e.signedUrl && e.path) cache.set(e.path, e.signedUrl);
  }
}

/** Ảnh của một nhóm người; ký theo từng nhánh đang mở, không ký cả họ. */
export function usePhotoUrls(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p).sort();
  const key = list.join(",");
  const [, bump] = useState(0);
  useEffect(() => {
    if (list.every((p) => cache.has(p))) return;
    let live = true;
    sign(list).then(() => live && bump((n) => n + 1));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (path: string | null | undefined, gender: "M" | "F") =>
    (path && cache.get(path)) || (gender === "M" ? maleAvatar : femaleAvatar);
}
