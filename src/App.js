import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import IncidentForm from "./pages/IncidentForm";
import Quality from "./pages/Quality";
import Departments from "./pages/Departments";
import Dashboard from "./pages/Dashboard";
import ITDepartment from "./pages/ITDepartment";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";
import AddUser from "./pages/AddUser";
import AddDepartment from "./pages/AddDepartment";

function App() {
  console.log("App: Rendering routes");
  
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected routes */}
        <Route
          path="/incident-form"
          element={
            <ProtectedRoute>
              <IncidentForm />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/quality"
          element={
            <ProtectedRoute requiredDepartment={34}>
              <>
                <Header />
                <Quality />
              </>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/departments/:departmentId"
          element={
            <ProtectedRoute>
              <>
                <Header />
                <Departments />
              </>
            </ProtectedRoute>
          }
        />
                
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <>
                <Header />
                <Dashboard />
              </>
            </ProtectedRoute>
          }
        />

        <Route
          path="/it-department"
          element={
            <ProtectedRoute requiredDepartment={39}>
              <>
                <Header />
                <ITDepartment />
              </>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/add-user"
          element={
            <ProtectedRoute>
              <>
                <Header />
                <AddUser />
              </>
            </ProtectedRoute>
          }
        />
        <Route
          path="/departments"
          element={
            <ProtectedRoute requiredDepartment={39}>
              <>
                <Header />
                <AddDepartment />
              </>
            </ProtectedRoute>
          }
        />

        {/* Default routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;