import React from "react";
import { Navigate, useParams } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const departmentIdStored = localStorage.getItem("departmentId"); // logged-in dept
  const { departmentId } = useParams(); // requested dept from URL

  // Not logged in → go to login
  if (!departmentIdStored) {
    return <Navigate to="/login" replace />;
  }

  // Trying to access a different department → redirect to the allowed one
  if (departmentId && departmentId !== departmentIdStored) {
    return <Navigate to={`/departments/${departmentIdStored}`} replace />;
  }

  // Otherwise, allow access
  return children;
}
