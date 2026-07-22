const API_BASE = "http://localhost:8000";

export async function signup(username, email, password) {
  const response = await fetch(`${API_BASE}/signup/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, email, password })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Signup failed");
  }

  return data;
}

export async function login(email, password) {
  if(!email || !password){
    throw new Error("Please write the mail or password again.")
  }
  const payload = { email, password, username: "" };

  const response = await fetch(`${API_BASE}/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Login failed");
  }

  if (data.access_token) {
    localStorage.setItem("token", data.access_token);
  }

  return data;
}

export async function changePassword(email, currentPassword, newPassword) {
  const response = await fetch(`${API_BASE}/change-password/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      current_password: currentPassword,
      new_password: newPassword
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to change password");
  }

  return data;
}

export function getToken() {
  return localStorage.getItem("token");
}

export function logout() {
  localStorage.removeItem("token");
}

export function getAuthHeaders() {
  const token = getToken();

  if (!token) {
    return {
      "Content-Type": "application/json"
    };
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

export async function getMe() {
  const response = await fetch(`${API_BASE}/me`, {
    method: "GET",
    headers: getAuthHeaders()
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to fetch user");
  }

  return data;
}


export function isTokenExpired() {
  const token = getToken();
  if (!token) return true;

  try {
    const payload = JSON.parse(atob(token.split(".")[1])); // Decode JWT
    const now = Date.now() / 1000;
    return payload.exp < now; // true if expired
  } catch {
    return true; // Unreadable token = treat as expired
  }
}

export function isAuthenticated() {
  if (isTokenExpired()) {
    logout(); // Clean up expired token automatically
    return false;
  }
  return true;
}