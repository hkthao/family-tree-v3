import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "@/components/RequireAuth";
import Clans from "@/pages/Clans";
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

        <Route path="/" element={<Navigate to="/clans" replace />} />
        <Route path="*" element={<Navigate to="/clans" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
