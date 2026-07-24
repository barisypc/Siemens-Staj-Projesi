import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./AuthPage";
import Dashboard from "./Dashboard";
import { ROUTES } from "../routes";
import ProtectedRoute from "../routes/ProtectedRoute";
import PublicRoute from "../routes/PublicRoute";
import AdminRoute from "../routes/AdminRoute.js";
import UrlPassword from "./UrlPassword"
import AdminDashboard from "./AdminDashboard";
import Report from "./Report.js";

function App() {
  return (
    <Routes>
      <Route
        path={ROUTES.HOME}
        element={<Navigate to={ROUTES.AUTH} replace />}
      />

      <Route
        path={ROUTES.AUTH}
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        }
      />

      <Route
        path={ROUTES.DASHBOARD}
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path={ROUTES.ADMIN}
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      <Route path={ROUTES.REPORT} element={<Report />} />
 
      <Route path="/protected/:shortCode" element={<UrlPassword />} />
      <Route path="*" element={<Navigate to={ROUTES.AUTH} replace />} />
    </Routes>
  );
}

export default App;