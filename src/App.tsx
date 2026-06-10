import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ClanLayout } from "@/components/ClanLayout";
import { ConfirmDialogProvider } from "@/components/ConfirmDialog";
import { FeedbackButton } from "@/components/FeedbackButton";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { RequireAuth } from "@/components/RequireAuth";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ToastProvider } from "@/components/Toast";
import { UpdateBanner } from "@/components/UpdateBanner";
import Account from "@/pages/Account";
import Admin from "@/pages/Admin";
import Clans from "@/pages/Clans";
import Docs from "@/pages/Docs";
import AddChild from "@/pages/clan/AddChild";
import AddParent from "@/pages/clan/AddParent";
import AddSpouse from "@/pages/clan/AddSpouse";
import AiGenerate from "@/pages/clan/AiGenerate";
import Audit from "@/pages/clan/Audit";
import ContributionDetail from "@/pages/clan/ContributionDetail";
import Contributions from "@/pages/clan/Contributions";
import Dashboard from "@/pages/clan/Dashboard";
import EditPerson from "@/pages/clan/EditPerson";
import Events from "@/pages/clan/Events";
import Import from "@/pages/clan/Import";
import Inlaws from "@/pages/clan/Inlaws";
import InlawsNew from "@/pages/clan/InlawsNew";
import Kinship from "@/pages/clan/Kinship";
import Members from "@/pages/clan/Members";
import Merge from "@/pages/clan/Merge";
import MyLineage from "@/pages/clan/MyLineage";
import NewPerson from "@/pages/clan/NewPerson";
import People from "@/pages/clan/People";
import PersonDetail from "@/pages/clan/PersonDetail";
import QrExport from "@/pages/clan/QrExport";
import Settings from "@/pages/clan/Settings";
import Today from "@/pages/clan/Today";
import Todo from "@/pages/clan/Todo";
import Tree from "@/pages/clan/Tree";
import InlawsConfirm from "@/pages/InlawsConfirm";
import Login from "@/pages/Login";
import NewClan from "@/pages/NewClan";
import Share from "@/pages/Share";
import Signup from "@/pages/Signup";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
      <ConfirmDialogProvider>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/share/:token" element={<Share />} />
        <Route path="/inlaws/confirm/:token" element={<InlawsConfirm />} />

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
          <Route path="events" element={<Events />} />
          <Route path="settings" element={<Settings />} />
          <Route path="import" element={<Import />} />
          <Route path="ai-generate" element={<AiGenerate />} />
          <Route path="merge" element={<Merge />} />
          <Route path="audit" element={<Audit />} />
          <Route path="qr-export" element={<QrExport />} />
          <Route path="my-lineage" element={<MyLineage />} />
          <Route path="today" element={<Today />} />
          <Route path="todo" element={<Todo />} />
          <Route path="kinship" element={<Kinship />} />
          <Route path="contributions" element={<Contributions />} />
          <Route path="contributions/:contribId" element={<ContributionDetail />} />
          <Route path="inlaws" element={<Inlaws />} />
          <Route path="inlaws/new" element={<InlawsNew />} />
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

        <Route path="/" element={<Navigate to="/clans" replace />} />
        <Route path="*" element={<Navigate to="/clans" replace />} />
        </Routes>
        <OfflineIndicator />
        <FeedbackButton />
        <UpdateBanner />
      </ConfirmDialogProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
