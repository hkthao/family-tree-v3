import { useCallback, useEffect, useState } from "react";

/**
 * Chạy một hàm bất đồng bộ và theo dõi trạng thái. Mini App không kéo
 * react-query của web vào: bản đầu chỉ xem, vài màn hình, cache đơn giản
 * theo từng màn là đủ — bớt một thư viện phải qua duyệt cùng bản dựng.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: true });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const load = useCallback(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    run()
      .then((data) => live && setState({ data, loading: false }))
      .catch(
        (e: Error) => live && setState({ error: e.message, loading: false }),
      );
    return () => {
      live = false;
    };
  }, [run]);

  useEffect(load, [load]);
  return { ...state, reload: load };
}
