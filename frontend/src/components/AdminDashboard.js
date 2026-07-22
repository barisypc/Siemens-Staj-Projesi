import React, { useEffect, useState } from "react";
import { getAuthHeaders, logout, isTokenExpired } from "../services/auth";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    if (isTokenExpired()) {
      logout();
      navigate("/auth");
      return;
    }

    loadAdminData();
  }, []);

  async function loadAdminData() {
    try {
      setLoading(true);
      setError("");

      const statsResponse = await fetch("http://localhost:8000/api/admin/dashboard", {
        headers: getAuthHeaders(),
      });

      const usersResponse = await fetch("http://localhost:8000/api/admin/users", {
        headers: getAuthHeaders(),
      });

      const statsData = await statsResponse.json();
      const usersData = await usersResponse.json();

      if (!statsResponse.ok) {
        throw new Error(statsData.detail || "Failed to load dashboard stats");
      }

      if (!usersResponse.ok) {
        throw new Error(usersData.detail || "Failed to load users");
      }

      setStats(statsData);
      setUsers(usersData);
    } catch (err) {
      setError(err.message || "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function toggleUserBan(userId, currentStatus) {
    const action = currentStatus ? "ban" : "unban";
    const confirmed = window.confirm(`Are you sure you want to ${action} this user?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`http://localhost:8000/api/admin/ban-user/${userId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update user status");
      }

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, is_active: !currentStatus } : user
        )
      );

      // Banning cascades to the user's URLs on the backend, so refresh
      // stats too (active/inactive URL counts will have shifted).
      await loadAdminData();
    } catch (err) {
      setError(err.message || "Failed to update user status");
    }
  }

  if (loading) {
    return <div className="dashboard-page">Loading admin dashboard...</div>;
  }

  return (
    <div className="dashboard-page">
      <h1>Admin Dashboard</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div className="card"><h3>Total Users</h3><p>{stats.total_users}</p></div>
          <div className="card"><h3>Active Users</h3><p>{stats.active_users}</p></div>
          <div className="card"><h3>Banned Users</h3><p>{stats.banned_users}</p></div>
          <div className="card"><h3>Total URLs</h3><p>{stats.total_urls}</p></div>
          <div className="card"><h3>Active URLs</h3><p>{stats.active_urls}</p></div>
          <div className="card"><h3>Inactive URLs</h3><p>{stats.inactive_urls}</p></div>
          <div className="card"><h3>Protected URLs</h3><p>{stats.protected_urls}</p></div>
          <div className="card"><h3>Total Clicks</h3><p>{stats.total_clicks}</p></div>
        </div>
      )}

      <h2>Users</h2>

      <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#fff" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Status</th>
            <th>Admin</th>
            <th>URL Count</th>
            <th>Total Clicks</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.email}</td>
              <td>{user.is_active ? "Active" : "Banned"}</td>
              <td>{user.is_admin ? "Yes" : "No"}</td>
              <td>{user.url_count}</td>
              <td>{user.total_clicks}</td>
              <td>
                {!user.is_admin && (
                  <button onClick={() => toggleUserBan(user.id, user.is_active)}>
                    {user.is_active ? "Ban" : "Unban"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminDashboard;