import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userId || !password) {
      setMessage("Please enter both User ID and Password");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ UserID: userId, Password: password }),
      });

      const data = await response.json();

      if (data.status === "success") {
        const deptId = data.departmentId || data.departmentID;
        
        // Store ALL user information in localStorage
        localStorage.setItem("userId", data.userId); // THIS WAS MISSING!
        localStorage.setItem("userName", data.userName || "");
        localStorage.setItem("departmentId", deptId);
        localStorage.setItem("departmentName", data.departmentName || "");
        
        // Keep the sessionStorage for compatibility
        sessionStorage.setItem("departmentName", data.departmentName || "");

        console.log("Login successful - stored userId:", data.userId); // Debug log

        setMessage("Login successful");
        setMessageType("success");
        setLoading(false);

        if (deptId === 34 || deptId === "34") {
          navigate("/quality");
        } else {
          navigate(`/departments/${deptId}`);
        }
      } else {
        setMessage(data.message || "Invalid credentials");
        setMessageType("error");
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setMessage("Error connecting to server");
      setMessageType("error");
      setLoading(false);
    }
  };

  return (
    <>
      {/* Full-width top header */}
      <header className="top-header">
        <img src="alnas-hospital.png" alt="Hospital Logo" />
        <h1>Incident Report</h1>
      </header>

      {/* Centered login box */}
      <div className="login-container">
        <main>
          <h2>Login</h2>
          <form onSubmit={handleSubmit}>
            <label>User ID</label>
            <input
              type="text"
              name="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />

            <label>Password</label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {message && <p className={messageType}>{message}</p>}
        </main>
      </div>
    </>
  );
}