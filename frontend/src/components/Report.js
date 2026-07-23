//This is for the report section.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders } from "../services/auth";
import {
  reportAbuse,
  listMyAbuseReports,
  extractShortCode,
} from "../services/Abuse";
import { ROUTES } from "../routes";
import "./Dashboard.css";
import "./Report.css";

function Report() {
  const [shortUrl, setShortUrl] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [myReports, setMyReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState("");

  const navigate = useNavigate();

  const loadMyReports = async () => {
    try {
      setReportsLoading(true);
      setReportsError("");

      const data = await listMyAbuseReports();
      setMyReports(data);
    } catch (err) {
      // /api/get-abuse is limited to 2 requests per minute, so a 429 here is
      // expected if the page is refreshed quickly — it isn't a real failure.
      setReportsError(err.message || "Failed to load your reports.");
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    // Pre-fill the e-mail field with the logged-in account's address; the
    // user can still overwrite it with a different contact address.
    const loadCurrentUser = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/me", {
          method: "GET",
          headers: getAuthHeaders(),
        });

        const data = await response.json();

        if (response.ok && data.email) {
          setEmail(data.email);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadCurrentUser();
    loadMyReports();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!shortUrl.trim()) {
      setError("Please enter the short URL you want to report.");
      return;
    }

    if (!extractShortCode(shortUrl)) {
      setError("That doesn't look like a valid short URL.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter a contact e-mail.");
      return;
    }

    if (!reason.trim()) {
      setError("Please describe why you are reporting this link.");
      return;
    }

    try {
      setSubmitting(true);

      const data = await reportAbuse({ shortUrl, reason, email });

      setMessage(
        `${data.message || "Abuse report submitted successfully."} (report #${data.abuse_id})`
      );
      setShortUrl("");
      setReason("");
    } catch (err) {
      setError(err.message || "Failed to submit the abuse report.");
    } finally {
      setSubmitting(false);
    }
  };

  const detectedCode = extractShortCode(shortUrl);

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <div className="card left-panel report-form-panel">
          <h1 className="title">Report Abuse</h1>
          <p className="subtitle">
            Found a shortened link used for spam, phishing or malware? Tell us
            about it and an admin will review it.
          </p>

          <form className="report-form" onSubmit={handleSubmit}>
            <label className="report-label" htmlFor="report-short-url">
              Short URL <span className="report-required">*</span>
            </label>
            <input
              id="report-short-url"
              type="text"
              className="input"
              placeholder="http://localhost:8000/abc123"
              value={shortUrl}
              onChange={(e) => setShortUrl(e.target.value)}
            />

            {detectedCode && (
              <p className="report-hint">
                Detected short code: <code>{detectedCode}</code>
              </p>
            )}

            <label className="report-label" htmlFor="report-email">
              Your e-mail <span className="report-required">*</span>
            </label>
            <input
              id="report-email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label className="report-label" htmlFor="report-reason">
              Reason <span className="report-required">*</span>
            </label>
            <textarea
              id="report-reason"
              className="input report-textarea"
              placeholder="Explain what is wrong with this link (spam, phishing, malware, illegal content...)"
              rows={6}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <button type="submit" className="button" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </form>

          {message && <p className="report-success">{message}</p>}
          {error && <p className="error">{error}</p>}

          <p className="report-note">
            You can report the same link only once. Reports are rate limited to
            2 per minute.
          </p>

          <div className="logout-row">
            <button
              type="button"
              className="logout-small-button"
              onClick={() => navigate(ROUTES.DASHBOARD)}
            >
              ← Dashboard
            </button>
          </div>
        </div>

        <div className="card right-panel">
          <div className="report-list-header">
            <h2 className="table-title">My Reports</h2>
            <button
              type="button"
              className="report-refresh-button"
              onClick={loadMyReports}
              disabled={reportsLoading}
            >
              {reportsLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {reportsError && <p className="error">{reportsError}</p>}

          {!reportsLoading && !reportsError && myReports.length === 0 && (
            <p className="details-note">
              You haven't reported any links yet.
            </p>
          )}

          {myReports.length > 0 && (
            <div className="table-wrapper">
              <div className="list-header report-grid">
                <div>Report</div>
                <div>Short Code</div>
                <div>Original URL</div>
              </div>

              {myReports.map((report) => (
                <div key={report.abuse_id} className="url-entry">
                  <div
                    className="url-entry-header report-grid"
                    style={{ cursor: "default" }}
                  >
                    <div className="url-entry-col">
                      <div className="url-entry-label">Report</div>#
                      {report.abuse_id}
                    </div>

                    <div className="url-entry-col">
                      <div className="url-entry-label">Short Code</div>
                      {report.short_code}
                    </div>

                    <div className="url-entry-col truncate">
                      <div className="url-entry-label">Original URL</div>
                      {report.original_url}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Report;