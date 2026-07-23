import React, { useEffect, useState } from "react";
import { getAuthHeaders, logout, isTokenExpired } from "../services/auth";
import { listAllAbuseReports, acceptAbuse, refuseAbuse } from "../services/Abuse";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes";
import "./Dashboard.css";
import "./AdminDashboard.css";

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userUrls, setUserUrls] = useState([]);
  const [urlsLoading, setUrlsLoading] = useState(false);
  const [urlsError, setUrlsError] = useState("");

  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteInFlight, setDeleteInFlight] = useState(false);

  // Abuse reports panel
  const [abuseReports, setAbuseReports] = useState([]);
  const [abuseLoading, setAbuseLoading] = useState(true);
  const [abuseError, setAbuseError] = useState("");
  const [abuseActionId, setAbuseActionId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (isTokenExpired()) {
      logout();
      navigate(ROUTES.AUTH);
      return;
    }

    loadAdminData();
    loadAbuseReports();
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

  async function loadAbuseReports() {
    try {
      setAbuseLoading(true);
      setAbuseError("");

      const data = await listAllAbuseReports();
      setAbuseReports(data);
    } catch (err) {
      setAbuseError(err.message || "Failed to load abuse reports");
      setAbuseReports([]);
    } finally {
      setAbuseLoading(false);
    }
  }

  async function fetchUserUrls(userId) {
    try {
      setUrlsLoading(true);
      setUrlsError("");

      const response = await fetch(`http://localhost:8000/api/admin/user-urls/${userId}`, {
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to load user's URLs");
      }

      setUserUrls(data);
    } catch (err) {
      setUrlsError(err.message || "Failed to load user's URLs");
      setUserUrls([]);
    } finally {
      setUrlsLoading(false);
    }
  }

  function selectUser(userId) {
    if (selectedUserId === userId) {
      // Clicking the same user again collapses the row and clears the panel.
      setSelectedUserId(null);
      setUserUrls([]);
      setUrlsError("");
      return;
    }

    setSelectedUserId(userId);
    fetchUserUrls(userId);
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

      // Banning cascades to the user's URLs on the backend, so refresh the
      // top stats, and if that user's URL list is open on the right, refresh it too.
      await loadAdminData();

      if (selectedUserId === userId) {
        await fetchUserUrls(userId);
      }
    } catch (err) {
      setError(err.message || "Failed to update user status");
    }
  }

  function requestDeleteUser(user) {
    setUserToDelete(user);
    setDeleteConfirmText("");
  }

  function cancelDeleteUser() {
    setUserToDelete(null);
    setDeleteConfirmText("");
  }

  async function confirmDeleteUser() {
    if (!userToDelete) return;

    const userId = userToDelete.id;

    try {
      setDeleteInFlight(true);

      const response = await fetch(`http://localhost:8000/api/admin/delete-user/${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to delete user");
      }

      setUsers((prev) => prev.filter((user) => user.id !== userId));

      if (selectedUserId === userId) {
        setSelectedUserId(null);
        setUserUrls([]);
        setUrlsError("");
      }

      await loadAdminData();

      // Deleting a user cascades to their URLs, which cascades to any abuse
      // reports filed against those URLs — so the list has to be reloaded.
      await loadAbuseReports();
    } catch (err) {
      setError(err.message || "Failed to delete user");
    } finally {
      setDeleteInFlight(false);
      setUserToDelete(null);
      setDeleteConfirmText("");
    }
  }

  async function handleAcceptAbuse(report) {
    const confirmed = window.confirm(
      `Accept report #${report.abuse_id}? This deactivates the short URL "${report.short_code}".`
    );
    if (!confirmed) return;

    try {
      setAbuseActionId(report.abuse_id);
      setAbuseError("");

      await acceptAbuse(report.abuse_id);

      // The backend deletes the report and flips the URL to inactive, so drop
      // the row locally and refresh everything that reflects URL status.
      setAbuseReports((prev) =>
        prev.filter((item) => item.abuse_id !== report.abuse_id)
      );

      await loadAdminData();

      if (selectedUserId !== null) {
        await fetchUserUrls(selectedUserId);
      }
    } catch (err) {
      setAbuseError(err.message || "Failed to accept the report");
    } finally {
      setAbuseActionId(null);
    }
  }

  async function handleRefuseAbuse(report) {
    const confirmed = window.confirm(
      `Refuse report #${report.abuse_id}? The report is discarded and the URL stays active.`
    );
    if (!confirmed) return;

    try {
      setAbuseActionId(report.abuse_id);
      setAbuseError("");

      await refuseAbuse(report.abuse_id);

      setAbuseReports((prev) =>
        prev.filter((item) => item.abuse_id !== report.abuse_id)
      );
    } catch (err) {
      setAbuseError(err.message || "Failed to refuse the report");
    } finally {
      setAbuseActionId(null);
    }
  }

  const selectedUser = users.find((user) => user.id === selectedUserId) || null;

  if (loading) {
    return <div className="dashboard-page">Loading admin dashboard...</div>;
  }

  return (
    <div className="dashboard-page">
      <div className="card admin-header-card">
        <div className="admin-header-top">
          <div className="admin-header-text">
            <h1 className="title">Admin Dashboard</h1>
            <p className="subtitle">Monitor activity, review reports and manage users.</p>
          </div>

          <button
            type="button"
            className="back-to-dashboard-button"
            onClick={() => navigate(ROUTES.DASHBOARD)}
          >
            ← Back to Dashboard
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>

      {/* Row 1 — platform stats on the left, abuse reports on the right */}
      <div className="dashboard-layout admin-row">
        <div className="card left-panel stats-panel">
          <h2 className="table-title">Overview</h2>

          {stats && (
            <div className="stats-grid two-col">
              <div className="stat-card">
                <div className="stat-label">Total Users</div>
                <div className="stat-value">{stats.total_users}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active Users</div>
                <div className="stat-value">{stats.active_users}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Banned Users</div>
                <div className="stat-value">{stats.banned_users}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total URLs</div>
                <div className="stat-value">{stats.total_urls}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active URLs</div>
                <div className="stat-value">{stats.active_urls}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Inactive URLs</div>
                <div className="stat-value">{stats.inactive_urls}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Protected URLs</div>
                <div className="stat-value">{stats.protected_urls}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Clicks</div>
                <div className="stat-value">{stats.total_clicks}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Open Reports</div>
                <div className="stat-value">{abuseReports.length}</div>
              </div>
            </div>
          )}
        </div>

        <div className="card right-panel">
          <div className="abuse-panel-header">
            <h2 className="table-title">Abuse Reports</h2>
            <button
              type="button"
              className="abuse-refresh-button"
              onClick={loadAbuseReports}
              disabled={abuseLoading}
            >
              {abuseLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {abuseError && <p className="error">{abuseError}</p>}

          {!abuseLoading && !abuseError && abuseReports.length === 0 && (
            <p className="no-selection-note">No open abuse reports. </p>
          )}

          {abuseReports.length > 0 && (
            <div className="table-wrapper">
              <div className="list-header abuse-grid">
                <div>ID</div>
                <div>Short URL</div>
                <div>Original URL</div>
                <div>Reported By</div>
                <div>Actions</div>
              </div>

              {abuseReports.map((report) => {
                const isBusy = abuseActionId === report.abuse_id;

                return (
                  <div key={report.abuse_id} className="url-entry">
                    <div
                      className="url-entry-header abuse-grid"
                      style={{ cursor: "default" }}
                    >
                      <div className="url-entry-col">
                        <div className="url-entry-label">ID</div>#{report.abuse_id}
                      </div>

                      <div className="url-entry-col truncate">
                        <div className="url-entry-label">Short URL</div>
                        <a
                          href={report.short_url}
                          target="_blank"
                          rel="noreferrer"
                          className="short-link"
                        >
                          {report.short_code}
                        </a>
                        {!report.url_is_active && (
                          <span className="abuse-inactive-pill">inactive</span>
                        )}
                      </div>

                      <div className="url-entry-col truncate">
                        <div className="url-entry-label">Original URL</div>
                        {report.original_url}
                        {report.reason && (
                          <div className="abuse-reason" title={report.reason}>
                            {report.reason}
                          </div>
                        )}
                      </div>

                      <div className="url-entry-col truncate">
                        <div className="url-entry-label">Reported By</div>
                        {report.reporter_email || "Deleted user"}
                      </div>

                      <div className="url-entry-col">
                        <div className="url-entry-label">Actions</div>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="delete-button abuse-accept-button"
                            disabled={isBusy}
                            onClick={() => handleAcceptAbuse(report)}
                          >
                            {isBusy ? "..." : "Accept"}
                          </button>

                          <button
                            type="button"
                            className="validate-button"
                            disabled={isBusy}
                            onClick={() => handleRefuseAbuse(report)}
                          >
                            {isBusy ? "..." : "Refuse"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — users on the left, the selected user's URLs on the right */}
      <div className="dashboard-layout admin-row">
        <div className="card left-panel">
          <h2 className="table-title">Users</h2>

          {users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <div className="table-wrapper">
              <div className="list-header users-grid">
                <div>ID</div>
                <div>Email</div>
                <div>Status</div>
                <div>Admin</div>
                <div></div>
              </div>

              {users.map((user) => {
                const isOpen = selectedUserId === user.id;

                return (
                  <div key={user.id} className={`url-entry ${isOpen ? "open" : ""}`}>
                    <div
                      className="url-entry-header users-grid"
                      onClick={() => selectUser(user.id)}
                    >
                      <div className="url-entry-col">
                        <div className="url-entry-label">ID</div>
                        {user.id}
                      </div>

                      <div className="url-entry-col truncate">
                        <div className="url-entry-label">Email</div>
                        {user.email}
                      </div>

                      <div className="url-entry-col">
                        <div className="url-entry-label">Status</div>
                        {user.is_active ? "Active" : "Banned"}
                      </div>

                      <div className="url-entry-col">
                        <div className="url-entry-label">Admin</div>
                        {user.is_admin ? "Yes" : "No"}
                      </div>

                      <div className="chevron">⌄</div>
                    </div>

                    <div className="url-entry-details">
                      <div className="url-entry-details-inner">
                        <div className="stats-grid two-col">
                          <div className="stat-card">
                            <div className="stat-label">URL Count</div>
                            <div className="stat-value">{user.url_count}</div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-label">Total Clicks</div>
                            <div className="stat-value">{user.total_clicks}</div>
                          </div>
                        </div>

                        {user.is_admin ? (
                          <p className="details-note">Admin accounts can't be banned or deleted.</p>
                        ) : (
                          <div className="action-buttons user-admin-actions">
                            <button
                              type="button"
                              className={`validate-button ${
                                user.is_active ? "invalidated" : "validated"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleUserBan(user.id, user.is_active);
                              }}
                            >
                              {user.is_active ? "Ban User" : "Unban User"}
                            </button>

                            <button
                              type="button"
                              className="delete-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteUser(user);
                              }}
                            >
                              Delete User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card right-panel">
          <h2 className="table-title">
            {selectedUser ? `URLs — ${selectedUser.email}` : "User URLs"}
          </h2>

          {!selectedUser && (
            <p className="no-selection-note">Select a user on the left to see their URLs.</p>
          )}

          {selectedUser && urlsLoading && <p>Loading URLs...</p>}

          {selectedUser && !urlsLoading && urlsError && (
            <p className="error">{urlsError}</p>
          )}

          {selectedUser && !urlsLoading && !urlsError && userUrls.length === 0 && (
            <p>This user has no URLs yet.</p>
          )}

          {selectedUser && !urlsLoading && !urlsError && userUrls.length > 0 && (
            <div className="table-wrapper">
              <div className="list-header user-urls-grid">
                <div>ID</div>
                <div>Original URL</div>
                <div>Short URL</div>
                <div>Clicks</div>
                <div>Status</div>
              </div>

              {userUrls.map((url) => (
                <div key={url.id} className="url-entry">
                  <div className="url-entry-header user-urls-grid" style={{ cursor: "default" }}>
                    <div className="url-entry-col">
                      <div className="url-entry-label">ID</div>
                      {url.id}
                    </div>

                    <div className="url-entry-col truncate">
                      <div className="url-entry-label">Original URL</div>
                      {url.original_url}
                      {url.tags && url.tags.length > 0 && (
                        <div className="url-tag-pills">
                          {url.tags.map((tag) => (
                            <span key={tag.id} className="url-tag-pill">
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="url-entry-col">
                      <div className="url-entry-label">Short URL</div>
                      <a
                        href={url.short_url}
                        target="_blank"
                        rel="noreferrer"
                        className="short-link"
                      >
                        {url.short_url}
                      </a>
                    </div>

                    <div className="url-entry-col">
                      <div className="url-entry-label">Clicks</div>
                      {url.clicks}
                    </div>

                    <div className="url-entry-col">
                      <div className="url-entry-label">Status</div>
                      {url.is_active ? "Active" : "Inactive"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {userToDelete && (
        <div className="modal-overlay">
          <div className="card modal-card">
            <h3 className="modal-title">Delete {userToDelete.email}?</h3>

            <p className="modal-text">
              This permanently deletes this user and all of their URLs. This
              action cannot be undone.
            </p>

            <p className="modal-text">
              Type <strong>{userToDelete.email}</strong> below to confirm.
            </p>

            <input
              type="text"
              className="input"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Enter email to confirm"
              autoFocus
            />

            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel-button"
                onClick={cancelDeleteUser}
                disabled={deleteInFlight}
              >
                Cancel
              </button>

              <button
                type="button"
                className="delete-button"
                disabled={deleteConfirmText !== userToDelete.email || deleteInFlight}
                onClick={confirmDeleteUser}
              >
                {deleteInFlight ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;