interface Props {
  gender: "M" | "F";
  /**
   * Pre-resolved signed URL pointing at the person's photo in
   * Supabase Storage. Caller is expected to feed it from
   * `useSignedPhotoUrl(photoPath)` so we don't trigger a fresh API
   * call on every avatar render. Falsy → fall back to the gendered
   * illustration.
   */
  photoUrl?: string | null;
  /** Diameter in px. Defaults to 40. */
  size?: number;
  className?: string;
}

/**
 * Circular avatar for a person. Renders the uploaded photo when
 * `photoUrl` is provided, otherwise the gendered illustration from
 * /public/avatars.
 */
export function PersonAvatar({ gender, photoUrl, size = 40, className }: Props) {
  const fallback = gender === "M" ? "/avatars/male.png" : "/avatars/female.png";
  return (
    <img
      src={photoUrl || fallback}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      // Khoá cả hai chiều bằng style: Tailwind đặt `height: auto` cho <img>, nên
      // ảnh đứng / ngang (vd tượng thờ 3:4 từ link ngoài) sẽ méo thành bầu dục;
      // object-cover cắt ảnh vừa khung tròn. shrink-0: không bị ép hẹp trong flex.
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full object-cover object-top bg-muted ${className ?? ""}`}
      aria-hidden="true"
      draggable={false}
    />
  );
}
