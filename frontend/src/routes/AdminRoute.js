import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getAuthHeaders } from "../services/auth";
import { ROUTES } from "../routes";

function AdminRoute({ children }) {
  // "checking" | "admin" | "not-admin"
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let isMounted = true;

    // ProtectedRoute (the parent) already guarantees a valid, non-expired
    // token by the time this renders — this only needs to check is_admin.
    async function checkAdmin() {
      try {
        const response = await fetch("http://localhost:8000/api/me", {
          method: "GET",
          headers: getAuthHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Failed to verify admin status");
        }

        if (isMounted) {
          setStatus(data.is_admin ? "admin" : "not-admin");
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setStatus("not-admin");
      }
    }

    checkAdmin();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "checking") {
    return <div className="dashboard-page">Checking admin access...</div>;
  }

  if (status === "not-admin") {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return children;
}

export default AdminRoute;