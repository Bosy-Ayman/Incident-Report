import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import IncidentForm from "./pages/IncidentForm";
import Quality from "./pages/Quality";
import Departments from "./pages/Departments";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/incident-form" element={<IncidentForm />} />
        <Route path="/quality" element={<Quality />} />
        <Route path="/dashboard" element={<Dashboard/>} />
        <Route path="/departments/:departmentId" element={<Departments />} />
       </Routes>
    </Router>
  );
}

export default App;
