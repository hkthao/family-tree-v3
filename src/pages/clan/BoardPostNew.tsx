import { useNavigate, useParams } from "react-router-dom";

import { BoardPostForm } from "@/components/BoardPostForm";
import { Breadcrumb } from "@/components/Breadcrumb";
import { IconPlus } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useClanContext } from "@/hooks/useClanContext";

/**
 * `/clans/:clanId/board/new` — trang đăng bài mới.
 */
export default function BoardPostNew() {
  const { clanId } = useParams<{ clanId: string }>();
  const navigate = useNavigate();
  const { clan } = useClanContext();

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clanId}` },
          { label: "Bảng tin", to: `/clans/${clanId}/board` },
          { label: "Đăng bài mới" },
        ]}
      />

      <PageHeader
        icon={<IconPlus className="h-7 w-7" />}
        title="Đăng bài mới"
      />

      <BoardPostForm
        clan={clan}
        onDone={(postId) => {
          // Bài chính thức → vào detail; pending → quay về list (vì user
          // chưa thấy bài, đỡ confuse). Nhưng author thấy được bài
          // pending của mình nên detail vẫn hợp lệ.
          navigate(`/clans/${clanId}/board/${postId}`);
        }}
        onCancel={() => navigate(`/clans/${clanId}/board`)}
      />
    </div>
  );
}
