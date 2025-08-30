import React, { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import './Header.css';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function Header() {
  const params = useParams();
  const location = useLocation();
  const query = useQuery();

  // detect departmentId from params or query
  const departmentId = params.departmentId || query.get("departmentId");
  const queryName = query.get("name"); // <-- read name from query

  const [departmentName, setDepartmentName] = useState("");

  useEffect(() => {
    // ✅ Skip fetch if name is provided or on /quality page
    if (location.pathname === "/quality" || queryName) return;

    if (departmentId) {
      fetch(`/departments/${departmentId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "success" && data.data.length > 0) {
            setDepartmentName(data.data[0].DepartmentName);
          }
        })
        .catch((err) => console.error(err));
    }
  }, [departmentId, location.pathname, queryName]);

  // Use queryName first, then departmentName, then fallback
  let displayName;
  if (location.pathname === "/quality" || queryName === "Quality") {
    displayName = "Quality";
  } else if (departmentName) {
    displayName = departmentName;
  } else if (departmentId) {
    displayName = `Department ${departmentId}`;
  } else {
    displayName = "Hospital";
  }

  // Only show Table & Dashboard if Quality
  const showQualityButtons = displayName === "Quality";

  return (
    <div className="header-component">
      <header>
        <img src="/alnas-hospital.png" alt="Hospital Logo" />
        <h1>{displayName} Dashboard</h1>
        <nav className="Navbar">
          <ul>
            {showQualityButtons && (
              <>
                <li>
                  <Link to="/quality">Table</Link>
                </li>
                <li>
                  <Link to={`/dashboard?departmentId=34&name=Quality`}>Dashboard</Link>
                </li>
              </>
            )}
            <li>
              <Link to={`/login`}>➜]</Link>
            </li>
          </ul>
        </nav>
      </header>
    </div>
  );
}
