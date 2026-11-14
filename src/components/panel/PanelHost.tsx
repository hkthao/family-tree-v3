import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo } from "react";

import { AiChatView } from "@/components/ai/AiChatView";
import {
  AI_DOCK_OPEN_EVENT,
  FLOATING_ASSISTANT_ENABLED,
} from "@/components/ai/AiChatDock";
import { QuickAddSheet } from "@/components/QuickAddSheet";
import { SidePanel } from "@/components/SidePanel";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { useAuth } from "@/hooks/useAuth";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { isFeatureEnabled } from "@/lib/clanFeatures";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { ClanContextProvider, isClanAdmin } from "@/hooks/useClanContext";
import { getClanPost } from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";
import { getPerson } from "@/lib/queries/persons";

import { usePanel } from "./usePanel";

import { t } from "@lingui/core/macro";
// Tải khi mở (không phình bundle của trang).
const NewPersonForm = lazy(() =>
  import("@/pages/clan/NewPerson").then((m) => ({ default: m.NewPersonForm })),
);
const EditPersonForm = lazy(() =>
  import("@/pages/clan/EditPerson").then((m) => ({
    default: m.EditPersonForm,
  })),
);

const InlawsNew = lazy(() => import("@/pages/clan/InlawsNew"));
const RestingPlaceForm = lazy(() => import("@/pages/clan/RestingPlaceForm"));
const HeritageForm = lazy(() => import("@/pages/clan/HeritageForm"));
const BoardPostForm = lazy(() =>
  import("@/components/BoardPostForm").then((m) => ({
    default: m.BoardPostForm,
  })),
);

const Loading = () => (
  <p className="py-6 text-sm text-muted-foreground">{t`Đang tải…`}</p>
);

/**
 * Gắn một lần ở ClanLayout: đọc `?panel=` và dựng ngăn kéo tương ứng. Thêm
 * loại panel mới = thêm một nhánh ở đây + một PanelId trong usePanel.
 */
export function PanelHost({ clan }: { clan: ClanDetail }) {
  // Form / chi tiết nhúng trong ngăn kéo gọi useClanContext() như khi nằm dưới
  // <Outlet> — PanelHost đứng ngoài Outlet nên cấp lại qua provider.
  const ctx = useMemo(() => ({ clan }), [clan]);
  return (
    <ClanContextProvider value={ctx}>
      <PanelHostInner clan={clan} />
    </ClanContextProvider>
  );
}

function PanelHostInner({ clan }: { clan: ClanDetail }) {
  const clanId = clan.id;
  const { current, params, close, open } = usePanel();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const aiEnabled = useAiEnabled();
  const chatOk =
    aiEnabled && isFeatureEnabled(clan.disabled_features, "ai_assistant");

  // Máy tính: "chat" nghĩa là mở khung dock bên phải (không modal) rồi gỡ ?panel=.
  // Khi khung nổi đang TẠM ẨN (FLOATING_ASSISTANT_ENABLED = false) thì chat mở bằng ngăn kéo như điện thoại.
  const openDock =
    FLOATING_ASSISTANT_ENABLED && current === "chat" && isDesktop && chatOk;
  useEffect(() => {
    if (!openDock) return;
    window.dispatchEvent(new Event(AI_DOCK_OPEN_EVENT));
    close();
  }, [openDock, close]);
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const pid = params.pid;

  const { data: person } = useQuery({
    queryKey: queryKeys.person(pid ?? "", userId),
    queryFn: () => getPerson(pid!),
    enabled:
      !!pid &&
      !!userId &&
      (current === "person-edit" || current === "person-view"),
  });

  // Xem nhanh (chỉ đọc): cùng form sửa nhưng khoá mọi ô; nút "Sửa" chuyển sang trang chi tiết của người đó.
  if (current === "person-view" && pid) {
    return (
      <SidePanel
        open
        title={t`Thông tin người`}
        subtitle={person?.full_name}
        onClose={close}
        size="lg"
        guard={false}
      >
        <Suspense fallback={<Loading />}>
          <EditPersonForm
            clanId={clanId}
            personId={pid}
            readOnly
            onSaved={close}
            onCancel={close}
          />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "person-new") {
    return (
      <SidePanel
        open
        title={params.pfrom ? t`Sao chép người` : t`Thêm người`}
        subtitle={t`Nhập xong bấm Lưu — danh sách phía sau tự cập nhật.`}
        onClose={close}
        size="lg"
      >
        <Suspense fallback={<Loading />}>
          <NewPersonForm
            clanId={clanId}
            fromId={params.pfrom ?? null}
            onDone={close}
            onCancel={close}
          />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "person-edit" && pid) {
    return (
      <SidePanel
        open
        title={t`Sửa thông tin`}
        subtitle={person?.full_name}
        onClose={close}
        size="lg"
      >
        <Suspense fallback={<Loading />}>
          <EditPersonForm
            clanId={clanId}
            personId={pid}
            onSaved={close}
            onCancel={close}
          />
        </Suspense>
      </SidePanel>
    );
  }

  // Xem (chỉ đọc): dùng lại đúng form sửa nhưng khoá mọi ô; nút "Sửa" mới chuyển sang route sửa.
  if (current === "grave-view" && pid) {
    return (
      <SidePanel
        open
        title={t`Nơi an nghỉ`}
        onClose={close}
        size="lg"
        guard={false}
      >
        <Suspense fallback={<Loading />}>
          <RestingPlaceForm
            embedded={{
              id: pid,
              readOnly: true,
              onDone: close,
              onCancel: close,
            }}
          />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "heritage-view" && pid) {
    return (
      <SidePanel
        open
        title={t`Mục di sản`}
        onClose={close}
        size="lg"
        guard={false}
      >
        <Suspense fallback={<Loading />}>
          <HeritageForm
            embedded={{
              id: pid,
              readOnly: true,
              onDone: close,
              onCancel: close,
            }}
          />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "grave-new" || (current === "grave-edit" && pid)) {
    const isEdit = current === "grave-edit";
    return (
      <SidePanel
        open
        title={isEdit ? t`Sửa nơi an nghỉ` : t`Thêm nơi an nghỉ`}
        onClose={close}
        size="lg"
      >
        <Suspense fallback={<Loading />}>
          <RestingPlaceForm
            embedded={{
              id: isEdit ? pid : undefined,
              onDone: close,
              onCancel: close,
            }}
          />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "heritage-new" || (current === "heritage-edit" && pid)) {
    const isEdit = current === "heritage-edit";
    return (
      <SidePanel
        open
        title={isEdit ? t`Sửa mục di sản` : t`Thêm mục di sản`}
        onClose={close}
        size="lg"
      >
        <Suspense fallback={<Loading />}>
          <HeritageForm
            embedded={{
              id: isEdit ? pid : undefined,
              onDone: close,
              onCancel: close,
            }}
          />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "inlaw-new") {
    return (
      <SidePanel
        open
        title={t`Đề nghị liên kết dòng họ`}
        subtitle={t`Nối với dòng họ khác qua một thành viên — admin bên kia phải xác nhận.`}
        onClose={close}
        size="lg"
      >
        <Suspense fallback={<Loading />}>
          <InlawsNew embedded={{ onDone: close, onCancel: close }} />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "board-view" && pid) {
    return (
      <SidePanel
        open
        title={t`Bài viết`}
        onClose={close}
        size="lg"
        guard={false}
      >
        <Suspense fallback={<Loading />}>
          <BoardPostViewBody
            clan={clan}
            postId={pid}
            onClose={close}
            onEdit={() => open("board-edit", { pid })}
          />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "board-new") {
    return (
      <SidePanel open title={t`Đăng bài mới`} onClose={close} size="lg">
        <Suspense fallback={<Loading />}>
          <BoardPostForm clan={clan} onDone={close} onCancel={close} />
        </Suspense>
      </SidePanel>
    );
  }

  if (current === "board-edit" && pid) {
    return (
      <SidePanel open title={t`Sửa bài`} onClose={close} size="lg">
        <Suspense fallback={<Loading />}>
          <BoardPostEditBody clan={clan} postId={pid} onClose={close} />
        </Suspense>
      </SidePanel>
    );
  }

  if (
    current === "chat" &&
    (!isDesktop || !FLOATING_ASSISTANT_ENABLED) &&
    chatOk
  ) {
    return (
      <SidePanel
        open
        title={t`Trợ lý dòng họ`}
        subtitle={clan.name}
        onClose={close}
        bare
        guard={false}
      >
        <AiChatView clan={clan} variant="panel" />
      </SidePanel>
    );
  }

  if (current === "person-add" && pid) {
    return (
      <QuickAddSheet
        open
        onClose={close}
        clanId={clanId}
        personId={pid}
        defaultRelation={params.prel}
      />
    );
  }

  return null;
}

/** Tải bài rồi dựng form sửa; chỉ tác giả hoặc quản trị dòng họ được sửa (RLS vẫn chặn phía server). */
function BoardPostEditBody({
  clan,
  postId,
  onClose,
}: {
  clan: ClanDetail;
  postId: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { data: post, isLoading } = useQuery({
    queryKey: queryKeys.clanPost(postId),
    queryFn: () => getClanPost(postId),
  });
  if (isLoading) return <Loading />;
  if (!post)
    return (
      <p className="py-6 text-sm text-muted-foreground">{t`Không tìm thấy bài viết.`}</p>
    );
  if (post.author_id !== user?.id && !isClanAdmin(clan)) {
    return (
      <p className="py-6 text-sm text-muted-foreground">{t`Bạn không có quyền sửa bài này.`}</p>
    );
  }
  return (
    <BoardPostForm
      clan={clan}
      post={post}
      onDone={onClose}
      onCancel={onClose}
    />
  );
}

/** Xem một bài (chỉ đọc): cùng form đăng/sửa nhưng khoá mọi ô; "Sửa" chỉ cho tác giả hoặc quản trị. */
function BoardPostViewBody({
  clan,
  postId,
  onClose,
  onEdit,
}: {
  clan: ClanDetail;
  postId: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { user } = useAuth();
  const { data: post, isLoading } = useQuery({
    queryKey: queryKeys.clanPost(postId),
    queryFn: () => getClanPost(postId),
  });
  if (isLoading) return <Loading />;
  if (!post)
    return (
      <p className="py-6 text-sm text-muted-foreground">{t`Không tìm thấy bài viết.`}</p>
    );
  const canEdit = post.author_id === user?.id || isClanAdmin(clan);
  return (
    <BoardPostForm
      clan={clan}
      post={post}
      readOnly
      canEdit={canEdit}
      onEdit={onEdit}
      onDone={onClose}
      onCancel={onClose}
    />
  );
}
