import { useEffect, useState } from "react";

/**
 * Theo dõi một media query.
 *
 * Dùng khi khác biệt giữa điện thoại và máy tính là **cấu trúc DOM**, không
 * phải chỉ là style — ví dụ khung chat: trên điện thoại là lớp phủ toàn màn,
 * trên máy tính là thẻ nằm trong layout. Hai thứ đó không gộp được bằng
 * class Tailwind, phải render khác nhau.
 *
 * Còn nếu chỉ khác cách trình bày thì cứ dùng `lg:` cho rẻ.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange(); // query đổi giữa chừng thì đồng bộ lại ngay
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Ngưỡng `lg` của Tailwind — cùng mốc mà ClanLayout dùng để ghim drawer. */
export const DESKTOP_QUERY = "(min-width: 1024px)";
