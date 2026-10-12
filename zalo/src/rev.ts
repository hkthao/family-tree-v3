import { createContext, useContext } from "react";

/**
 * "Phiên bản dữ liệu" của cả app: tăng lên sau mỗi lần ghi (sửa hồ sơ, thêm
 * người, xoá người). Màn hình nào đang giữ dữ liệu — cây, danh bạ, tổng
 * quan, sự kiện — đưa con số này vào điều kiện tải của mình, nên tự tải lại
 * tại chỗ (giữ nguyên nhánh đang bung và vị trí cuộn) thay vì bắt người
 * dùng thoát ra mở lại mới thấy thay đổi.
 */
export const RevContext = createContext(0);
export const useRev = () => useContext(RevContext);
