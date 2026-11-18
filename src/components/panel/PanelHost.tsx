import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useMemo } from "react";

import { QuickAddSheet } from "@/components/QuickAddSheet";
import { SidePanel } from "@/components/SidePanel";
import { useAuth } from "@/hooks/useAuth";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { ClanContextProvider, isClanAdmin } from "@/hooks/useClanContext";
import { getClanPost } from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";
import { getPerson } from "@/lib/queries/persons";

import { CustomViewPanel } from "./CustomsPanelHost";
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
// Ngăn kéo XEM dùng trang đọc (không phải form khoá ô): dễ đọc trên điện thoại hơn.
const PersonDetail = lazy(() => import("@/pages/clan/PersonDetail"));
const RestingPlaceDetail = lazy(
  () => import("@/pages/clan/RestingPlaceDetail"),
);
const HeritageDetail = lazy(() => import("@/pages/clan/HeritageDetail"));
const BoardPostDetail = lazy(() => import("@/pages/clan/BoardPostDetail"));
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
  const { current, params, close } = usePanel();
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

  // Xem nhanh: trang chi tiết dạng đọc (ảnh, thông tin, quan hệ, tiểu sử); bấm người thân mở ngăn kéo người đó.
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
          <PersonDetail embedded={{ id: pid, onClose: close }} />
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

  // Xem: trang chi tiết dạng đọc; nút "Sửa" trong đó mở ngăn kéo sửa.
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
          <RestingPlaceDetail embedded={{ id: pid, onClose: close }} />
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
          <HeritageDetail embedded={{ id: pid, onClose: close }} />
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

  if (current === "custom-view" && pid) {
    return <CustomViewPanel id={pid} onClose={close} />;
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
          <BoardPostDetail embedded={{ id: pid, onClose: close }} />
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
