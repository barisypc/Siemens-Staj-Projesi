import { getAuthHeaders } from "./auth";

const API_BASE = "http://localhost:8000";

// The backend keys abuse reports on the short *code* (models.URL.short_url
// stores "abc123", not "http://localhost:8000/abc123"), so whatever the user
// pastes has to be reduced to its last path segment before it is sent.
export function extractShortCode(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] || "";
  } catch {
    // Not a full URL — the user probably pasted just the code.
    return trimmed.split("/").filter(Boolean).pop() || "";
  }
}

// slowapi's 429 body is {"error": ...} while FastAPI's is {"detail": ...},
// so every call funnels its error message through here.
async function parseResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || data.error || fallbackMessage);
  }

  return data;
}

export async function reportAbuse({ shortUrl, reason, email }) {
  const shortCode = extractShortCode(shortUrl);

  if (!shortCode) {
    throw new Error("Enter a valid short URL.");
  }

  // The backend's ReportAbuseRequest only has short_url + reason, so the
  // reporter's e-mail is folded into the reason text instead of needing a
  // new column and a migration.
  const composedReason = [
    email && email.trim() ? `Reporter e-mail: ${email.trim()}` : null,
    reason && reason.trim() ? `Reason: ${reason.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(`${API_BASE}/api/report-abuse`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      short_url: shortCode,
      reason: composedReason || null,
    }),
  });

  return parseResponse(response, "Failed to submit the abuse report");
}

export async function listMyAbuseReports() {
  const response = await fetch(`${API_BASE}/api/get-abuse`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return parseResponse(response, "Failed to load your reports");
}

export async function listAllAbuseReports() {
  const response = await fetch(`${API_BASE}/api/admin/abuse-reports`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  return parseResponse(response, "Failed to load abuse reports");
}

export async function acceptAbuse(abuseId) {
  const response = await fetch(`${API_BASE}/api/admin/accept-abuse`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ abuse_id: abuseId }),
  });

  return parseResponse(response, "Failed to accept the report");
}

export async function refuseAbuse(abuseId) {
  const response = await fetch(`${API_BASE}/api/admin/refuse-abuse`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ abuse_id: abuseId }),
  });

  return parseResponse(response, "Failed to refuse the report");
}