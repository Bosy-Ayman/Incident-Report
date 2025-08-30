import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import IncidentForm from "./pages/IncidentForm";
import Quality from "./pages/Quality";
import Departments from "./pages/Departments";
import Dashboard from "./pages/Dashboard";
import Header from "./components/Header";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
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
            <ProtectedRoute>
              <Header />
              <Quality />
            </ProtectedRoute>
          }
        />
        <Route
          path="/departments/:departmentId"
          element={
            <ProtectedRoute>
              <Header />
              <Departments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Header />
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
