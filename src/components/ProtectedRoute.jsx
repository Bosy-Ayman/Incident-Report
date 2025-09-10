import React, { useState, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const location = useLocation();

  // Public routes that don't require authentication
  const publicRoutes = useMemo(
    () =>
      new Set([
        "/incident-form",
        "/login"
      ]),
    []
  );

  // Public path prefixes that don't require authentication
  const publicPrefixes = [
    "/uploads/",
    "/public/uploads/",
    "/static/",
    "/assets/"
  ];

  const sessionTimeout = 24*60*60*1000; // 24 hours
  const now = Date.now();
  // Read authentication data from localStorage
  const storedUserId = localStorage.getItem("userId");
  const loginTime = localStorage.getItem("loginTime");

  let initialAuth = false;

  if (storedUserId && loginTime && now - parseInt(loginTime) <= sessionTimeout) {
    initialAuth = true;
  } else {
    // Clear expired session data
    localStorage.clear();
    sessionStorage.clear();
  }

  const [isAuthenticated] = useState(initialAuth);

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
  
  // Once authenticated → grant full access
  return children;
}
