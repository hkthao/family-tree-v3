import { useEffect, useState } from "react";

import {
  getPosterUrl,
  getVideoUrl,
  pickViewport,
  type VideoTutorial,
  type Viewport,
} from "@/lib/videoTutorials";

/**
 * Player video hướng dẫn — autopicks mobile/desktop variant theo
 * viewport client. Render native <video> với poster + controls.
 *
 * Lazy: chỉ load video khi visible (preload="metadata") để không kéo
 * file MB ngay khi mở trang.
 */
export function VideoPlayer({
  tutorial,
  autoPlay = false,
  className = "",
}: {
  tutorial: VideoTutorial;
  autoPlay?: boolean;
  className?: string;
}) {
  const [viewport, setViewport] = useState<Viewport>(pickViewport);

  useEffect(() => {
    function onResize() {
      setViewport(pickViewport());
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const src = getVideoUrl(tutorial.spec, viewport);
  const poster = getPosterUrl(tutorial.spec, viewport);

  // Mobile video (390×844 portrait) cao gấp 2× rộng. Áp `aspectRatio`
  // sẽ bắt wrapper cao tới >700px trên màn 390px → tràn modal.
  // Dùng max-h trên <video> để browser native scale, giữ aspect tự
  // động.
  return (
    <div
      className={`flex items-center justify-center bg-black rounded-lg overflow-hidden ${className}`}
    >
      <video
        key={src}
        src={src}
        poster={poster}
        controls
        preload="metadata"
        autoPlay={autoPlay}
        playsInline
        className="max-h-[min(70vh,640px)] max-w-full w-auto h-auto"
      >
        Trình duyệt của bạn không hỗ trợ video. Cập nhật trình duyệt
        hoặc xem trang{" "}
        <a href={src} className="underline">
          /static/videos
        </a>
        .
      </video>
    </div>
  );
}
