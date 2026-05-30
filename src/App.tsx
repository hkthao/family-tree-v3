import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ClanLayout } from "@/components/ClanLayout";
import { RequireAuth } from "@/components/RequireAuth";
import Account from "@/pages/Account";
import Clans from "@/pages/Clans";
import AddChild from "@/pages/clan/AddChild";
import AddSpouse from "@/pages/clan/AddSpouse";
import EditPerson from "@/pages/clan/EditPerson";
import Events from "@/pages/clan/Events";
import NewPerson from "@/pages/clan/NewPerson";
import People from "@/pages/clan/People";
import PersonDetail from "@/pages/clan/PersonDetail";
import Settings from "@/pages/clan/Settings";
import Tree from "@/pages/clan/Tree";
import Login from "@/pages/Login";
import NewClan from "@/pages/NewClan";
import Signup from "@/pages/Signup";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

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
          path="/clans/:clanId/people/new"
          element={
            <RequireAuth>
              <NewPerson />
            </RequireAuth>
          }
        />
        <Route
          path="/clans/:clanId/people/:personId"
          element={
            <RequireAuth>
              <PersonDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/clans/:clanId/people/:personId/edit"
          element={
            <RequireAuth>
              <EditPerson />
            </RequireAuth>
          }
        />
        <Route
          path="/clans/:clanId/people/:personId/add-spouse"
          element={
            <RequireAuth>
              <AddSpouse />
            </RequireAuth>
          }
        />
        <Route
          path="/clans/:clanId/people/:personId/add-child"
          element={
            <RequireAuth>
              <AddChild />
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
          <Route index element={<Navigate to="people" replace />} />
          <Route path="people" element={<People />} />
          <Route path="tree" element={<Tree />} />
          <Route path="events" element={<Events />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route
          path="/account"
          element={
            <RequireAuth>
              <Account />
            </RequireAuth>
          }
        />

        <Route path="/" element={<Navigate to="/clans" replace />} />
        <Route path="*" element={<Navigate to="/clans" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
