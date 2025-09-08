import React, { useState, useMemo } from "react";
import { Navigate, useParams, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const { departmentId } = useParams();
  const location = useLocation();

  // Public routes that don't require authentication
  const publicRoutes = useMemo(() => new Set([
    "/incident-form",
    "/login"
  ]), []);
  
  // Public path prefixes that don't require authentication
  const publicPrefixes = [
    "/uploads/",
    "/public/uploads/",
    "/static/",
    "/assets/"
  ];

  const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();

  // Read authentication data from localStorage
  const storedUserId = localStorage.getItem("userId");
  const storedDeptId = localStorage.getItem("departmentId");
  const loginTime = localStorage.getItem("loginTime");

  let initialAuth = false;
  let initialDeptId = null;

  if (storedUserId && loginTime && now - parseInt(loginTime) <= sessionTimeout) {
    initialAuth = true;
    initialDeptId = parseInt(storedDeptId);
  } else {
    // Clear expired session data
    localStorage.clear();
    sessionStorage.clear();
  }

  const [isAuthenticated] = useState(initialAuth);
  const [userDepartmentId] = useState(initialDeptId);

  const path = location.pathname;
  
  // Check if current path is public
  const isPublicRoute = 
    publicRoutes.has(path) || 
    publicPrefixes.some((prefix) => path.startsWith(prefix));

  // Allow access to public routes without authentication
  if (isPublicRoute) {
    return children;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check department access for authenticated users
  if (departmentId && userDepartmentId && parseInt(departmentId) !== userDepartmentId) {
    return <Navigate to={`/departments/${userDepartmentId}`} replace />;
  }

  return children;
}