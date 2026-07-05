/**
 * Kiểm tra thiết bị có WebGL không → quyết định hiện phòng 3D hay rơi về 2D.
 * Dùng chung cho phòng trưng bày (và có thể cả cây 3D sau này).
 */
let cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return (cached = false);
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    cached = !!gl;
  } catch {
    cached = false;
  }
  return cached;
}
