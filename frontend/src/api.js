const API_BASE_URL = "http://localhost:5000";

export function getToken() {
  return localStorage.getItem("roadsense_token");
}

export function saveSession(session) {
  if (typeof session === "string") {
    localStorage.setItem("roadsense_token", session);
    return;
  }

  if (session?.token) {
    localStorage.setItem("roadsense_token", session.token);
  }

  if (session?.user) {
    localStorage.setItem(
      "roadsense_user",
      JSON.stringify(session.user)
    );
  }
}

export function clearSession() {
  localStorage.removeItem("roadsense_token");
  localStorage.removeItem("roadsense_user");
}

async function apiRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "Backend connection failed. Please run the backend on port 5000."
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

export function checkBackend() {
  return apiRequest("/api/health");
}

export async function getCurrentUser() {
  if (!getToken()) {
    return null;
  }

  try {
    const result = await apiRequest("/api/auth/me");

    if (result?.user) {
      localStorage.setItem(
        "roadsense_user",
        JSON.stringify(result.user)
      );
    }

    return result;
  } catch (error) {
    clearSession();
    throw error;
  }
}

export function registerAccount(account) {
  return apiRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(account),
  });
}

export function registerAdminAccount(account) {
  return apiRequest("/api/auth/register-admin", {
    method: "POST",
    body: JSON.stringify(account),
  });
}

export function loginAccount(credentials) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      ...credentials,
      accountType: credentials.accountType || "user",
    }),
  });
}

export function logoutAccount() {
  return apiRequest("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getReports() {
  return apiRequest("/api/reports");
}

export function createReport(report) {
  return apiRequest("/api/reports", {
    method: "POST",
    body: JSON.stringify(report),
  });
}

export function updateReportStatus(id, status) {
  return apiRequest(`/api/reports/${id}/verify`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}