import { getAuthHeaders } from "./auth";

const API_BASE = "http://localhost:8000";

export async function listTags() {
  const response = await fetch(`${API_BASE}/api/my-tags`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to load tags");
  }

  return data;
}

export async function createTag(name) {
  const response = await fetch(`${API_BASE}/api/create-tag`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to create tag");
  }

  return data;
}

export async function renameTag(tagId, name) {
  const response = await fetch(`${API_BASE}/api/rename-tag/${tagId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to rename tag");
  }

  return data;
}

export async function deleteTag(tagId) {
  const response = await fetch(`${API_BASE}/api/delete-tag/${tagId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to delete tag");
  }

  return data;
}

export async function updateUrlTags(urlId, tagIds) {
  const response = await fetch(`${API_BASE}/api/change-tag/${urlId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ tag_ids: tagIds }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Failed to update tags");
  }

  return data;
}