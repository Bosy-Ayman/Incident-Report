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
    if (location.pathname === "/quality" || queryName) return;

    if (departmentId && location.pathname !== "/quality") {
      fetch(`/department-info/${departmentId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          console.log("Department info response:", data); 
          if (data.status === "success" && data.data) {
            setDepartmentName(data.data.DepartmentName);
          }
        })
        .catch((err) => {
          console.error("Error fetching department:", err);
          setDepartmentName("");
        });
    }
  }, [departmentId, location.pathname, queryName]);

  let displayName;
  if (location.pathname === "/quality" || queryName === "Quality") {
    displayName = "Quality";
  } else if (queryName && queryName !== "Quality") {
    displayName = queryName;
  } else if (departmentName) {
    displayName = departmentName;
  } else if (departmentId) {
    displayName = `Department ${departmentId}`;
  } else{
    displayName = "Hospital";
  }

  const showQualityButtons = displayName === "Quality";
  const showITButtons = displayName === "Quality";

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