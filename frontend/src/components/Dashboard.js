
import React, { useEffect, useState } from "react";
import "./Dashboard.css";
import { getAuthHeaders, logout, isTokenExpired } from "../services/auth";
import { listTags, createTag, deleteTag, updateUrlTags } from "../services/Tags";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
 
const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
 
function Dashboard() {
  const [originalUrl, setOriginalUrl] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [urls, setUrls] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [sessionMessage, setSessionMessage] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
 
  const [statsByUrl, setStatsByUrl] = useState({});
  const [statsLoadingId, setStatsLoadingId] = useState(null);
 
  const [showAdvanced, setShowAdvanced] = useState(false);
 
  const [useExpiration, setUseExpiration] = useState(false);
  const [expirationMinutes, setExpirationMinutes] = useState("");
 
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCode, setCustomCode] = useState("");
 
  const [useQrCode, setUseQrCode] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
 
  const [useCountLimit, setUseCountLimit] = useState(false);
  const [countLimit, setCountLimit] = useState("");
 
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
 
  const [lastCreatedHasQr, setLastCreatedHasQr] = useState(false);
  const [lastCreatedQrImage, setLastCreatedQrImage] = useState("");
 
  const [tags, setTags] = useState([]);
  const [newTagName, setNewTagName] = useState("");
  const [tagActionLoading, setTagActionLoading] = useState(false);
 
  const navigate = useNavigate();
 
  // Central handler for "your account was banned mid-session" — any fetch
  // that comes back 403 from a now-inactive account routes through here so
  // the user gets logged out and bounced to /auth with a clear message,
  // instead of being left stuck on the dashboard staring at a generic error.
  const handleBanDetected = (message) => {
    logout();
    navigate("/auth", {
      replace: true,
      state: { message: message || "Your account has been banned." },
    });
  };
 
  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/me", {
        method: "GET",
        headers: getAuthHeaders(),
      });
 
      const data = await response.json();
 
      if (response.status === 403) {
        handleBanDetected(data.detail);
        return;
      }
 
      if (!response.ok) {
        throw new Error(data.detail || "Failed to fetch current user");
      }
 
      setIsAdmin(Boolean(data.is_admin));
    } catch (err) {
      console.error(err);
      setError("Failed to load user information.");
    }
  };
 
  const fetchUrls = async () => {
    try {
      setTableLoading(true);
 
      const response = await fetch("http://localhost:8000/api/my-urls", {
        method: "GET",
        headers: getAuthHeaders(),
      });
 
      if (response.status === 403) {
        const data = await response.json().catch(() => ({}));
        handleBanDetected(data.detail);
        return;
      }
 
      if (!response.ok) {
        throw new Error("Failed to fetch URLs");
      }
 
      const data = await response.json();
      setUrls(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load your URLs.");
    } finally {
      setTableLoading(false);
    }
  };
 
  const fetchTags = async () => {
    try {
      const data = await listTags();
      setTags(data);
    } catch (err) {
      console.error(err);
    }
  };
 
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      setError("Please enter a tag name.");
      return;
    }
 
    try {
      setTagActionLoading(true);
      const tag = await createTag(newTagName.trim());
      setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName("");
    } catch (err) {
      setError(err.message || "Failed to create tag.");
    } finally {
      setTagActionLoading(false);
    }
  };
 
  const handleDeleteTag = async (tagId) => {
    if (!window.confirm("Delete this tag? It will be removed from all URLs that use it.")) {
      return;
    }
 
    try {
      await deleteTag(tagId);
      setTags((prev) => prev.filter((tag) => tag.id !== tagId));
      setUrls((prev) =>
        prev.map((url) => ({
          ...url,
          tags: (url.tags || []).filter((tag) => tag.id !== tagId),
        }))
      );
    } catch (err) {
      setError(err.message || "Failed to delete tag.");
    }
  };
 
  const handleToggleUrlTag = async (url, tagId) => {
    const currentTagIds = (url.tags || []).map((tag) => tag.id);
    const nextTagIds = currentTagIds.includes(tagId)
      ? currentTagIds.filter((id) => id !== tagId)
      : [...currentTagIds, tagId];
 
    try {
      const updated = await updateUrlTags(url.id, nextTagIds);
      setUrls((prev) =>
        prev.map((u) => (u.id === url.id ? { ...u, tags: updated.tags } : u))
      );
    } catch (err) {
      setError(err.message || "Failed to update tags.");
    }
  };
 
  const handleGoToAdmin = () => {
    navigate("/admin");
  };
 
  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
      navigate("/auth", {
        replace: true,
        state: { message: "Session expired. Please enter your credentials again." },
      });
    };
 
    const initializeDashboard = async () => {
      if (isTokenExpired()) {
        handleSessionExpired();
        return;
      }
 
      await fetchCurrentUser();
      await fetchUrls();
      await fetchTags();
    };
 
    initializeDashboard();
 
    const interval = setInterval(() => {
      if (isTokenExpired()) {
        handleSessionExpired();
        return;
      }
 
      fetchUrls();
    }, 10000);
 
    return () => clearInterval(interval);
  }, [navigate]);
 
  const resetAdvancedInputs = () => {
    setUseExpiration(false);
    setExpirationMinutes("");
    setUseCustomCode(false);
    setCustomCode("");
    setUseQrCode(false);
    setUseCountLimit(false);
    setCountLimit("");
    setUsePassword(false);
    setPassword("");
    setShowAdvanced(false);
  };
 
  const handleShorten = async () => {
    setError("");
    setShortUrl("");
    setShowQrCode(false);
    setLastCreatedHasQr(false);
    setLastCreatedQrImage("");
 
    if (!originalUrl.trim()) {
      setError("Please enter a URL.");
      return;
    }
 
    if (useExpiration && !expirationMinutes.trim()) {
      setError("Please enter expiration time in minutes.");
      return;
    }
 
    if (useCustomCode && !customCode.trim()) {
      setError("Please enter a custom code.");
      return;
    }
 
    if (useCountLimit && !countLimit.trim()) {
      setError("Please enter a count limit.");
      return;
    }
 
    if (usePassword && !password.trim()) {
      setError("Please enter a password.");
      return;
    }
 
    setLoading(true);
 
    try {
      const qrRequested = useQrCode;
 
      const payload = {
        original_url: originalUrl,
        expiration_minutes: useExpiration ? parseInt(expirationMinutes, 10) : null,
        custom_code: useCustomCode ? customCode : null,
        qr_code: qrRequested,
        count_limit: useCountLimit ? parseInt(countLimit, 10) : null,
        password: usePassword ? password : null,
      };
 
      const response = await fetch("http://localhost:8000/shorten", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
 
      const data = await response.json();
 
      if (response.status === 403) {
        handleBanDetected(data.detail);
        return;
      }
 
      if (!response.ok) {
        throw new Error(data.detail || "Failed to shorten URL");
      }
 
      setShortUrl(data.short_url || "");
      setLastCreatedHasQr(qrRequested);
      setShowQrCode(qrRequested);
      setLastCreatedQrImage(data.qr_code_image || "");
 
      setOriginalUrl("");
      resetAdvancedInputs();
 
      await fetchUrls();
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong. Check backend or CORS settings.");
    } finally {
      setLoading(false);
    }
  };
 
  const handleLogout = async () => {
    try {
      logout();
      navigate("/auth");
    } catch (err) {
      console.error("Logout Failed:", err);
      setError("Logout Failed.");
    }
  };
 
  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
 
      setTimeout(() => {
        setCopiedId(null);
      }, 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
      setError("Failed to copy link.");
    }
  };
 
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this URL?")) {
      return;
    }
 
    try {
      const response = await fetch(`http://localhost:8000/api/delete-url/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
 
      const data = await response.json();
 
      if (response.status === 403) {
        handleBanDetected(data.detail);
        return;
      }
 
      if (!response.ok) {
        throw new Error(data.detail || "Failed to delete URL");
      }
 
      setUrls((prev) => prev.filter((url) => url.id !== id));
 
      setStatsByUrl((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
 
      if (expandedId === id) {
        setExpandedId(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong. Check backend or CORS settings.");
    }
  };
 
  const handleValidate = async (id, currentStatus) => {
    try {
      const response = await fetch(`http://localhost:8000/api/validate-url/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !currentStatus }),
      });
 
      const data = await response.json();
 
      if (response.status === 403) {
        handleBanDetected(data.detail);
        return;
      }
 
      if (!response.ok) {
        throw new Error(data.detail || "Failed to update validation status");
      }
 
      setUrls((prevUrls) =>
        prevUrls.map((url) =>
          url.id === id ? { ...url, is_active: !currentStatus } : url
        )
      );
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to update validation status.");
    }
  };
 
  const fetchStatsForUrl = async (id) => {
    try {
      setStatsLoadingId(id);
 
      const response = await fetch(`http://localhost:8000/api/show-statistics/${id}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
 
      const data = await response.json();
 
      if (response.status === 403) {
        handleBanDetected(data.detail);
        return;
      }
 
      if (!response.ok) {
        throw new Error(data.detail || "Failed to show statistics.");
      }
 
      setStatsByUrl((prev) => ({
        ...prev,
        [id]: data,
      }));
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to show the statistics.");
    } finally {
      setStatsLoadingId(null);
    }
  };
 
  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
 
    setExpandedId(id);
    await fetchStatsForUrl(id);
  };
 
  const handleShowQr = () => {
    setShowQrCode((prev) => !prev);
  };
 
  const formatPieData = (items = []) =>
    items.map((item) => ({
      name: item.label,
      value: item.count,
    }));
 
  const formatRecentClicksData = (items = []) =>
    items.map((item, index) => ({
      name: item.timestamp
        ? new Date(item.timestamp).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : `Click ${index + 1}`,
      clicks: item.count ?? 1,
    }));
 
  return (
    <div className="dashboard-page">
      {sessionMessage && <div className="session-toast">{sessionMessage}</div>}
 
      <div className="dashboard-layout">
        <div className="card left-panel">
          <h1 className="title">URL Shortener</h1>
          <p className="subtitle">Paste your long URL and get a shorter one.</p>
 
          <input
            type="text"
            placeholder="Enter your URL here..."
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
            className="input"
          />
 
          <button
            type="button"
            className="advanced-toggle-button"
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            {showAdvanced ? "Hide Advanced Features" : "Advanced Features"}
          </button>
 
          {showAdvanced && (
            <div className="advanced-box">
              <label className="feature-row">
                <input
                  type="checkbox"
                  checked={useExpiration}
                  onChange={(e) => setUseExpiration(e.target.checked)}
                />
                <span>Custom expiration time</span>
              </label>
              {useExpiration && (
                <input
                  type="number"
                  min="1"
                  placeholder="Expiration time (minutes)"
                  value={expirationMinutes}
                  onChange={(e) => setExpirationMinutes(e.target.value)}
                  className="input small-input"
                />
              )}
 
              <label className="feature-row">
                <input
                  type="checkbox"
                  checked={useCustomCode}
                  onChange={(e) => setUseCustomCode(e.target.checked)}
                />
                <span>Custom code</span>
              </label>
              {useCustomCode && (
                <input
                  type="text"
                  placeholder="Enter custom code"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="input small-input"
                />
              )}
 
              <label className="feature-row">
                <input
                  type="checkbox"
                  checked={useQrCode}
                  onChange={(e) => setUseQrCode(e.target.checked)}
                />
                <span>QR code option</span>
              </label>
 
              <label className="feature-row">
                <input
                  type="checkbox"
                  checked={useCountLimit}
                  onChange={(e) => setUseCountLimit(e.target.checked)}
                />
                <span>Count limit</span>
              </label>
              {useCountLimit && (
                <input
                  type="number"
                  min="1"
                  placeholder="Enter click threshold"
                  value={countLimit}
                  onChange={(e) => setCountLimit(e.target.value)}
                  className="input small-input"
                />
              )}
 
              <label className="feature-row">
                <input
                  type="checkbox"
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                />
                <span>Password protect shortened URL</span>
              </label>
              {usePassword && (
                <input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input small-input"
                />
              )}
 
              <div className="tag-manager-divider" />
              <h4 className="tag-manager-heading">Manage Tags</h4>
 
              <div className="tag-create-row">
                <input
                  type="text"
                  placeholder="New tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="input small-input"
                />
                <button
                  type="button"
                  className="button tag-create-button"
                  onClick={handleCreateTag}
                  disabled={tagActionLoading}
                >
                  Add Tag
                </button>
              </div>
 
              {tags.length === 0 ? (
                <p className="details-note">No tags yet. Create one above.</p>
              ) : (
                <div className="tag-chip-list">
                  {tags.map((tag) => (
                    <span key={tag.id} className="tag-chip">
                      {tag.name}
                      <button
                        type="button"
                        className="tag-chip-remove"
                        onClick={() => handleDeleteTag(tag.id)}
                        aria-label={`Delete tag ${tag.name}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
 
          <button onClick={handleShorten} className="button" disabled={loading}>
            {loading ? "Shortening..." : "Shorten URL"}
          </button>
 
          {shortUrl && (
            <div className="result-box">
              <p className="result-label">Short URL:</p>
 
              <div className="result-link-row">
                <a href={shortUrl} target="_blank" rel="noreferrer" className="link">
                  {shortUrl}
                </a>
              </div>
 
              {lastCreatedHasQr && (
                <button
                  type="button"
                  className="qr-toggle-button"
                  onClick={handleShowQr}
                >
                  {showQrCode ? "Hide QR Code" : "Show QR Code"}
                </button>
              )}
 
              {lastCreatedHasQr && showQrCode && (
                <div className="qr-placeholder">
                  {lastCreatedQrImage ? (
                    <img
                      src={lastCreatedQrImage}
                      alt="QR Code"
                      className="qr-image"
                    />
                  ) : (
                    <span>QR Code Preview Area</span>
                  )}
                </div>
              )}
            </div>
          )}
 
          {error && <p className="error">{error}</p>}
 
          <div className="logout-row">
            {isAdmin && (
              <button
                onClick={handleGoToAdmin}
                className="logout-small-button"
                type="button"
              >
                Admin Panel
              </button>
            )}
 
            <button
              onClick={handleLogout}
              className="logout-small-button"
              disabled={loading}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
 
        <div className="card right-panel">
          <h2 className="table-title">My URLs</h2>
 
          {tableLoading ? (
            <p>Loading your URLs...</p>
          ) : urls.length === 0 ? (
            <p>No URLs found yet.</p>
          ) : (
            <div className="table-wrapper">
              <div className="list-header">
                <div>ID</div>
                <div>Original URL</div>
                <div>Short URL</div>
                <div>Actions</div>
                <div></div>
              </div>
 
              {urls.map((url) => {
                const isOpen = expandedId === url.id;
                const isValidated = Boolean(url.is_active);
                const stats = statsByUrl[url.id];
                const isStatsLoading = statsLoadingId === url.id;
 
                const browserPieData = formatPieData(stats?.by_browser || []);
                const platformPieData = formatPieData(stats?.by_platform || []);
                const recentClicksData = formatRecentClicksData(stats?.recent_clicks || []);
 
                return (
                  <div
                    key={url.id}
                    className={`url-entry ${isOpen ? "open" : ""}`}
                  >
                    <div
                      className="url-entry-header"
                      onClick={() => toggleExpand(url.id)}
                    >
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
                          onClick={(e) => e.stopPropagation()}
                        >
                          {url.short_url}
                        </a>
                      </div>
 
                      <div
                        className="url-entry-col"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="action-buttons">
                          <button
                            onClick={() => handleCopy(url.id, url.short_url)}
                            className={`copy-button ${
                              copiedId === url.id ? "copied" : ""
                            }`}
                            type="button"
                          >
                            <span className="copy-icon">
                              {copiedId === url.id ? "✓" : "⧉"}
                            </span>
                            <span>
                              {copiedId === url.id ? "Copied!" : "Copy"}
                            </span>
                          </button>
 
                          <button
                            onClick={() => handleValidate(url.id, isValidated)}
                            className={`validate-button ${
                              isValidated ? "validated" : "invalidated"
                            }`}
                            type="button"
                          >
                            {isValidated ? "Deactivate" : "Activate"}
                          </button>
 
                          <button
                            onClick={() => handleDelete(url.id)}
                            className="delete-button"
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
 
                      <div className="chevron">⌄</div>
                    </div>
 
                    <div className="url-entry-details">
                      <div className="url-entry-details-inner">
                        <div className="stats-grid">
                          <div className="stat-card">
                            <div className="stat-label">Total Clicks</div>
                            <div className="stat-value">
                              {stats ? stats.total_clicks : url.clicks}
                            </div>
                          </div>
 
                          <div className="stat-card">
                            <div className="stat-label">Status</div>
                            <div className="stat-value">
                              {url.is_active ? "Active" : "Inactive"}
                            </div>
                          </div>
 
                          <div className="stat-card">
                            <div className="stat-label">Click Limit</div>
                            <div className="stat-value">
                              {url.click_limit ?? "None"}
                            </div>
                          </div>
 
                          <div className="stat-card">
                            <div className="stat-label">Expires At</div>
                            <div className="stat-value">
                              {url.expires_at
                                ? new Date(url.expires_at).toLocaleString()
                                : "Never"}
                            </div>
                          </div>
                        </div>
 
                        <div className="tags-assign-section">
                          <h4>Tags</h4>
                          {tags.length === 0 ? (
                            <p className="details-note">
                              No tags created yet. Use "Manage Tags" above to create some.
                            </p>
                          ) : (
                            <div
                              className="tag-checkbox-list"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {tags.map((tag) => {
                                const isChecked = (url.tags || []).some(
                                  (t) => t.id === tag.id
                                );
                                return (
                                  <label key={tag.id} className="tag-checkbox-row">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleUrlTag(url, tag.id)}
                                    />
                                    <span>{tag.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
 
                        {isStatsLoading && (
                          <div className="details-note">Loading statistics...</div>
                        )}
 
                        {!isStatsLoading && stats && (
                          <div className="statistics-section">
                            <h3>Statistics</h3>
 
                            <div className="charts-grid">
                              <div className="chart-card">
                                <h4>Browser Distribution</h4>
                                {browserPieData.length > 0 ? (
                                  <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height={280}>
                                      <PieChart>
                                        <Pie
                                          data={browserPieData}
                                          dataKey="value"
                                          nameKey="name"
                                          cx="50%"
                                          cy="50%"
                                          outerRadius={90}
                                          label
                                        >
                                          {browserPieData.map((entry, index) => (
                                            <Cell
                                              key={`browser-cell-${index}`}
                                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                                            />
                                          ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                ) : (
                                  <p>No browser data available.</p>
                                )}
                              </div>
 
                              <div className="chart-card">
                                <h4>Platform Distribution</h4>
                                {platformPieData.length > 0 ? (
                                  <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height={280}>
                                      <PieChart>
                                        <Pie
                                          data={platformPieData}
                                          dataKey="value"
                                          nameKey="name"
                                          cx="50%"
                                          cy="50%"
                                          outerRadius={90}
                                          label
                                        >
                                          {platformPieData.map((entry, index) => (
                                            <Cell
                                              key={`platform-cell-${index}`}
                                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                                            />
                                          ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                ) : (
                                  <p>No platform data available.</p>
                                )}
                              </div>
                            </div>
 
                            <div className="chart-card click-history-card">
                              <h4>Recent Click Activity</h4>
                              <div className="click-total">
                                Total Clicks: <strong>{stats.total_clicks ?? 0}</strong>
                              </div>
 
                              {recentClicksData.length > 0 ? (
                                <div className="chart-wrapper">
                                  <ResponsiveContainer width="100%" height={320}>
                                    <LineChart data={recentClicksData}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis dataKey="name" />
                                      <YAxis allowDecimals={false} />
                                      <Tooltip />
                                      <Line
                                        type="monotone"
                                        dataKey="clicks"
                                        stroke="#2563eb"
                                        strokeWidth={3}
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              ) : (
                                <p>No recent click history available.</p>
                              )}
                            </div>
 
                            <div className="stats-group">
                              <h4>By Country</h4>
                              {stats.by_country && stats.by_country.length > 0 ? (
                                <ul>
                                  {stats.by_country.map((item, index) => (
                                    <li key={index}>
                                      {item.label}: {item.count}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p>No country data available.</p>
                              )}
                            </div>
                          </div>
                        )}
 
                        {!isStatsLoading && !stats && (
                          <div className="details-note">
                            No statistics available for this URL yet.
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
      </div>
    </div>
  );
}
 
export default Dashboard;
 