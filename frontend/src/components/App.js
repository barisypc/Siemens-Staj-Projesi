import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./AuthPage";
import Dashboard from "./Dashboard";
import { ROUTES } from "../routes";
import ProtectedRoute from "../routes/ProtectedRoute";
import PublicRoute from "../routes/PublicRoute";
import UrlPassword from "./UrlPassword"
import AdminDashboard from "./AdminDashboard";

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

      <Route path="*" element={<Navigate to={ROUTES.AUTH} replace />} />
      <Route path="/protected/:shortCode" element={<UrlPassword />} />
      <Route path="/admin" element={<AdminDashboard />} />
    </Routes>
  );
}

export default App;