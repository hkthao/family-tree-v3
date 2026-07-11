import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ClanLayout } from "@/components/ClanLayout";
import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import { CriticalBanner } from "@/components/CriticalBanner";
import { MascotTip } from "@/components/MascotTip";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { RequireAuth } from "@/components/RequireAuth";
import { ScrollManager } from "@/components/ScrollManager";
import { ToastProvider } from "@/components/Toast";
import { UpdateBanner } from "@/components/UpdateBanner";
import Account from "@/pages/Account";
import Admin from "@/pages/Admin";
import AnnouncementDetail from "@/pages/AnnouncementDetail";
import Announcements from "@/pages/Announcements";
import Changelog from "@/pages/Changelog";
import Videos from "@/pages/Videos";
import Clans from "@/pages/Clans";
import Customs from "@/pages/Customs";
import CustomsDetail from "@/pages/CustomsDetail";
import CustomsForm from "@/pages/CustomsForm";
import CustomsImport from "@/pages/CustomsImport";
import Docs from "@/pages/Docs";
import AddChild from "@/pages/clan/AddChild";
import AddParent from "@/pages/clan/AddParent";
import AddSpouse from "@/pages/clan/AddSpouse";
import AiGenerate from "@/pages/clan/AiGenerate";
import Audit from "@/pages/clan/Audit";
import Board from "@/pages/clan/Board";
import BoardModeration from "@/pages/clan/BoardModeration";
import BoardPostDetail from "@/pages/clan/BoardPostDetail";
import BoardPostEdit from "@/pages/clan/BoardPostEdit";
import BoardPostNew from "@/pages/clan/BoardPostNew";
import ContributionDetail from "@/pages/clan/ContributionDetail";
import Contributions from "@/pages/clan/Contributions";
import Dashboard from "@/pages/clan/Dashboard";
import EditPerson from "@/pages/clan/EditPerson";
import Events from "@/pages/clan/Events";
import Heritage from "@/pages/clan/Heritage";
import ClanFund from "@/pages/clan/ClanFund";
import HonorBook from "@/pages/clan/HonorBook";
import HeritageDetail from "@/pages/clan/HeritageDetail";
import HeritageForm from "@/pages/clan/HeritageForm";
import Import from "@/pages/clan/Import";
import Inlaws from "@/pages/clan/Inlaws";
import InlawsNew from "@/pages/clan/InlawsNew";
import Kinship from "@/pages/clan/Kinship";
import Members from "@/pages/clan/Members";
import MemoryRoom from "@/pages/clan/MemoryRoom";
import MemoryRooms from "@/pages/clan/MemoryRooms";
import Merge from "@/pages/clan/Merge";
import RestingPlaces from "@/pages/clan/RestingPlaces";
import RestingPlaceDetail from "@/pages/clan/RestingPlaceDetail";
import RestingPlaceForm from "@/pages/clan/RestingPlaceForm";
import Cemeteries from "@/pages/clan/Cemeteries";
import MyLineage from "@/pages/clan/MyLineage";
import NewPerson from "@/pages/clan/NewPerson";
import People from "@/pages/clan/People";
import PersonDetail from "@/pages/clan/PersonDetail";
import QrExport from "@/pages/clan/QrExport";
import Settings from "@/pages/clan/Settings";
import Today from "@/pages/clan/Today";
import Todo from "@/pages/clan/Todo";
import Tools from "@/pages/clan/Tools";
import Tree from "@/pages/clan/Tree";
import Contact from "@/pages/Contact";
import InlawsConfirm from "@/pages/InlawsConfirm";
import Login from "@/pages/Login";
import NewClan from "@/pages/NewClan";
import Share from "@/pages/Share";
import KhoeCard from "@/pages/KhoeCard";
import JoinClan from "@/pages/JoinClan";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <ToastProvider>
      <ConfirmDialogProvider>
        <CriticalBanner />
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/share/:token" element={<Share />} />
        {/* Xem trước CÔNG KHAI dòng họ (không cần đăng nhập) — RequireAuth đưa
            khách chưa đăng nhập từ /clans/:id sang đây. */}
        <Route path="/xem/clans/:clanId" element={<Share />} />
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
          <Route path="memory-room" element={<MemoryRooms />} />
          <Route path="memory-room/:roomId" element={<MemoryRoom />} />
          <Route path="graves" element={<RestingPlaces />} />
          <Route path="graves/cemeteries" element={<Cemeteries />} />
          <Route path="graves/new" element={<RestingPlaceForm />} />
          <Route path="graves/:graveId" element={<RestingPlaceDetail />} />
          <Route path="graves/:graveId/edit" element={<RestingPlaceForm />} />
          <Route path="events" element={<Events />} />
          <Route path="honor" element={<HonorBook />} />
          <Route path="fund" element={<ClanFund />} />
          <Route path="heritage" element={<Heritage />} />
          <Route path="heritage/new" element={<HeritageForm />} />
          <Route path="heritage/:itemId" element={<HeritageDetail />} />
          <Route path="heritage/:itemId/edit" element={<HeritageForm />} />
          <Route path="settings" element={<Settings />} />
          <Route path="import" element={<Import />} />
          <Route path="ai-generate" element={<AiGenerate />} />
          <Route path="merge" element={<Merge />} />
          <Route path="audit" element={<Audit />} />
          <Route path="qr-export" element={<QrExport />} />
          <Route path="my-lineage" element={<MyLineage />} />
          <Route path="today" element={<Today />} />
          <Route path="todo" element={<Todo />} />
          <Route path="tools" element={<Tools />} />
          <Route path="kinship" element={<Kinship />} />
          <Route path="contributions" element={<Contributions />} />
          <Route path="contributions/:contribId" element={<ContributionDetail />} />
          <Route path="inlaws" element={<Inlaws />} />
          <Route path="inlaws/new" element={<InlawsNew />} />
          <Route path="board" element={<Board />} />
          <Route path="board/new" element={<BoardPostNew />} />
          <Route path="board/moderation" element={<BoardModeration />} />
          <Route path="board/:postId" element={<BoardPostDetail />} />
          <Route path="board/:postId/edit" element={<BoardPostEdit />} />
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
        <OfflineIndicator />
        <MascotTip />
        <UpdateBanner />
      </ConfirmDialogProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
