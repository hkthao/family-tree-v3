/**
 * Đọc biến môi trường mà không cần global `Deno` lúc biên dịch.
 *
 * Vì sao không dùng thẳng `Deno.env.get`: các file trong thư mục này
 * được unit test bằng vitest (Node), nơi `Deno` không tồn tại — `tsc -b`
 * của app sẽ báo "Cannot find name 'Deno'". Còn khai báo ambient
 * `declare const Deno` thì lại đụng với type thật khi Deno tự kiểm tra.
 *
 * Đi qua `globalThis` giải quyết cả hai: không cần khai báo gì, chạy
 * đúng trên Deno, và trả `undefined` một cách yên lành ở Node.
 */

interface DenoLike {
  env: { get(name: string): string | undefined };
}

export function env(name: string): string | undefined {
  return (globalThis as { Deno?: DenoLike }).Deno?.env.get(name);
}
