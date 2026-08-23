/**
 * Tách class "chiếm chỗ" khỏi class "trang trí" cho các ô nhập có icon.
 *
 * Vì sao cần: `<Input icon>` và `<Select icon>` bọc ô trong một `div
 * relative` để đặt icon tuyệt đối. Nếu class rộng-hẹp (`max-w-sm`,
 * `w-auto`, `flex-1`…) rơi vào Ô mà không rơi vào KHUNG BỌC thì khung
 * vẫn rộng hết cỡ, còn ô co lại — icon và mũi tên bị neo theo khung nên
 * trôi ra xa ô, trông như hai thành phần rời nhau. Đã gặp đúng vậy ở
 * "Model cho hỏi đáp" trong Quản trị › Trợ lý AI (`max-w-sm`).
 *
 * Nên: mọi thứ liên quan tới chiều ngang / vị trí trong lưới đi ra
 * khung; còn lại (chiều cao, font, màu, border…) ở lại ô.
 */

/** Tiền tố class thuộc về khung bọc, không thuộc về ô. */
const LAYOUT = [
  "w-",
  "max-w-",
  "min-w-",
  "flex-1",
  "flex-auto",
  "flex-none",
  "shrink",
  "grow",
  "basis-",
  "self-",
  "order-",
  "col-span-",
  "ml-",
  "mr-",
  "mx-",
];

const isLayout = (token: string) => {
  // Bỏ tiền tố responsive/state (sm:, lg:, focus:…) trước khi so.
  const bare = token.slice(token.lastIndexOf(":") + 1);
  return LAYOUT.some((p) =>
    p.endsWith("-") ? bare.startsWith(p) : bare === p || bare.startsWith(p + "-"),
  );
};

export interface SplitClasses {
  /** Cho `div` bọc ngoài. */
  wrapper: string;
  /** Cho chính `<input>` / `<select>`. */
  field: string;
}

export function splitFieldClasses(className?: string): SplitClasses {
  if (!className) return { wrapper: "", field: "" };
  const tokens = className.split(/\s+/).filter(Boolean);
  return {
    wrapper: tokens.filter(isLayout).join(" "),
    field: tokens.filter((t) => !isLayout(t)).join(" "),
  };
}
