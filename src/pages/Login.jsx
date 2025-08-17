import React, { Component } from "react";
import "./Login.css";

export default class Login extends Component {
  constructor(props) {
    super(props);
    this.state = {
      userId: "",
      password: "",
      message: "",
      messageType: "",
      loading: false
    };
  }

  handleChange = (e) => {
    this.setState({ [e.target.name]: e.target.value });
  };

  handleSubmit = async (e) => {
    e.preventDefault();
    const { userId, password } = this.state;

    if (!userId || !password) {
      this.setState({
        message: "Please enter both User ID and Password",
        messageType: "error"
      });
      return;
    }

    this.setState({ loading: true, message: "", messageType: "" });

    try {
      // Use correct variable names
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ UserID: userId, Password: password })
      });

      const data = await response.json();

      if (data.status === "success") {
        // Save department info
        localStorage.setItem("departmentId", data.departmentId || data.departmentID);
        sessionStorage.setItem("departmentName", data.department);

        this.setState({
          message: "Login successful",
          messageType: "success",
          loading: false
        });

        // Redirect to departments page
        setTimeout(() => {
          window.location.href = "/departments";
        }, 500);
      } else {
        this.setState({
          message: data.message || "Invalid credentials",
          messageType: "error",
          loading: false
        });
      }
    } catch (error) {
      this.setState({
        message: "Error connecting to server",
        messageType: "error",
        loading: false
      });
      console.error(error);
    }
  };

  render() {
    const { userId, password, message, messageType, loading } = this.state;

    return (
      <div className="login-page">
        <header className="login-header">
          <img src="alnas-hospital.png" alt="Hospital Logo" />
          <h1>Incident Report</h1>
        </header>

        <main className="login-container">
          <h2>Login</h2>

          <form className="login-form" onSubmit={this.handleSubmit}>
            <label htmlFor="user-id">User ID</label>
            <input
              type="text"
              id="user-id"
              name="userId"
              placeholder="Enter your user ID"
              value={userId}
              onChange={this.handleChange}
              required
            />

            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="Enter your password"
              value={password}
              onChange={this.handleChange}
              required
            />

            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {message && (
            <p className={`login-message ${messageType}`}>
              {message}
            </p>
          )}
        </main>
      </div>
    );
  }
}
