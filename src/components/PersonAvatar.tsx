interface Props {
  gender: "M" | "F";
  /** Photo path within the person-photos Supabase Storage bucket. */
  photoPath?: string | null;
  /** Diameter in px. Defaults to 40. */
  size?: number;
  className?: string;
}

/**
 * Circular avatar for a person. Falls back to the gendered illustration
 * in /avatars when no photo is uploaded. The bucket is private so
 * showing a real photo would require a signed-URL fetch; for now the
 * gendered PNG covers the common case where no photo has been added.
 */
export function PersonAvatar({ gender, photoPath, size = 40, className }: Props) {
  // Photo support deferred until upload UI exists — see Phase 3 backlog.
  void photoPath;
  const src = gender === "M" ? "/avatars/male.png" : "/avatars/female.png";

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`rounded-full object-cover bg-muted ${className ?? ""}`}
      aria-hidden="true"
      draggable={false}
    />
  );
}
