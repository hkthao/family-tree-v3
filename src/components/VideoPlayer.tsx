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
  // Aspect ratio khác giữa mobile và desktop — wrapper hỗ trợ cả 2.
  const aspect = viewport === "mobile" ? "390/844" : "16/10";

  return (
    <div
      className={`rounded-lg overflow-hidden bg-black ${className}`}
      style={{ aspectRatio: aspect }}
    >
      <video
        key={src}
        src={src}
        poster={poster}
        controls
        preload="metadata"
        autoPlay={autoPlay}
        playsInline
        className="w-full h-full"
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
