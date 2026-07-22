import React, { useState } from "react";
import "./Dashboard.css";
import { useNavigate, useParams } from "react-router-dom";

function UrlPassword() {
  const { shortCode } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/api/protected/${shortCode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Password verification failed");
      }

      window.location.href = data.original_url;
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: "400px", margin: "80px auto", textAlign: "center" }}>
        <h2>Protected URL</h2>
        <p>Enter the password to access this link.</p>

        <form onSubmit={login}>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginTop: "12px",
              marginBottom: "12px",
              borderRadius: "8px",
              border: "1px solid #ccc",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            {loading ? "Checking..." : "Unlock URL"}
          </button>
        </form>

        {error && (
          <p style={{ color: "red", marginTop: "12px" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => navigate("/")}
          style={{
            marginTop: "16px",
            background: "transparent",
            border: "none",
            color: "#007bff",
            cursor: "pointer",
          }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

export default UrlPassword;