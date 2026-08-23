import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ClanLayout } from "@/components/ClanLayout";
import { FeatureGuard } from "@/components/FeatureGuard";
import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import { CriticalBanner } from "@/components/CriticalBanner";
import { MascotTip } from "@/components/MascotTip";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { RequireAuth } from "@/components/RequireAuth";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { DocumentTitle } from "@/components/DocumentTitle";
import { ScrollManager } from "@/components/ScrollManager";
import { ToastProvider } from "@/components/Toast";
import { UpdateBanner } from "@/components/UpdateBanner";

// Mọi TRANG được tách chunk riêng (React.lazy) → bundle đầu chỉ tải khung app +
// trang đang vào, không gánh code của cả 65 trang. Giảm mạnh thời gian tải lần
// đầu, nhất là trên mobile (~67% người dùng) & trình duyệt trong Facebook.
const Account = lazy(() => import("@/pages/Account"));
const Admin = lazy(() => import("@/pages/Admin"));
const AnnouncementDetail = lazy(() => import("@/pages/AnnouncementDetail"));
const Announcements = lazy(() => import("@/pages/Announcements"));
const Changelog = lazy(() => import("@/pages/Changelog"));
const Videos = lazy(() => import("@/pages/Videos"));
const Clans = lazy(() => import("@/pages/Clans"));
const Customs = lazy(() => import("@/pages/Customs"));
const DemoRedirect = lazy(() => import("@/pages/DemoRedirect"));
const CustomsDetail = lazy(() => import("@/pages/CustomsDetail"));
const CustomsForm = lazy(() => import("@/pages/CustomsForm"));
const CustomsImport = lazy(() => import("@/pages/CustomsImport"));
const Docs = lazy(() => import("@/pages/Docs"));
const AddChild = lazy(() => import("@/pages/clan/AddChild"));
const AddParent = lazy(() => import("@/pages/clan/AddParent"));
const AddSpouse = lazy(() => import("@/pages/clan/AddSpouse"));
const AiChat = lazy(() => import("@/pages/clan/AiChat"));
const AiGenerate = lazy(() => import("@/pages/clan/AiGenerate"));
const Audit = lazy(() => import("@/pages/clan/Audit"));
const Board = lazy(() => import("@/pages/clan/Board"));
const BoardModeration = lazy(() => import("@/pages/clan/BoardModeration"));
const BoardPostDetail = lazy(() => import("@/pages/clan/BoardPostDetail"));
const BoardPostEdit = lazy(() => import("@/pages/clan/BoardPostEdit"));
const BoardPostNew = lazy(() => import("@/pages/clan/BoardPostNew"));
const ContributionDetail = lazy(() => import("@/pages/clan/ContributionDetail"));
const Contributions = lazy(() => import("@/pages/clan/Contributions"));
const Dashboard = lazy(() => import("@/pages/clan/Dashboard"));
const EditPerson = lazy(() => import("@/pages/clan/EditPerson"));
const Events = lazy(() => import("@/pages/clan/Events"));
const GoodDays = lazy(() => import("@/pages/clan/GoodDays"));
const Heritage = lazy(() => import("@/pages/clan/Heritage"));
const ClanFund = lazy(() => import("@/pages/clan/ClanFund"));
const HonorBook = lazy(() => import("@/pages/clan/HonorBook"));
const HeritageDetail = lazy(() => import("@/pages/clan/HeritageDetail"));
const HeritageForm = lazy(() => import("@/pages/clan/HeritageForm"));
const Import = lazy(() => import("@/pages/clan/Import"));
const Inlaws = lazy(() => import("@/pages/clan/Inlaws"));
const InlawsNew = lazy(() => import("@/pages/clan/InlawsNew"));
const Kinship = lazy(() => import("@/pages/clan/Kinship"));
const Members = lazy(() => import("@/pages/clan/Members"));
const MemoryRoom = lazy(() => import("@/pages/clan/MemoryRoom"));
const MemoryRooms = lazy(() => import("@/pages/clan/MemoryRooms"));
const Merge = lazy(() => import("@/pages/clan/Merge"));
const RestingPlaces = lazy(() => import("@/pages/clan/RestingPlaces"));
const RestingPlaceDetail = lazy(() => import("@/pages/clan/RestingPlaceDetail"));
const RestingPlaceForm = lazy(() => import("@/pages/clan/RestingPlaceForm"));
const Cemeteries = lazy(() => import("@/pages/clan/Cemeteries"));
const MyLineage = lazy(() => import("@/pages/clan/MyLineage"));
const NewPerson = lazy(() => import("@/pages/clan/NewPerson"));
const People = lazy(() => import("@/pages/clan/People"));
const PersonDetail = lazy(() => import("@/pages/clan/PersonDetail"));
const QrExport = lazy(() => import("@/pages/clan/QrExport"));
const Settings = lazy(() => import("@/pages/clan/Settings"));
const Today = lazy(() => import("@/pages/clan/Today"));
const Todo = lazy(() => import("@/pages/clan/Todo"));
const Tools = lazy(() => import("@/pages/clan/Tools"));
const Tree = lazy(() => import("@/pages/clan/Tree"));
const Contact = lazy(() => import("@/pages/Contact"));
const InlawsConfirm = lazy(() => import("@/pages/InlawsConfirm"));
const Login = lazy(() => import("@/pages/Login"));
const NewClan = lazy(() => import("@/pages/NewClan"));
const Share = lazy(() => import("@/pages/Share"));
const KhoeCard = lazy(() => import("@/pages/KhoeCard"));
const JoinClan = lazy(() => import("@/pages/JoinClan"));
const Signup = lazy(() => import("@/pages/Signup"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

/** Fallback nhẹ trong khi tải chunk trang (spinner giữa màn hình). */
function PageLoader() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
      role="status"
      aria-label="Đang tải…"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      {/* Thứ tự quan trọng: DocumentTitle đặt tiêu đề route trước, rồi
          AnalyticsTracker mới gửi pageview kèm tiêu đề đó. */}
      <DocumentTitle />
      <AnalyticsTracker />
      <ToastProvider>
      <ConfirmDialogProvider>
        <CriticalBanner />
        <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/share/:token" element={<Share />} />
        {/* Xem trước CÔNG KHAI dòng họ (không cần đăng nhập) — RequireAuth đưa
            khách chưa đăng nhập từ /clans/:id sang đây. */}
        <Route path="/xem/clans/:clanId" element={<Share />} />
        {/* Đích của nút "Xem thử" bên landing — tự phân giải dòng họ mẫu
            để trang tĩnh không phải hard-code UUID. */}
        <Route path="/xem/demo" element={<DemoRedirect />} />
        <Route path="/khoe/:token" element={<KhoeCard />} />
        <Route path="/join/:token" element={<JoinClan />} />
        <Route path="/lien-he" element={<Contact />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/inlaws/confirm/:token" element={<InlawsConfirm />} />
        {/* Sổ tay Văn hoá — route CÔNG KHAI cho link chia sẻ (không cần đăng nhập).
            Dùng chung component với route /so-tay/:entryId (required auth). */}
        <Route path="/xem/so-tay/:entryId" element={<CustomsDetail />} />
        <Route
          path="/announcements"
          element={
            <RequireAuth>
              <Announcements />
            </RequireAuth>
          }
        />
        <Route
          path="/announcements/:id"
          element={
            <RequireAuth>
              <AnnouncementDetail />
            </RequireAuth>
          }
        />

        <Route
          path="/so-tay"
          element={
            <RequireAuth>
              <Customs />
            </RequireAuth>
          }
        />
        <Route
          path="/so-tay/new"
          element={
            <RequireAuth>
              <CustomsForm />
            </RequireAuth>
          }
        />
        <Route
          path="/so-tay/import"
          element={
            <RequireAuth>
              <CustomsImport />
            </RequireAuth>
          }
        />
        <Route
          path="/so-tay/:entryId"
          element={
            <RequireAuth>
              <CustomsDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/so-tay/:entryId/edit"
          element={
            <RequireAuth>
              <CustomsForm />
            </RequireAuth>
          }
        />

        <Route
          path="/clans"
          element={
            <RequireAuth>
              <Clans />
            </RequireAuth>
          }
        />
        <Route
          path="/clans/new"
          element={
            <RequireAuth>
              <NewClan />
            </RequireAuth>
          }
        />

        <Route
          path="/clans/:clanId"
          element={
            <RequireAuth>
              <ClanLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="people" element={<People />} />
          <Route path="people/new" element={<NewPerson />} />
          <Route path="people/:personId" element={<PersonDetail />} />
          <Route path="people/:personId/edit" element={<EditPerson />} />
          <Route path="people/:personId/add-spouse" element={<AddSpouse />} />
          <Route path="people/:personId/add-child" element={<AddChild />} />
          <Route path="people/:personId/add-parent" element={<AddParent />} />
          <Route path="members" element={<Members />} />
          <Route path="tree" element={<Tree />} />
          <Route path="memory-room" element={<FeatureGuard feature="memory_room"><MemoryRooms /></FeatureGuard>} />
          <Route path="memory-room/:roomId" element={<FeatureGuard feature="memory_room"><MemoryRoom /></FeatureGuard>} />
          <Route path="graves" element={<FeatureGuard feature="graves"><RestingPlaces /></FeatureGuard>} />
          <Route path="graves/cemeteries" element={<FeatureGuard feature="graves"><Cemeteries /></FeatureGuard>} />
          <Route path="graves/new" element={<FeatureGuard feature="graves"><RestingPlaceForm /></FeatureGuard>} />
          <Route path="graves/:graveId" element={<FeatureGuard feature="graves"><RestingPlaceDetail /></FeatureGuard>} />
          <Route path="graves/:graveId/edit" element={<FeatureGuard feature="graves"><RestingPlaceForm /></FeatureGuard>} />
          <Route path="events" element={<Events />} />
          <Route path="honor" element={<FeatureGuard feature="honor"><HonorBook /></FeatureGuard>} />
          <Route path="fund" element={<FeatureGuard feature="fund"><ClanFund /></FeatureGuard>} />
          <Route path="heritage" element={<FeatureGuard feature="heritage"><Heritage /></FeatureGuard>} />
          <Route path="heritage/new" element={<FeatureGuard feature="heritage"><HeritageForm /></FeatureGuard>} />
          <Route path="heritage/:itemId" element={<FeatureGuard feature="heritage"><HeritageDetail /></FeatureGuard>} />
          <Route path="heritage/:itemId/edit" element={<FeatureGuard feature="heritage"><HeritageForm /></FeatureGuard>} />
          <Route path="settings" element={<Settings />} />
          <Route path="import" element={<Import />} />
          <Route path="ai-generate" element={<AiGenerate />} />
          <Route path="tro-ly" element={<FeatureGuard feature="ai_assistant"><AiChat /></FeatureGuard>} />
          <Route path="merge" element={<Merge />} />
          <Route path="audit" element={<Audit />} />
          <Route path="qr-export" element={<QrExport />} />
          <Route path="my-lineage" element={<MyLineage />} />
          <Route path="today" element={<Today />} />
          <Route path="xem-ngay" element={<GoodDays />} />
          <Route path="todo" element={<Todo />} />
          <Route path="tools" element={<Tools />} />
          <Route path="kinship" element={<Kinship />} />
          <Route path="contributions" element={<Contributions />} />
          <Route path="contributions/:contribId" element={<ContributionDetail />} />
          <Route path="inlaws" element={<FeatureGuard feature="inlaws"><Inlaws /></FeatureGuard>} />
          <Route path="inlaws/new" element={<FeatureGuard feature="inlaws"><InlawsNew /></FeatureGuard>} />
          <Route path="board" element={<FeatureGuard feature="board"><Board /></FeatureGuard>} />
          <Route path="board/new" element={<FeatureGuard feature="board"><BoardPostNew /></FeatureGuard>} />
          <Route path="board/moderation" element={<FeatureGuard feature="board"><BoardModeration /></FeatureGuard>} />
          <Route path="board/:postId" element={<FeatureGuard feature="board"><BoardPostDetail /></FeatureGuard>} />
          <Route path="board/:postId/edit" element={<FeatureGuard feature="board"><BoardPostEdit /></FeatureGuard>} />
        </Route>

        <Route
          path="/account"
          element={
            <RequireAuth>
              <Account />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <Admin />
            </RequireAuth>
          }
        />
        {/* Khu Cài đặt của quản trị — cùng component, khác dải tab.
            Tách URL để chia sẻ được và Back hoạt động đúng. */}
        <Route
          path="/admin/cai-dat"
          element={
            <RequireAuth>
              <Admin />
            </RequireAuth>
          }
        />
        <Route
          path="/docs"
          element={
            <RequireAuth>
              <Docs />
            </RequireAuth>
          }
        />
        <Route
          path="/docs/:slug"
          element={
            <RequireAuth>
              <Docs />
            </RequireAuth>
          }
        />
        <Route
          path="/huong-dan-video"
          element={
            <RequireAuth>
              <Videos />
            </RequireAuth>
          }
        />

        <Route path="/" element={<Navigate to="/clans" replace />} />
        <Route path="*" element={<Navigate to="/clans" replace />} />
        </Routes>
        </Suspense>
        <OfflineIndicator />
        <MascotTip />
        <UpdateBanner />
      </ConfirmDialogProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
