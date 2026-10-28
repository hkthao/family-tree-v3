import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Tree3DView } from "@/components/Tree3DView";
import type { TreeData } from "@/lib/queries/tree";
import { hasWebGL } from "@/lib/webglSupport";

import femaleAvatar from "../../../public/avatars/female.png";
import maleAvatar from "../../../public/avatars/male.png";

/**
 * Cây 3D — dùng NGUYÊN thành phần `Tree3DView` của bản web, không viết lại.
 *
 * Bản viết riêng ban đầu (nhãn tên trên nền lực đẩy) cho ra hình khác hẳn
 * web. Thành phần của web đã có sẵn thẻ ảnh chân dung, cách ghim tầng theo
 * đời, chế độ bung dần cho họ lớn và các mức siết riêng cho điện thoại —
 * dùng lại là hai bên luôn giống nhau, sửa một nơi là đủ.
 *
 * Nó cần react-query (kể cả khi được nạp sẵn dữ liệu), nên bọc một
 * QueryClient riêng ở đây; phần còn lại của Mini App không dùng tới.
 */
const client = new QueryClient();
const AVATARS = { M: maleAvatar, F: femaleAvatar };

export function Tree3D({
  clanId,
  genOffset,
  data,
  photoUrls,
  focalId,
  depth,
}: {
  clanId: string;
  genOffset: number;
  data: TreeData;
  photoUrls: Map<string, string>;
  focalId: string | null;
  depth: number;
}) {
  if (!hasWebGL()) {
    return (
      <div className="card empty" style={{ margin: 12 }}>
        <p className="muted" style={{ margin: 0 }}>
          Máy này không hỗ trợ đồ hoạ 3D. Hãy dùng kiểu 2D hoặc Thư mục.
        </p>
      </div>
    );
  }
  return (
    <QueryClientProvider client={client}>
      <Tree3DView
        clanId={clanId}
        genOffset={genOffset}
        focal={focalId}
        depth={depth}
        data={data}
        photoUrls={photoUrls}
        avatars={AVATARS}
        className="canvas tw3d"
      />
    </QueryClientProvider>
  );
}
