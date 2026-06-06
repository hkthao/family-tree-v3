/**
 * Map a route pathname to the doc article slug that best explains
 * what the user is looking at. Returns null when no good match exists
 * — the HelpButton hides itself in that case rather than dumping the
 * user onto a generic index.
 *
 * The function is intentionally small and dumb: a short ladder of
 * `startsWith` checks beats a regex table at this scale and stays
 * readable when new pages land. Add a branch here when you add a
 * route — no other wiring needed.
 *
 * Slugs must exist in `src/pages/docs/registry.tsx` (DOCS_BY_SLUG).
 */
export function helpSlugFor(pathname: string): string | null {
  // Top-level pages outside a clan
  if (pathname === "/" || pathname === "/clans") return "tong-quan";
  if (pathname === "/clans/new") return "tao-dong-ho";
  if (pathname.startsWith("/account")) return "dang-nhap";
  if (pathname.startsWith("/admin")) return "vai-tro";
  if (pathname.startsWith("/login") || pathname.startsWith("/signup"))
    return "dang-nhap";
  // The Docs pages already ARE the help — no extra button needed.
  if (pathname.startsWith("/docs")) return null;

  // Clan-scoped routes: /clans/<uuid>/<sub>
  const m = pathname.match(/^\/clans\/[^/]+(?:\/(.*))?$/);
  if (!m) return null;
  const sub = m[1] ?? "";

  if (sub === "") return "tong-quan"; // dashboard
  if (sub === "today") return "hom-nay";
  if (sub === "tree") return "thuy-to-doi";
  if (sub === "events") return "hom-nay";
  if (sub === "my-lineage") return "duong-truc-he";
  if (sub === "qr-export") return "qr-ca-nhan";
  if (sub === "merge") return "gop-trung";
  if (sub.startsWith("members")) return "vai-tro";
  if (sub.startsWith("settings")) return "vai-tro";
  if (sub === "audit") return "them-sua-xoa";
  if (sub === "import") return "them-sua-xoa";
  if (sub === "ai-generate") return "them-sua-xoa";
  if (sub.startsWith("contributions")) return "dong-gop";
  if (sub.startsWith("people")) {
    // Add / edit / detail / new — all the same doc.
    return "them-sua-xoa";
  }

  return null;
}
