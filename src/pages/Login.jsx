import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // Clear cache and check existing session on component mount
  useEffect(() => {
    clearAllClientData();
    checkExistingSession();
  }, [navigate]);

  const clearAllClientData = () => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    document.cookie = "sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  };

  const checkExistingSession = async () => {
    try {
      const response = await fetch('/validate-session', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          const deptId = data.user.departmentId;
          redirectToDepartment(deptId);
        }
      }
    } catch (error) {
      console.log('No valid session found');
    }
  };

  const redirectToDepartment = (deptId) => {
    if (deptId === 34 || deptId === "34") {
      navigate("/quality", { replace: true });
    } else if (deptId === 39 || deptId === "39") {
      navigate("/it-department", { replace: true });
    } else {
      navigate(`/departments/${deptId}`, { replace: true });
    }
  };

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch("/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ UserID: userId, Password: password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = "Login failed";
        if (response.status === 431) {
          clearAllClientData();
          errorMessage = "Request headers too large. Cookies cleared, please try again.";
        } else {
          try {
            const errorData = await response.text();
            const jsonError = JSON.parse(errorData);
            errorMessage = jsonError.message || errorMessage;
          } catch {
            errorMessage = `Server error (${response.status})`;
          }
        }
        setMessage(errorMessage);
        setMessageType("error");
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.status === "success") {
        const deptId = data.departmentId || data.departmentID;

        localStorage.setItem("userId", data.userId);
        localStorage.setItem("userName", data.userName || "");
        localStorage.setItem("departmentId", deptId);
        localStorage.setItem("departmentName", data.departmentName || "");
        localStorage.setItem("loginTime", new Date().getTime().toString());

        sessionStorage.setItem("departmentName", data.departmentName || "");

        console.log("Login successful - stored userId:", data.userId);

        setMessage("Login successful");
        setMessageType("success");

        setTimeout(() => {
          setLoading(false);
          redirectToDepartment(deptId);
        }, 1000);

      } else {
        setMessage(data.message || "Invalid credentials");
        setMessageType("error");
        setLoading(false);
      }

    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = "Error connecting to server";
      
      if (error.name === 'AbortError') {
        errorMessage = "Request timed out. Please try again.";
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = "Unable to connect to server. Please check your connection.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage(errorMessage);
      setMessageType("error");
      setLoading(false);
    }
  };
  if (loading) {
    return (
      <div 
        className="protected-container" 
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      >
        <div className="loader" style={{ width: '50px', height: '50px' }}></div>
      </div>
    );
  }

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
              disabled={loading}
              autoComplete="username"
            />

            <label>Password</label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
              
            </button>
          </form>

          {message && (
            <p className={`message ${messageType}`}>
              {message}
            </p>
          )}
        </main>
      </div>
    </>
  );
}