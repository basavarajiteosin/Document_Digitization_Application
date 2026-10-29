import React, { Suspense, lazy } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import Spinner from "./shared/Spinner";
import AllMasters from "./components/AllMasters/AllMasters";
import Error from "./components/404Error/Error";

import FolderCreation from "./components/FoldersCreation/FolderCreation";
import ExternalUserAccess from "./components/ExternalUser/ExternalAccess";
import StorageLimitForUser from "./components/FileSizeMapping/storagelimit";
import AllUsersFilesAndFolders from "./components/AllFiles/allfilesandfolers";
import Reports from "./components/Reports/reports";
import FolderAccessReport from "./components/Reports/FolderAccessReport";
const ManageRoles = lazy(() => import("./components/manage-roles/ManageRoles"));
const UserCreation = lazy(() => import("./components/user-creation/UserCreation"));
const ResetPassword = lazy(() => import("./components/ResetPassword/resetpassword"));
const EmailConfiguration = lazy(() => import("./components/EmailConfig/emailconfig"));


const Login = lazy(() => import("./components/login/Login"));
const ForgotPassword = lazy(() =>
  import("./components/ForgotPassword/forgotpassword")
);
const ProtectedRoute = lazy(() => import('./protectedRoute/ProtectedRoute'));
const PublicRoute = lazy(() => import('./protectedRoute/PublicRoute')); // Adjust path as needed

const AppRoutes = () => {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* ---------- PUBLIC ROUTES (no auth required) ---------- */}
        {/* ---------- ROOT REDIRECT ---------- */}
        <Route exact path="/" element={<Navigate to="/login" replace />} />

        {/* ---------- PUBLIC ROUTES (Accessible ONLY if NOT logged in) ---------- */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/externalAccess" element={<ExternalUserAccess />} />
        {/* ---------- PROTECTED ROUTES (require a valid session) ----------
            ProtectedRoute is a layout route: it renders <Outlet /> only when
            isUserAuthenticated === "true" and the persisted redux store
            (which holds the token) exists, otherwise it redirects to /login. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<FolderCreation />} />
          <Route path="/manage-roles" element={<ManageRoles />} />
          <Route path="/create-user" element={<UserCreation />} />
          <Route path="/email-config" element={<EmailConfiguration />} />
          <Route path="/all-masters" element={<AllMasters />} />
          <Route path="/storage-settings" element={<StorageLimitForUser />} />
          <Route path="/all-files" element={<AllUsersFilesAndFolders />} />
          <Route path="/folder-access-report" element={<FolderAccessReport />} />
          <Route path="/reports" element={<Reports />} />
        </Route>

        <Route path="/404" element={<Error />} />
        <Route path="*" element={<Navigate to="/404" />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;