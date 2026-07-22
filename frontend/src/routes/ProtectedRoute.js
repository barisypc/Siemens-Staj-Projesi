import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../services/auth";
import { ROUTES } from "../routes";

function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to={ROUTES.AUTH} replace state={{ message: "Session expired. Please enter your credentials again." }}/>;
  }

  return children;
}

export default ProtectedRoute;